import config from '../config/config';

class ClientService {
  constructor() {
    let baseURL = config.API_BASE_URL || '';
    if (!baseURL.endsWith('/api')) {
      if (baseURL.endsWith('/')) {
        baseURL += 'api';
      } else {
        baseURL += '/api';
      }
    }
    this.baseURL = `${baseURL}/clients`;
  }

  getAuthToken() {
    return localStorage.getItem('token');
  }

  getAuthHeaders() {
    const token = this.getAuthToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  }

  async getClients() {
    try {
      const response = await fetch(this.baseURL, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching clients:', error);
      throw error;
    }
  }
}

export default new ClientService();
