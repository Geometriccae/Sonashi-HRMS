import config from '../config/config';
import { saveAs } from 'file-saver';

class SalaryAdvanceService {
  constructor() {
    let baseURL = config.API_BASE_URL || '';
    if (!baseURL.endsWith('/api')) {
      baseURL = baseURL.endsWith('/') ? `${baseURL}api` : `${baseURL}/api`;
    }
    this.baseURL = `${baseURL}/salary-advances`;
  }

  getAuthToken() {
    return localStorage.getItem('token');
  }

  getAuthHeaders(json = true) {
    const token = this.getAuthToken();
    const headers = {};
    if (json) headers['Content-Type'] = 'application/json';
    if (token && token !== 'null' && token !== 'undefined' && token.trim() !== '') {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  /**
   * Create one or more advances / commissions in one call.
   * Supports either array of rows or { type, batchId, period, advanceDate, advances }
   */
  async createAdvances(payload) {
    const body = Array.isArray(payload) ? { advances: payload } : payload;
    const response = await fetch(this.baseURL, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${response.status}`);
    }
    return response.json();
  }

  /**
   * List all advances. Optional filters: type, status, employeeId, batchId, period.
   */
  async getAdvances(params = {}) {
    const qs = new URLSearchParams(params).toString();
    const url = qs ? `${this.baseURL}?${qs}` : this.baseURL;
    const response = await fetch(url, { headers: this.getAuthHeaders() });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${response.status}`);
    }
    return response.json();
  }

  /**
   * List grouped off-cycle batches (advances & commissions) with summary metrics.
   */
  async getBatches(params = {}) {
    const qs = new URLSearchParams(params).toString();
    const url = qs ? `${this.baseURL}/batches?${qs}` : `${this.baseURL}/batches`;
    try {
      const response = await fetch(url, { headers: this.getAuthHeaders() });
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      console.warn('Direct /batches fetch failed, falling back to client aggregation:', e);
    }

    // Resilient fallback: fetch all advances and aggregate client-side
    try {
      const advances = await this.getAdvances(params);
      return this.aggregateBatchesClientSide(advances);
    } catch (err) {
      console.warn('Client aggregation fallback failed:', err);
      return [];
    }
  }

  aggregateBatchesClientSide(records = []) {
    const batchMap = new Map();
    (Array.isArray(records) ? records : []).forEach((rec) => {
      const bId =
        rec.batchId ||
        `OFF-${rec.type || 'advance'}-${new Date(rec.createdAt || rec.advanceDate || Date.now()).toISOString().slice(0, 10)}`;
      if (!batchMap.has(bId)) {
        batchMap.set(bId, {
          batchId: bId,
          type: rec.type || 'advance',
          period: rec.period || '',
          advanceDate: rec.advanceDate,
          createdAt: rec.createdAt,
          totalAmount: 0,
          recoveredAmount: 0,
          outstandingBalance: 0,
          employeeCount: 0,
          sifExported: Boolean(rec.sifExported),
          sifExportedAt: rec.sifExportedAt || null,
          sifFileName: rec.sifFileName || '',
          statuses: new Set(),
          items: [],
        });
      }
      const b = batchMap.get(bId);
      b.totalAmount = Math.round((b.totalAmount + (rec.originalAmount || 0)) * 100) / 100;
      b.recoveredAmount = Math.round((b.recoveredAmount + (rec.recoveredAmount || 0)) * 100) / 100;
      b.outstandingBalance = Math.round((b.outstandingBalance + (rec.outstandingBalance || 0)) * 100) / 100;
      b.employeeCount += 1;
      if (rec.sifExported) {
        b.sifExported = true;
        b.sifExportedAt = rec.sifExportedAt || b.sifExportedAt;
        b.sifFileName = rec.sifFileName || b.sifFileName;
      }
      b.statuses.add(rec.status || 'active');
      b.items.push(rec);
    });

    return Array.from(batchMap.values()).map((b) => ({
      ...b,
      status: b.sifExported ? 'sif_generated' : Array.from(b.statuses)[0] || 'active',
      statuses: Array.from(b.statuses),
    }));
  }

  /**
   * Export dedicated Advance SIF or Commission SIF.
   * Calls backend /export-sif endpoint, with automatic client-side generation
   * fallback if the backend route is unavailable (e.g. before server restart).
   * @param {{ batchId?: string, advanceIds?: string[], employerId?: string, batch?: object, items?: array, rows?: array, employees?: array }} options
   */
  async exportSif(options = {}) {
    try {
      const response = await fetch(`${this.baseURL}/export-sif`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          batchId: options.batchId,
          advanceIds: options.advanceIds,
          employerId: options.employerId,
        }),
      });

      if (response.ok) {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          return response.json();
        }

        const blob = await response.blob();
        const disposition = response.headers.get('Content-Disposition') || '';
        const match = disposition.match(/filename="?([^"]+)"?/i);
        const fileName =
          match?.[1] ||
          `${options.type || 'OFF_CYCLE'}_${new Date().toISOString().slice(0, 10)}.SIF`;

        saveAs(blob, fileName);

        return {
          ok: true,
          fileName,
          batchId: response.headers.get('X-SIF-Batch-Id') || options.batchId || '',
          type: response.headers.get('X-SIF-Type') || options.type || '',
          edrCount: Number(response.headers.get('X-SIF-Edr-Count') || 0),
          totalSalary: Number(response.headers.get('X-SIF-Total') || 0),
          employerId: response.headers.get('X-SIF-Employer-Id') || options.employerId || '',
        };
      }

      // If backend returned non-ok (e.g. 404 if old server process running), try client fallback
      if (options.batch?.items?.length || options.items?.length || options.rows?.length) {
        console.warn('Backend SIF endpoint returned non-ok, using client-side SIF generation:', response.status);
        return this.generateSifClientSide(options);
      }

      let errorMsg = 'SIF export failed';
      try {
        const err = await response.json();
        errorMsg = err.message || errorMsg;
      } catch {
        const text = await response.text().catch(() => '');
        if (text) errorMsg = text.slice(0, 150);
      }
      throw new Error(errorMsg);
    } catch (err) {
      // If network error / 404 and we have batch data, generate client-side
      if (options.batch?.items?.length || options.items?.length || options.rows?.length) {
        console.warn('Backend fetch failed, falling back to client-side SIF generator:', err);
        return this.generateSifClientSide(options);
      }
      throw err;
    }
  }

  /**
   * Resilient client-side WPS SIF generator compliant with UAE Wages Protection System standard.
   */
  generateSifClientSide(options = {}) {
    const rawItems = options.batch?.items || options.items || options.rows || [];
    const employees = Array.isArray(options.employees) ? options.employees : [];
    if (!rawItems.length) {
      throw new Error('No employee records in this batch to export.');
    }

    const defaultEmployerId = '0000000172509';
    const defaultAgentRoutingCode = '740810000';
    const now = new Date();
    const pad = (n, w = 2) => String(n).padStart(w, '0');
    const digitsOnly = (v) => String(v || '').replace(/\D/g, '');
    const cleanAgentCode = (v) => String(v || '').replace(/[^A-Za-z0-9]/g, '');

    const fileDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const fileTime = `${pad(now.getHours())}${pad(now.getMinutes())}`;
    const fileRef = `${defaultEmployerId}${pad(now.getDate())}${pad(now.getMonth() + 1)}${String(now.getFullYear()).slice(-2)}${fileTime}00`;

    const sampleDate = new Date(rawItems[0]?.advanceDate || Date.now());
    const year = sampleDate.getFullYear();
    const month = sampleDate.getMonth() + 1;
    const lastDay = new Date(year, month, 0).getDate();
    const start = `${year}-${pad(month)}-01`;
    const end = `${year}-${pad(month)}-${pad(lastDay)}`;
    const daysField = pad(lastDay, 4);

    const edrLines = [];
    let totalSalary = 0;

    rawItems.forEach((item) => {
      const empIdKey = item.employeeId || item.employee?._id || item.employee || item.selectedEmployeeId;
      const empDoc =
        employees.find(
          (e) =>
            String(e._id) === String(empIdKey) ||
            (e.employeeId && String(e.employeeId).trim().toLowerCase() === String(item.employeeCode || item.employeeId || '').trim().toLowerCase())
        ) ||
        (typeof item.employee === 'object' ? item.employee : {}) ||
        {};

      let empidRaw =
        digitsOnly(empDoc.emiratesId) ||
        digitsOnly(empDoc.labourCardNumber) ||
        digitsOnly(empDoc.workPermitNo) ||
        digitsOnly(empDoc.unifiedId) ||
        digitsOnly(empDoc.personCode) ||
        digitsOnly(item.employeeCode || item.employeeId || '');

      if (empidRaw.length < 14) {
        empidRaw = empidRaw.padStart(14, '0');
      } else if (empidRaw.length > 15) {
        empidRaw = empidRaw.slice(-15);
      }

      const agentRaw =
        cleanAgentCode(empDoc?.salaryDetails?.agentCode) ||
        cleanAgentCode(empDoc?.agentCode) ||
        cleanAgentCode(empDoc?.salaryDetails?.bankSortCode) ||
        defaultAgentRoutingCode;
      const agent = agentRaw.length === 9 ? agentRaw : defaultAgentRoutingCode;

      const bankRaw =
        empDoc?.salaryDetails?.bankAccount ||
        empDoc?.bankAccount ||
        empDoc?.salaryDetails?.iban ||
        empDoc?.iban ||
        empDoc?.salaryDetails?.accountNo ||
        'AE000000000000000000000';
      const bank = String(bankRaw).replace(/\s+/g, '');

      const amount = Number(item.amount || item.originalAmount || 0);
      totalSalary += amount;

      const line = [
        'EDR',
        empidRaw,
        agent,
        bank,
        start,
        end,
        daysField,
        amount.toFixed(2),
        '0.00',
        '0000',
      ].join(',');

      edrLines.push(line);
    });

    const mmYYYY = `${pad(month)}${year}`;
    const scrLine = [
      'SCR',
      defaultEmployerId,
      defaultAgentRoutingCode,
      fileDate,
      fileTime,
      mmYYYY,
      String(edrLines.length),
      totalSalary.toFixed(2),
      'AED',
      fileRef,
    ].join(',');

    const sifContent = [...edrLines, scrLine].join('\r\n') + '\r\n';
    const fileName = `${fileRef}.SIF`;
    const blob = new Blob([sifContent], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, fileName);

    return {
      ok: true,
      fileName,
      batchId: options.batchId || '',
      type: options.type || 'advance',
      edrCount: edrLines.length,
      totalSalary,
      employerId: defaultEmployerId,
    };
  }

  /**
   * Update status of an entire batch (e.g. 'processed' or 'cancelled')
   */
  async updateBatchStatus(batchId, status, remarks = '') {
    const response = await fetch(`${this.baseURL}/batch/${encodeURIComponent(batchId)}/status`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ status, remarks }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${response.status}`);
    }
    return response.json();
  }

  /**
   * History for a specific employee.
   * @param {string} employeeId  Mongo _id, employee code, or email.
   */
  async getEmployeeAdvances(employeeId) {
    const response = await fetch(`${this.baseURL}/employee/${encodeURIComponent(employeeId)}`, {
      headers: this.getAuthHeaders(),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${response.status}`);
    }
    return response.json();
  }

  /**
   * Single advance by _id.
   */
  async getAdvance(id) {
    const response = await fetch(`${this.baseURL}/${id}`, { headers: this.getAuthHeaders() });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${response.status}`);
    }
    return response.json();
  }

  /**
   * Update an advance (admin only). Allowed fields: remarks, advanceDate, status.
   */
  async updateAdvance(id, data) {
    const response = await fetch(`${this.baseURL}/${id}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${response.status}`);
    }
    return response.json();
  }
}

const salaryAdvanceService = new SalaryAdvanceService();
export default salaryAdvanceService;
