import config from '../config/config';

class ExpenseService {
    constructor() {
        let baseURL = config.API_BASE_URL || 'http://localhost:5000/api';

        if (!baseURL.endsWith('/api')) {
            if (baseURL.endsWith('/')) {
                baseURL += 'api';
            } else {
                baseURL += '/api';
            }
        }

        this.baseURL = `${baseURL}/expenses`;
    }

    getAuthToken() {
        return localStorage.getItem('token');
    }

    getAuthHeaders() {
        const token = this.getAuthToken();
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    }

    async createExpense(expenseData) {
        try {
            const response = await fetch(`${this.baseURL}/create`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(expenseData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error creating expense:', error);
            throw error;
        }
    }

    async getMyExpenses() {
        try {
            const response = await fetch(`${this.baseURL}/my-expenses`, {
                method: 'GET',
                headers: this.getAuthHeaders(),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching my expenses:', error);
            throw error;
        }
    }

    async getAllExpenses(status = '') {
        try {
            let url = `${this.baseURL}/all`;
            if (status) {
                url += `?status=${encodeURIComponent(status)}`;
            }

            const response = await fetch(url, {
                method: 'GET',
                headers: this.getAuthHeaders(),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching all expenses:', error);
            throw error;
        }
    }

    async hodAction(expenseId, action, remarks = '') {
        try {
            const response = await fetch(`${this.baseURL}/hod-action/${expenseId}`, {
                method: 'PUT',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ action, remarks }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error performing HOD action:', error);
            throw error;
        }
    }

    async hrAction(expenseId, action, remarks = '') {
        try {
            const response = await fetch(`${this.baseURL}/hr-action/${expenseId}`, {
                method: 'PUT',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ action, remarks }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error performing HR action:', error);
            throw error;
        }
    }

    async deleteExpense(expenseId) {
        try {
            const response = await fetch(`${this.baseURL}/${expenseId}`, {
                method: 'DELETE',
                headers: this.getAuthHeaders(),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error deleting expense:', error);
            throw error;
        }
    }
}

const expenseServiceInstance = new ExpenseService();
export default expenseServiceInstance;
