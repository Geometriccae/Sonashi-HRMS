import config, { getApiBaseUrl } from '../config/config';

const CACHE_TTL_MS = 30000;

class EmployeeService {
  constructor() {
    const raw = (config.API_BASE_URL || '').trim();
    let apiRoot;
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      apiRoot = raw.replace(/\/$/, '');
      if (!apiRoot.endsWith('/api')) {
        apiRoot = apiRoot.endsWith('/') ? `${apiRoot}api` : `${apiRoot}/api`;
      }
    } else {
      const host = getApiBaseUrl();
      apiRoot = host ? `${host.replace(/\/$/, '')}/api` : '/api';
    }

    this.baseURL = `${apiRoot}/employees`;
    this.attendanceURL = `${apiRoot}/attendance`;
    this._cache = { list: null, full: null, stats: null, ts: 0 };
  }

  _isCacheValid() {
    return this._cache.ts && (Date.now() - this._cache.ts) < CACHE_TTL_MS;
  }

  invalidateCache() {
    this._cache = { list: null, full: null, stats: null, ts: 0 };
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

  // Lightweight list for tables, dashboards, dropdowns
  async getEmployeesList({ force = false } = {}) {
    if (!force && this._isCacheValid() && this._cache.list) {
      return this._cache.list;
    }
    try {
      const response = await fetch(`${this.baseURL}?view=list`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      this._cache.list = data;
      this._cache.ts = Date.now();
      return data;
    } catch (error) {
      console.error('Error fetching employee list:', error);
      throw error;
    }
  }

  // Server-side paginated list for the team members table
  async getEmployeesListPaginated({ page = 1, limit = 20, search = '', status = '' } = {}) {
    try {
      const params = new URLSearchParams({ view: 'list', page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      const response = await fetch(`${this.baseURL}?${params}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      // Handle both paginated response { employees, total } and legacy flat array
      if (Array.isArray(data)) {
        return { employees: data, total: data.length, page, limit, totalPages: Math.ceil(data.length / limit) };
      }
      return data;
    } catch (error) {
      console.error('Error fetching paginated employee list:', error);
      throw error;
    }
  }

  // Stats only — counts for dashboard cards
  async getEmployeeStats({ force = false } = {}) {
    if (!force && this._isCacheValid() && this._cache.stats) {
      return this._cache.stats;
    }
    try {
      const response = await fetch(`${this.baseURL}/stats`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      this._cache.stats = data;
      this._cache.ts = Date.now();
      return data;
    } catch (error) {
      console.error('Error fetching employee stats:', error);
      throw error;
    }
  }

  // Get all employees (full records — use only when editing/detail views need everything)
  // Optional status: 'Active' | 'InActive' — applied server-side via ?status=
  async getEmployees({ force = false, status } = {}) {
    const statusFilter = status === 'Active' || status === 'InActive' ? status : '';
    // Never serve cached full list when a status filter is requested
    if (!force && !statusFilter && this._isCacheValid() && this._cache.full) {
      return this._cache.full;
    }
    try {
      const url = statusFilter
        ? `${this.baseURL}?${new URLSearchParams({ status: statusFilter })}`
        : this.baseURL;
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (!statusFilter) {
        this._cache.full = data;
        this._cache.ts = Date.now();
      }
      return data;
    } catch (error) {
      console.error('Error fetching employees:', error);
      throw error;
    }
  }

  // Batch fetch profile photos for a list of employee IDs (current page only).
  async getProfilePhotosByIds(ids = []) {
    try {
      const clean = (ids || []).map((id) => String(id)).filter(Boolean);
      if (!clean.length) return [];
      const params = new URLSearchParams({ ids: clean.join(',') });
      const response = await fetch(`${this.baseURL}/photos?${params}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });
      if (!response.ok) return [];
      return await response.json();
    } catch (error) {
      console.error('Error fetching profile photos:', error);
      return [];
    }
  }

  // Get profile photo URL by employee email (for salary slip; auth: admin or same user)
  async getProfilePhotoByEmail(email) {
    try {
      if (!email || !String(email).trim()) return { profilePhoto: '' };
      const params = new URLSearchParams({ email: String(email).trim() });
      const response = await fetch(`${this.baseURL}/profile-photo?${params}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });
      if (!response.ok) return { profilePhoto: '' };
      return await response.json();
    } catch (error) {
      return { profilePhoto: '' };
    }
  }

  // Get single employee by ID
  async getEmployee(id) {
    try {
      console.log('get one employee', this.baseURL);
      const response = await fetch(`${this.baseURL}/${id}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching employee:', error);
      throw error;
    }
  }

  // Get employee by email
  async getEmployeeByEmail(email) {
    try {
      const response = await fetch(`${this.baseURL}/by-email/${encodeURIComponent(email)}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching employee by email:', error);
      throw error;
    }
  }

  // Get remarks for an employee (latest first). Requires Admin/HOD.
  async getEmployeeRemarks(employeeId) {
    try {
      const response = await fetch(`${this.baseURL}/${employeeId}/remarks`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || `HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching employee remarks:', error);
      throw error;
    }
  }

  // Add a remark for an employee. Requires Admin/HOD. text cannot be empty.
  async addEmployeeRemark(employeeId, text) {
    try {
      const trimmed = (text || '').trim();
      if (!trimmed) throw new Error('Remark text cannot be empty');
      const response = await fetch(`${this.baseURL}/${employeeId}/remarks`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ text: trimmed }),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || `HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error adding employee remark:', error);
      throw error;
    }
  }

  // Add an increment for an employee. Requires Admin/HOD.
  async addEmployeeIncrement(employeeId, incrementData) {
    try {
      const response = await fetch(`${this.baseURL}/${employeeId}/increments`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(incrementData),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || `HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error adding employee increment:', error);
      throw error;
    }
  }

  // Update an increment for an employee. Requires Admin/HOD.
  async updateEmployeeIncrement(employeeId, incrementId, incrementData) {
    try {
      const response = await fetch(`${this.baseURL}/${employeeId}/increments/${incrementId}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(incrementData),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || `HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error updating employee increment:', error);
      throw error;
    }
  }

  // Delete an increment for an employee. Requires Admin/HOD.
  async deleteEmployeeIncrement(employeeId, incrementId) {
    try {
      const response = await fetch(`${this.baseURL}/${employeeId}/increments/${incrementId}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || `HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error deleting employee increment:', error);
      throw error;
    }
  }

  // Create new employee
  async createEmployee(employeeData) {
    try {
      console.log('Creating employee at:', this.baseURL);
      console.log('Employee data:', employeeData);

      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(employeeData),
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      this.invalidateCache();
      return await response.json();
    } catch (error) {
      console.error('Error creating employee:', error);
      throw error;
    }
  }

  // // Update employee
  // async updateEmployee(id, employeeData) {
  //   try {
  //     const formData = new FormData();
  //     formData.append('data', JSON.stringify(employeeData));

  //     console.log('Updating employee at:', this.baseURL);
  //     console.log('Employee data:', employeeData);

  //     if (employeeData.profilePhotoFile) {
  //       formData.append('profilePhoto', employeeData.profilePhotoFile);
  //     }

  //     const response = await fetch(`${this.baseURL}/${id}`, {
  //       method: 'PUT',
  //       headers: {
  //         'Authorization': `Bearer ${localStorage.getItem('token')}`
  //       },
  //       body: formData,
  //     });

  //     if (!response.ok) {
  //       const errorData = await response.json();
  //       throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  //     }

  //     return await response.json();
  //   } catch (error) {
  //     console.error('Error updating employee:', error);
  //     throw error;
  //   }
  // }


  // Update employee (supports both with and without file)
// EmployeeService.js - updateEmployee method
async updateEmployee(id, employeeData, profileImageFile = null) {
  try {
    const formData = new FormData();
    
    // Clean the data
    const dataToSend = { ...employeeData };
    
    // If profileImageFile is a base64 string, include it in the data payload
    if (typeof profileImageFile === 'string' && profileImageFile.startsWith('data:')) {
      dataToSend.profilePhoto = profileImageFile;
      profileImageFile = null;
    }
    
    // Make sure assignedProjects is an array
    if (dataToSend.assignedProjects) {
      if (!Array.isArray(dataToSend.assignedProjects)) {
        dataToSend.assignedProjects = [dataToSend.assignedProjects];
      }
      // Remove any null/undefined values
      dataToSend.assignedProjects = dataToSend.assignedProjects.filter(Boolean);
    }
    
    formData.append('data', JSON.stringify(dataToSend));

    if (profileImageFile) {
      console.log('📤 Adding profile image:', profileImageFile.name);
      formData.append('profilePhoto', profileImageFile);
    }

    const response = await fetch(`${this.baseURL}/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: formData,
    });

    console.log('📥 Response status:', response.status);
    
    let responseData;
    try {
      responseData = await response.json();
    } catch (jsonError) {
      const text = await response.text();
      console.error('Failed to parse JSON:', text.substring(0, 200));
      throw new Error(`Server returned invalid JSON (${response.status}): ${text.substring(0, 100)}`);
    }

    if (!response.ok) {
      console.error('Server error response:', responseData);
      throw new Error(responseData.message || `HTTP error! status: ${response.status}`);
    }

    console.log('✅ Employee update successful:', responseData);
    this.invalidateCache();
    return responseData.employee || responseData;

  } catch (error) {
    console.error('❌ Error updating employee:', {
      message: error.message,
      stack: error.stack
    });
    throw error;
  }
}

// Remove or keep updateEmployeeWithFile if needed elsewhere
// async updateEmployeeWithFile(id, employeeData, profileImageFile) {
//   return this.updateEmployee(id, employeeData, profileImageFile);
// }

  // Delete employee
  async deleteEmployee(id) {
    try {
      console.log(`[EmployeeService] Deleting employee ${id}...`);
      const response = await fetch(`${this.baseURL}/${id}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
      });

      console.log(`[EmployeeService] Delete response status: ${response.status}`);

      if (!response.ok) {
        const text = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(text);
        } catch (e) {
          console.error(`[EmployeeService] Failed to parse error JSON. Body:`, text.substring(0, 200));
          errorData = { message: `HTTP error! status: ${response.status}. Response is not JSON.` };
        }
        console.error(`[EmployeeService] Delete failed:`, errorData);
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      this.invalidateCache();
      return await response.json();
    } catch (error) {
      console.error('Error deleting employee:', error);
      throw error;
    }
  }

  // Bulk delete employees
  async bulkDeleteEmployees(ids) {
    try {
      const response = await fetch(`${this.baseURL}/bulk-delete`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ ids }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      this.invalidateCache();
      return await response.json();
    } catch (error) {
      console.error('Error bulk deleting employees:', error);
      throw error;
    }
  }

  // Create employee with profile photo
  // async createEmployeeWithFile(employeeData, profileImage) {
  //   try {
  //     console.log('Creating employee with file at:', this.baseURL);
  //     console.log('Profile image:', profileImage);

  //     const token = localStorage.getItem("token");
  //     const formDataToSend = new FormData();

  //     // Append employee data as JSON string
  //     formDataToSend.append("data", JSON.stringify(employeeData));

  //     // Append profile image if provided
  //     if (profileImage) {
  //       console.log('Appending profile image:', profileImage.name, profileImage.type, profileImage.size);
  //       formDataToSend.append("profilePhoto", profileImage);
  //     }

  //     const response = await fetch(this.baseURL, {
  //       method: "POST",
  //       headers: {
  //         Authorization: `Bearer ${token}`
  //       },
  //       body: formDataToSend,
  //     });

  //     console.log('Response status:', response.status);

  //     if (!response.ok) {
  //       let errorMessage = "Failed to create employee with file";
  //       try {
  //         const errorData = await response.json();
  //         errorMessage = errorData.message || errorMessage;
  //       } catch (e) {
  //         errorMessage = `${errorMessage}: ${response.status} ${response.statusText}`;
  //       }
  //       throw new Error(errorMessage);
  //     }

  //     return await response.json();
  //   } catch (error) {
  //     console.error('Error in createEmployeeWithFile:', error);
  //     throw error;
  //   }
  // }

  async createEmployeeWithFile(employeeData, profileImageFile = null) {
  try {
    const formData = new FormData();
    
    const dataToSend = { ...employeeData };
    delete dataToSend.profilePhotoFile;
    
    // If profileImageFile is a base64 string, include it in the data payload
    if (typeof profileImageFile === 'string' && profileImageFile.startsWith('data:')) {
      dataToSend.profilePhoto = profileImageFile;
      profileImageFile = null;
    }
    
    formData.append('data', JSON.stringify(dataToSend));

    if (profileImageFile) {
      formData.append('profilePhoto', profileImageFile);
    }

    const response = await fetch(`${this.baseURL}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: formData,
    });

    const responseData = await response.json();

    if (!response.ok) {
      // Handle duplicate email error specifically
      if (response.status === 400 && responseData.error?.includes('Duplicate')) {
        throw new Error(responseData.message || 'Duplicate entry found');
      }
      throw new Error(responseData.message || `HTTP error! status: ${response.status}`);
    }

    this.invalidateCache();
    return responseData;
  } catch (error) {
    console.error('Error creating employee:', error);
    throw error;
  }
}

  async importEmployeesFromExcel(file) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${this.baseURL}/import`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: formData,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || `Import failed (${response.status})`);
    }
    this.invalidateCache();
    return data;
  }

  // Update employee with profile photo
  async updateEmployeeWithFile(id, employeeData, profileImage) {
    try {
      console.log('Updating employee with file at:', `${this.baseURL}/${id}`);
      console.log('Profile image for update:', profileImage);

      const token = localStorage.getItem("token");
      const formDataToSend = new FormData();

      // Append employee data as JSON string
      const dataToSend = { ...employeeData };
      if (typeof profileImage === 'string' && profileImage.startsWith('data:')) {
        dataToSend.profilePhoto = profileImage;
        profileImage = null;
      }
      formDataToSend.append("data", JSON.stringify(dataToSend));

      // Append profile image if provided
      if (profileImage) {
        console.log('Appending profile image for update:', profileImage.name, profileImage.type, profileImage.size);
        formDataToSend.append("profilePhoto", profileImage);
      }

      const response = await fetch(`${this.baseURL}/${id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formDataToSend,
      });

      console.log('Update response status:', response.status);

      if (!response.ok) {
        let errorMessage = "Failed to update employee with file";
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          errorMessage = `${errorMessage}: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const body = await response.json();
      this.invalidateCache();
      return body.employee || body;
    } catch (error) {
      console.error('Error in updateEmployeeWithFile:', error);
      throw error;
    }
  }

  // Additional employee-specific methods
  async getEmployeesByDepartment(department) {
    try {
      const response = await fetch(`${this.baseURL}/department/${department}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching employees by department:', error);
      throw error;
    }
  }

  async updateEmployeeAttendance(id, attendanceStatus) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await fetch(this.attendanceURL, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          employeeId: id,
          date: today,
          status: attendanceStatus
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return {
        ...data,
        employee: {
          _id: id,
          attendance: attendanceStatus
        }
      };
    } catch (error) {
      console.error('Error updating employee attendance:', error);
      throw error;
    }
  }

  /**
   * Early or extended return from vacation.
   * Updates leave end date, vacation status, return dates, attendance.
   */
  async markVacationReturn(employeeId, { returnDate, firstWorkingDay, leaveId } = {}) {
    try {
      const response = await fetch(`${this.baseURL}/${employeeId}/vacation-return`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ returnDate, firstWorkingDay, leaveId }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      this.invalidateCache();
      return await response.json();
    } catch (error) {
      console.error('Error marking vacation return:', error);
      throw error;
    }
  }

  async assignProjectToEmployee(id, projectName) {
    try {
      const response = await fetch(`${this.baseURL}/${id}/projects`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ project: projectName }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error assigning project to employee:', error);
      throw error;
    }
  }

  async removeProjectFromEmployee(id, projectName) {
    try {
      const response = await fetch(`${this.baseURL}/${id}/projects`, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ project: projectName }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error removing project from employee:', error);
      throw error;
    }
  }
}

export default new EmployeeService();