const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const SalaryAdvance = require('../models/SalaryAdvance');
const Employee = require('../models/Employee');
const CompanySifSettings = require('../models/CompanySifSettings');
const authMiddleware = require('../middleware/authMiddleware');
const {
  generateSifContent,
  getAgentCode,
  getBankAccount,
  digitsOnly,
  validateEmployerId,
  validateEmpId,
  validateAgentCode,
  validateBankAccount,
  cleanAgentCode,
  normalizeEmpId,
  normalizeEmiratesId,
} = require('../utils/sifUtils');
const {
  loadCompanyEmployerMap,
  applyCompanyEmployerMapping,
  normalizeEmployerId,
} = require('../utils/sifCompanyMapping');

// ──────────────────────────────────────────────
// Role guard: admin, hod, hr (same as salary slips)
// ──────────────────────────────────────────────
const requireAdmin = (req, res, next) => {
  const role = String(req.user?.role || '').toLowerCase();
  if (['admin', 'hod', 'hr'].includes(role)) return next();
  return res.status(403).json({ message: 'Access denied.' });
};

const toNum = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

const roundAed = (v) => Math.round(toNum(v) * 100) / 100;

const generateBatchId = (type = 'advance') => {
  const prefix = type === 'commission' ? 'COM' : 'ADV';
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `${prefix}-${dateStr}-${rand}`;
};

async function resolveRoutingCodeForEmployer(employerId, fallbackEmployee) {
  try {
    const settings = await CompanySifSettings.findOne().lean();
    const cleanEmpId = digitsOnly(employerId);
    if (settings) {
      const match = (settings.employerRoutingCodes || []).find(
        (entry) => digitsOnly(entry?.employerId) === cleanEmpId
      );
      if (match && match.agentRoutingCode && cleanAgentCode(match.agentRoutingCode).length === 9) {
        return cleanAgentCode(match.agentRoutingCode);
      }
      if (settings.defaultAgentRoutingCode && cleanAgentCode(settings.defaultAgentRoutingCode).length === 9) {
        return cleanAgentCode(settings.defaultAgentRoutingCode);
      }
    }
    if (fallbackEmployee) {
      const empCode = cleanAgentCode(getAgentCode(fallbackEmployee));
      if (empCode && empCode.length === 9) return empCode;
    }
    // Sonashi default agent routing code (from sifRoutes.js)
    return '740810000';
  } catch {
    return '740810000';
  }
}

// ──────────────────────────────────────────────
// POST /api/salary-advances
// Create one or more advances / commissions in a single call.
// Body: {
//   type: 'advance' | 'commission',
//   batchId?: string,
//   period?: string,
//   advanceDate?: string,
//   advances: [{ employeeId, amount, advanceDate, remarks }]
// }
// ──────────────────────────────────────────────
router.post('/', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const rawItems = Array.isArray(req.body.advances)
      ? req.body.advances
      : Array.isArray(req.body)
      ? req.body
      : [req.body];

    if (!rawItems.length || !rawItems[0]) {
      return res.status(400).json({ message: 'No advance or commission data provided.' });
    }

    const type = req.body.type === 'commission' ? 'commission' : 'advance';
    const batchId = String(req.body.batchId || generateBatchId(type)).trim();
    const period = String(req.body.period || '').trim();
    const defaultDate = req.body.advanceDate || req.body.payoutDate || new Date();

    const created = [];
    const errors = [];
    let totalAmount = 0;

    for (const item of rawItems) {
      try {
        const amount = roundAed(item.amount ?? item.originalAmount);
        if (!amount || amount <= 0) {
          errors.push({ employeeId: item.employeeId, error: 'Amount must be a positive number.' });
          continue;
        }

        if (!item.employeeId) {
          errors.push({ error: 'employeeId is required for each entry.' });
          continue;
        }

        // Resolve employee
        const isObjectId = mongoose.Types.ObjectId.isValid(item.employeeId);
        const emp = isObjectId
          ? await Employee.findById(item.employeeId).lean()
          : await Employee.findOne({
              $or: [
                { employeeId: item.employeeId },
                { emailId: item.employeeId },
              ],
            }).lean();

        if (!emp) {
          errors.push({ employeeId: item.employeeId, error: 'Employee not found.' });
          continue;
        }

        const rowDate = item.advanceDate || item.payoutDate || defaultDate;
        const advanceDate = rowDate ? new Date(rowDate) : new Date();
        if (isNaN(advanceDate.getTime())) {
          errors.push({ employeeId: item.employeeId, error: 'Invalid disbursement date.' });
          continue;
        }

        const isCommission = type === 'commission';
        const advance = await SalaryAdvance.create({
          employee: emp._id,
          employeeId: emp.employeeId || '',
          employeeEmail: String(emp.emailId || '').trim().toLowerCase(),
          employeeName: emp.employeeName || '',
          department: emp.department || '',
          designation: emp.designation || emp.role || '',
          company: emp.company || emp.office || '',
          type,
          batchId,
          period,
          originalAmount: amount,
          advanceDate,
          remarks: item.remarks || '',
          recoveredAmount: 0,
          outstandingBalance: isCommission ? 0 : amount, // Commission is never deducted from payroll
          status: 'active',
          sifExported: false,
          createdBy: req.user._id,
        });

        created.push(advance);
        totalAmount = roundAed(totalAmount + amount);
      } catch (err) {
        errors.push({ employeeId: item.employeeId, error: err.message });
      }
    }

    const label = type === 'commission' ? 'commission(s)' : 'advance(s)';
    return res.status(201).json({
      ok: true,
      batchId,
      type,
      period,
      totalAmount,
      created,
      errors,
      message: `${created.length} ${label} created${errors.length ? `, ${errors.length} failed` : ''}.`,
    });
  } catch (err) {
    console.error('POST /salary-advances error:', err);
    return res.status(500).json({ message: err.message });
  }
});

// ──────────────────────────────────────────────
// GET /api/salary-advances
// List all advances/commissions with optional filters:
//   ?type=advance|commission
//   ?status=active|sif_generated|processed|partially_recovered|fully_recovered|cancelled
//   ?batchId=<id>
//   ?employeeId=<mongo _id | employee code>
// ──────────────────────────────────────────────
router.get('/', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const filter = {};
    if (req.query.type) filter.type = req.query.type;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.batchId) filter.batchId = req.query.batchId;
    if (req.query.period) filter.period = req.query.period;
    if (req.query.employeeId) {
      const isObjectId = mongoose.Types.ObjectId.isValid(req.query.employeeId);
      if (isObjectId) {
        filter.employee = req.query.employeeId;
      } else {
        filter.$or = [
          { employeeId: req.query.employeeId },
          { employeeEmail: req.query.employeeId.toLowerCase() },
        ];
      }
    }

    const advances = await SalaryAdvance.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    return res.json(advances);
  } catch (err) {
    console.error('GET /salary-advances error:', err);
    return res.status(500).json({ message: err.message });
  }
});

// ──────────────────────────────────────────────
// GET /api/salary-advances/batches
// Summary of all off-cycle batches (Advance & Commission).
// ──────────────────────────────────────────────
router.get('/batches', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const filter = {};
    if (req.query.type) filter.type = req.query.type;
    if (req.query.status) filter.status = req.query.status;

    const records = await SalaryAdvance.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    const batchMap = new Map();

    records.forEach((rec) => {
      const bId = rec.batchId || `UNGROUPED-${rec.type || 'advance'}-${new Date(rec.createdAt).toISOString().slice(0, 10)}`;
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
          sifExported: false,
          sifExportedAt: null,
          sifFileName: '',
          statuses: new Set(),
          items: [],
        });
      }

      const b = batchMap.get(bId);
      b.totalAmount = roundAed(b.totalAmount + (rec.originalAmount || 0));
      b.recoveredAmount = roundAed(b.recoveredAmount + (rec.recoveredAmount || 0));
      b.outstandingBalance = roundAed(b.outstandingBalance + (rec.outstandingBalance || 0));
      b.employeeCount += 1;
      if (rec.sifExported) {
        b.sifExported = true;
        b.sifExportedAt = rec.sifExportedAt || b.sifExportedAt;
        b.sifFileName = rec.sifFileName || b.sifFileName;
      }
      b.statuses.add(rec.status || 'active');
      b.items.push(rec);
    });

    const batches = Array.from(batchMap.values()).map((b) => {
      let overallStatus = 'active';
      const statusArr = Array.from(b.statuses);
      if (statusArr.every((s) => s === 'fully_recovered')) {
        overallStatus = 'fully_recovered';
      } else if (statusArr.some((s) => s === 'partially_recovered')) {
        overallStatus = 'partially_recovered';
      } else if (statusArr.some((s) => s === 'processed')) {
        overallStatus = 'processed';
      } else if (b.sifExported || statusArr.some((s) => s === 'sif_generated')) {
        overallStatus = 'sif_generated';
      } else {
        overallStatus = statusArr[0] || 'active';
      }

      return {
        ...b,
        status: overallStatus,
        statuses: statusArr,
      };
    });

    return res.json(batches);
  } catch (err) {
    console.error('GET /salary-advances/batches error:', err);
    return res.status(500).json({ message: err.message });
  }
});

// ──────────────────────────────────────────────
// POST /api/salary-advances/export-sif
// Generate and export dedicated Advance SIF or Commission SIF.
// Body: {
//   batchId?: string,
//   advanceIds?: string[],
//   employerId?: string
// }
// ──────────────────────────────────────────────
router.post('/export-sif', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { batchId, advanceIds, employerId: requestedEmployerId } = req.body;

    let query = {};
    if (Array.isArray(advanceIds) && advanceIds.length) {
      query._id = { $in: advanceIds };
    } else if (batchId) {
      const hasBatch = await SalaryAdvance.exists({ batchId });
      if (hasBatch) {
        query.batchId = batchId;
      } else if (batchId.startsWith('OFF-') || batchId.startsWith('UNGROUPED-')) {
        // Fallback for legacy items grouped by date: OFF-<type>-<YYYY-MM-DD>
        const parts = batchId.split('-');
        const type = parts[1] || 'advance';
        const dateStr = parts.slice(2).join('-');
        if (dateStr) {
          const startDate = new Date(dateStr);
          startDate.setHours(0, 0, 0, 0);
          const endDate = new Date(dateStr);
          endDate.setHours(23, 59, 59, 999);
          query = {
            type,
            $or: [
              { advanceDate: { $gte: startDate, $lte: endDate } },
              { createdAt: { $gte: startDate, $lte: endDate } },
            ],
          };
        } else {
          query.batchId = batchId;
        }
      } else {
        query.batchId = batchId;
      }
    } else {
      return res.status(400).json({ message: 'batchId or advanceIds must be provided.' });
    }

    const records = await SalaryAdvance.find(query).lean();
    if (!records.length) {
      return res.status(404).json({ message: 'No advance/commission records found.' });
    }

    // Verify all records share the same type
    const types = new Set(records.map((r) => r.type || 'advance'));
    if (types.size > 1) {
      return res.status(400).json({
        message: 'Cannot export Advance and Commission transactions in the same SIF file. Export each type separately.',
      });
    }
    const targetType = Array.from(types)[0];

    // Load full employees and authoritative company mappings
    const companyMap = await loadCompanyEmployerMap();
    const employeeIds = records.map((r) => r.employee).filter(Boolean);
    const employeeCodes = records.map((r) => r.employeeId).filter(Boolean);
    const employeeDocs = await Employee.find({
      $or: [{ _id: { $in: employeeIds } }, { employeeId: { $in: employeeCodes } }],
    }).lean();

    const empById = new Map();
    const empByCode = new Map();
    employeeDocs.forEach((e) => {
      const mapped = applyCompanyEmployerMapping(e, companyMap);
      empById.set(String(e._id), mapped);
      if (e.employeeId) empByCode.set(String(e.employeeId).trim().toLowerCase(), mapped);
    });

    // Default employer fallback from SIF settings
    const defaultSettings = await CompanySifSettings.findOne().lean();
    const defaultEmployerId = digitsOnly(defaultSettings?.employerId) || '0000000172509';

    // Collect available employer IDs from matched employees
    const availableEmployers = [];
    records.forEach((rec) => {
      const emp =
        empById.get(String(rec.employee)) ||
        (rec.employeeId ? empByCode.get(String(rec.employeeId).trim().toLowerCase()) : null);
      const mappedId = digitsOnly(emp?.sifEmployerId || emp?.companyCode || '');
      if (mappedId.length === 13 && !availableEmployers.includes(mappedId)) {
        availableEmployers.push(mappedId);
      }
    });

    // Single unified Employer ID for this batch: use requested, primary matched, or default
    const targetEmployerId = requestedEmployerId
      ? digitsOnly(requestedEmployerId)
      : availableEmployers[0] || defaultEmployerId;

    const defaultAgentRoutingCode = await resolveRoutingCodeForEmployer(
      targetEmployerId,
      records[0] ? empById.get(String(records[0].employee)) : null
    );

    // Prepare ALL employees in this batch for one single combined SIF file
    const employerEmployees = records.map((rec) => {
      let emp =
        empById.get(String(rec.employee)) ||
        (rec.employeeId ? empByCode.get(String(rec.employeeId).trim().toLowerCase()) : null);

      if (!emp) {
        emp = {
          _id: rec.employee || rec._id,
          employeeId: rec.employeeId || 'EMP',
          employeeName: rec.employeeName || 'Employee',
          sifEmployerId: targetEmployerId,
          companyCode: targetEmployerId,
          salaryDetails: {
            basicSalary: rec.originalAmount,
          },
        };
      }

      const empAgent = cleanAgentCode(getAgentCode(emp));
      return {
        ...emp,
        agentCode: empAgent && empAgent.length === 9 ? empAgent : defaultAgentRoutingCode,
        customTransferAmount: rec.originalAmount,
      };
    });

    const sampleDate = records[0]?.advanceDate
      ? new Date(records[0].advanceDate)
      : new Date();
    const year = sampleDate.getFullYear();
    const month = sampleDate.getMonth() + 1;

    const result = generateSifContent({
      employees: employerEmployees,
      employerId: targetEmployerId,
      defaultAgentRoutingCode,
      year,
      month,
      now: sampleDate,
      isIndividual: employerEmployees.length === 1,
    });

    if (result.error) {
      const skipReasons = (result.skipped || [])
        .map((s) => `${s.empName || s.staffId}: ${s.reason}`)
        .join('; ');
      return res.status(400).json({
        message: skipReasons ? `SIF generation skipped: ${skipReasons}` : result.error,
        skipped: result.skipped || [],
      });
    }

    // Mark transactions as sifExported = true, sifFileName, and status = 'sif_generated'
    const processedIds = records.map((item) => item._id);
    await SalaryAdvance.updateMany(
      { _id: { $in: processedIds } },
      {
        $set: {
          sifExported: true,
          sifExportedAt: new Date(),
          sifFileName: result.fileName,
          status: 'sif_generated',
        },
      }
    );

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
    res.setHeader('X-SIF-Batch-Id', batchId || '');
    res.setHeader('X-SIF-Type', targetType);
    res.setHeader('X-SIF-Edr-Count', String(result.edrCount));
    res.setHeader('X-SIF-Total', String(result.totalSalary));
    res.setHeader('X-SIF-Employer-Id', targetEmployerId);
    return res.send(result.content);
  } catch (err) {
    console.error('POST /salary-advances/export-sif error:', err);
    return res.status(500).json({ message: err.message || 'Failed to export SIF file' });
  }
});

// ──────────────────────────────────────────────
// PUT /api/salary-advances/batch/:batchId/status
// Update entire batch status (e.g. 'processed' or 'cancelled')
// ──────────────────────────────────────────────
router.put('/batch/:batchId/status', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { batchId } = req.params;
    const { status, remarks } = req.body;
    if (!['active', 'sif_generated', 'processed', 'cancelled'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status for batch update.' });
    }

    const update = { status };
    if (remarks) update.remarks = remarks;

    const result = await SalaryAdvance.updateMany(
      { batchId, status: { $ne: 'fully_recovered' } },
      { $set: update }
    );

    return res.json({
      ok: true,
      message: `Batch ${batchId} updated to ${status}.`,
      modifiedCount: result.modifiedCount,
    });
  } catch (err) {
    console.error('PUT /salary-advances/batch/:batchId/status error:', err);
    return res.status(500).json({ message: err.message });
  }
});

// ──────────────────────────────────────────────
// GET /api/salary-advances/employee/:employeeId
// History for a specific employee.
// ──────────────────────────────────────────────
router.get('/employee/:employeeId', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { employeeId } = req.params;
    const isObjectId = mongoose.Types.ObjectId.isValid(employeeId);

    const filter = isObjectId
      ? { employee: employeeId }
      : {
          $or: [
            { employeeId },
            { employeeEmail: employeeId.toLowerCase() },
          ],
        };

    const advances = await SalaryAdvance.find(filter).sort({ createdAt: -1 }).lean();
    return res.json(advances);
  } catch (err) {
    console.error('GET /salary-advances/employee/:id error:', err);
    return res.status(500).json({ message: err.message });
  }
});

// ──────────────────────────────────────────────
// GET /api/salary-advances/:id
// Single advance detail.
// ──────────────────────────────────────────────
router.get('/:id', authMiddleware, requireAdmin, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Invalid advance ID format' });
    }
    const advance = await SalaryAdvance.findById(req.params.id).lean();
    if (!advance) return res.status(404).json({ message: 'Advance not found.' });
    return res.json(advance);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ──────────────────────────────────────────────
// PUT /api/salary-advances/:id
// Update remarks, advanceDate, or status of single advance.
// Admin only for safety.
// ──────────────────────────────────────────────
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Invalid advance ID format' });
    }
    const role = String(req.user?.role || '').toLowerCase();
    if (role !== 'admin') {
      return res.status(403).json({ message: 'Only admin can update advances.' });
    }

    const advance = await SalaryAdvance.findById(req.params.id);
    if (!advance) return res.status(404).json({ message: 'Advance not found.' });

    const allowedUpdates = ['remarks', 'advanceDate', 'status'];
    for (const field of allowedUpdates) {
      if (req.body[field] !== undefined) {
        if (
          field === 'status' &&
          !['active', 'sif_generated', 'processed', 'partially_recovered', 'fully_recovered', 'cancelled'].includes(
            req.body.status
          )
        ) {
          return res.status(400).json({ message: 'Invalid status value.' });
        }
        advance[field] = req.body[field];
      }
    }

    await advance.save();
    return res.json(advance);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

module.exports = router;
