import config from '../config/config';

class ClientService {
  constructor() {
    let baseURL = config.API_BASE_URL || 'http://localhost:5000/api';

    // Ensure baseURL ends with /api
    if (!baseURL.endsWith('/api')) {
      if (baseURL.endsWith('/')) {
        baseURL += 'api';
      } else {
        baseURL += '/api';
      }
    }

    this.baseURL = `${baseURL}/clients`;
    console.log('ClientService initialized with baseURL:', this.baseURL);

  }


  // Get auth token from localStorage
  getAuthToken() {
    return localStorage.getItem('token');
  }

  // Get auth headers
  getAuthHeaders() {
    const token = this.getAuthToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  // Get all clients
  async getClients() {
    try {
      console.log('Fetching clients from:', this.baseURL); // Debug log
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

  // Get single client by ID
  async getClient(id) {
    try {
      const response = await fetch(`${this.baseURL}/${id}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching client:', error);
      throw error;
    }
  }

  // Create new client
  async createClient(clientData) {
    try {
      console.log('Creating client at:', this.baseURL); // Debug log
      console.log('Client data:', clientData); // Debug log

      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(clientData),
      });

      console.log('Response status:', response.status); // Debug log
      console.log('Response headers:', response.headers); // Debug log

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating client:', error);
      throw error;
    }
  }

  // Update client
  async updateClient(id, clientData) {
    try {
      const formData = new FormData();
      formData.append('data', JSON.stringify(clientData));

      console.log('Creating client at:', this.baseURL); // Debug log
      console.log('Client data:', clientData); // Debug log

      if (clientData.profilePictureFile) {
    formData.append('profilePicture', clientData.profilePictureFile);
  }

      const response = await fetch(`${this.baseURL}/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}` // no Content-Type! fetch sets it automatically
        },
       body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating client:', error);
      throw error;
    }
  }

  // Delete client
  async deleteClient(id) {
    try {
      const response = await fetch(`${this.baseURL}/${id}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error deleting client:', error);
      throw error;
    }
  }

  async createClientWithFile(clientData, profileImage) {
    try {
      console.log('Creating client with file at:', this.baseURL);
      console.log('Profile image:', profileImage);

      const token = localStorage.getItem("token");
      const formDataToSend = new FormData();

      // Append client data as JSON string
      formDataToSend.append("data", JSON.stringify(clientData));

      // Append profile image if provided - using consistent field name
      if (profileImage) {
        console.log('Appending profile image:', profileImage.name, profileImage.type, profileImage.size);
        formDataToSend.append("profilePicture", profileImage);
      }

      const response = await fetch(this.baseURL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
          // Note: Don't set Content-Type header - FormData sets it automatically with boundary
        },
        body: formDataToSend,
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        let errorMessage = "Failed to create client with file";
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          // If response is not JSON, use status text
          errorMessage = `${errorMessage}: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error('Error in createClientWithFile:', error);
      throw error;
    }
  }

  async updateClientWithFile(id, clientData, profileImage) {
    try {
      console.log('Updating client with file at:', `${this.baseURL}/${id}`);
      console.log('Profile image for update:', profileImage);

      const token = localStorage.getItem("token");
      const formDataToSend = new FormData();

      // Append client data as JSON string
      formDataToSend.append("data", JSON.stringify(clientData));

      // Append profile image if provided
      if (profileImage) {
        console.log('Appending profile image for update:', profileImage.name, profileImage.type, profileImage.size);
        formDataToSend.append("profilePicture", profileImage);
      }

      const response = await fetch(`${this.baseURL}/${id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`
          // Note: Don't set Content-Type header - FormData sets it automatically with boundary
        },
        body: formDataToSend,
      });

      console.log('Update response status:', response.status);

      if (!response.ok) {
        let errorMessage = "Failed to update client with file";
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          // If response is not JSON, use status text
          errorMessage = `${errorMessage}: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error('Error in updateClientWithFile:', error);
      throw error;
    }
  }
}

export default new ClientService;
