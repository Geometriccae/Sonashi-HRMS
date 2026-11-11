import config from '../config/config';

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

  getAuthHeaders() {
    const token = this.getAuthToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token && token !== 'null' && token !== 'undefined' && token.trim() !== '') {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  /**
   * Create one or more advances in one call.
   * @param {Array<{ employeeId, amount, advanceDate, remarks }>} advances
   */
  async createAdvances(advances) {
    const response = await fetch(this.baseURL, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ advances }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${response.status}`);
    }
    return response.json();
  }

  /**
   * List all advances. Optional filters: status, employeeId.
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

