import config from '../config/config';

class SalarySlipService {
    constructor() {
        let baseURL = config.API_BASE_URL || 'http://localhost:5000/api';

        if (!baseURL.endsWith('/api')) {
            if (baseURL.endsWith('/')) {
                baseURL += 'api';
            } else {
                baseURL += '/api';
            }
        }

        this.baseURL = `${baseURL}/salary-slips`;
    }

    getAuthToken() {
        return localStorage.getItem('token');
    }

    getAuthHeaders() {
        const token = this.getAuthToken();
        const headers = {};
        // Only add Authorization header if token exists and is valid
        if (token && token !== 'null' && token !== 'undefined' && token.trim() !== '') {
            headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
    }

    async importSalarySlips(file, month, year) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('month', month);
            formData.append('year', year);

            const response = await fetch(`${this.baseURL}/import`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error importing salary slips:', error);
            throw error;
        }
    }

    async createSalarySlip(slipData) {
        try {
            const response = await fetch(`${this.baseURL}/create`, {
                method: 'POST',
                headers: {
                    ...this.getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(slipData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error creating salary slip:', error);
            throw error;
        }
    }

    async getAllSalarySlips(month = '', year = '') {
        try {
            const token = this.getAuthToken();
            if (!token || token === 'null' || token === 'undefined' || token.trim() === '') {
                throw new Error('Authentication required. Please login again.');
            }

            let url = `${this.baseURL}/all`;
            const params = new URLSearchParams();
            if (month) params.append('month', month);
            if (year) params.append('year', year);

            // Add cache buster
            params.append('t', Date.now());

            if (params.toString()) {
                url += `?${params.toString()}`;
            }

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    ...this.getAuthHeaders(),
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                },
            });

            if (!response.ok) {
                if (response.status === 401) {
                    // Token expired or invalid - clear it and throw meaningful error
                    localStorage.removeItem('token');
                    throw new Error('Session expired. Please login again.');
                }
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching all salary slips:', error);
            throw error;
        }
    }

    async getMySalarySlips() {
        try {
            const token = this.getAuthToken();
            if (!token || token === 'null' || token === 'undefined' || token.trim() === '') {
                throw new Error('Authentication required. Please login again.');
            }

            const url = `${this.baseURL}/my-slips?t=${Date.now()}`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    ...this.getAuthHeaders(),
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache'
                },
            });

            if (!response.ok) {
                if (response.status === 401) {
                    // Token expired or invalid - clear it and throw meaningful error
                    localStorage.removeItem('token');
                    throw new Error('Session expired. Please login again.');
                }
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching my salary slips:', error);
            throw error;
        }
    }

    async updateSalarySlip(id, slipData) {
        try {
            const response = await fetch(`${this.baseURL}/${id}`, {
                method: 'PUT',
                headers: {
                    ...this.getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(slipData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error updating salary slip:', error);
            throw error;
        }
    }

    async deleteSalarySlip(id) {
        try {
            const response = await fetch(`${this.baseURL}/${id}`, {
                method: 'DELETE',
                headers: {
                    ...this.getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error deleting salary slip:', error);
            throw error;
        }
    }

    async bulkDeleteSalarySlips(ids) {
        try {
            const response = await fetch(`${this.baseURL}/bulk-delete`, {
                method: 'POST',
                headers: {
                    ...this.getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ ids })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error bulk deleting salary slips:', error);
            throw error;
        }
    }
}

const salarySlipServiceInstance = new SalarySlipService();
export default salarySlipServiceInstance;
