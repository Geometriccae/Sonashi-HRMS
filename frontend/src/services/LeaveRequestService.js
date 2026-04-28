import axios from "axios";
import config from "../config/config";

let baseURL = config.API_BASE_URL || 'http://localhost:5000/api';
if (!baseURL.endsWith('/api')) {
    baseURL = baseURL.endsWith('/') ? baseURL + 'api' : baseURL + '/api';
}
const API_URL = `${baseURL}/leave-requests`;


const getAuthHeader = () => {
    const token = localStorage.getItem("token");
    return { Authorization: `Bearer ${token}` };
};

const getLeaveRequests = async (params = {}) => {
    const response = await axios.get(API_URL, {
        headers: getAuthHeader(),
        params
    });
    return response.data;
};

const createLeaveRequest = async (data) => {
    const response = await axios.post(API_URL, data, {
        headers: getAuthHeader()
    });
    return response.data;
};

const updateLeaveRequest = async (id, data) => {
    const response = await axios.put(`${API_URL}/${id}`, data, {
        headers: getAuthHeader()
    });
    return response.data;
};

const deleteLeaveRequest = async (id) => {
    const response = await axios.delete(`${API_URL}/${id}`, {
        headers: getAuthHeader()
    });
    return response.data;
};

const leaveRequestService = {
    getLeaveRequests,
    createLeaveRequest,
    updateLeaveRequest,
    deleteLeaveRequest,
    approveLeaveRequest: async (id, status) => {
        const response = await axios.put(`${API_URL}/${id}`, { status }, {
            headers: getAuthHeader()
        });
        return response.data;
    },
    bulkImport: async (leaves) => {
        const response = await axios.post(`${API_URL}/bulk-import`, { leaves }, {
            headers: getAuthHeader()
        });
        return response.data;
    },
    bulkDelete: async (ids) => {
        const response = await axios.post(`${API_URL}/bulk-delete`, { ids }, {
            headers: getAuthHeader()
        });
        return response.data;
    }
};

export default leaveRequestService;
