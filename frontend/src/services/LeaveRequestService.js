import axios from "axios";
import config from "../config/config";
import employeeService from "./EmployeeService";

let baseURL = config.API_BASE_URL || '';
if (!baseURL.endsWith('/api')) {
    baseURL = baseURL.endsWith('/') ? baseURL + 'api' : baseURL + '/api';
}
const API_URL = `${baseURL}/leave-requests`;

const CACHE_TTL_MS = 180000; // 3 minutes — invalidate on writes
let _cache = { data: null, key: "", ts: 0 };
let _inflight = {};

const getAuthHeader = () => {
    const token = localStorage.getItem("token");
    return { Authorization: `Bearer ${token}` };
};

const cacheKeyFor = (params = {}) => {
    try {
        return JSON.stringify(params || {});
    } catch {
        return "";
    }
};

const invalidateLeaveCache = () => {
    _cache = { data: null, key: "", ts: 0 };
    _inflight = {};
};

const invalidateLeaveAndEmployeeCache = () => {
    invalidateLeaveCache();
    employeeService.invalidateCache();
};

const getLeaveRequests = async (params = {}) => {
    const { force = false, ...query } = params || {};
    const key = cacheKeyFor(query);
    if (force) {
        invalidateLeaveCache();
    } else if (_cache.data && _cache.key === key && Date.now() - _cache.ts < CACHE_TTL_MS) {
        return _cache.data;
    }
    if (_inflight[key]) {
        return _inflight[key];
    }
    _inflight[key] = (async () => {
        try {
            const requestParams = { ...query };
            if (force) requestParams.fresh = "1";
            const response = await axios.get(API_URL, {
                headers: getAuthHeader(),
                params: requestParams,
            });
            _cache = { data: response.data, key, ts: Date.now() };
            return response.data;
        } finally {
            delete _inflight[key];
        }
    })();
    return _inflight[key];
};

const createLeaveRequest = async (data) => {
    const response = await axios.post(API_URL, data, {
        headers: getAuthHeader()
    });
    invalidateLeaveAndEmployeeCache();
    return response.data;
};

const updateLeaveRequest = async (id, data) => {
    const response = await axios.put(`${API_URL}/${id}`, data, {
        headers: getAuthHeader()
    });
    invalidateLeaveAndEmployeeCache();
    return response.data;
};

const deleteLeaveRequest = async (id) => {
    const response = await axios.delete(`${API_URL}/${id}`, {
        headers: getAuthHeader()
    });
    invalidateLeaveAndEmployeeCache();
    return response.data;
};

const leaveRequestService = {
    getLeaveRequests,
    createLeaveRequest,
    updateLeaveRequest,
    deleteLeaveRequest,
    invalidateCache: invalidateLeaveAndEmployeeCache,
    approveLeaveRequest: async (id, status) => {
        const response = await axios.put(`${API_URL}/${id}`, { status }, {
            headers: getAuthHeader()
        });
        invalidateLeaveAndEmployeeCache();
        return response.data;
    },
    revertLeaveRequest: async (id) => {
        const response = await axios.post(`${API_URL}/${id}/revert`, {}, {
            headers: getAuthHeader()
        });
        invalidateLeaveAndEmployeeCache();
        return response.data;
    },
    bulkImport: async (leaves) => {
        const response = await axios.post(`${API_URL}/bulk-import`, { leaves }, {
            headers: getAuthHeader()
        });
        invalidateLeaveAndEmployeeCache();
        return response.data;
    },
    bulkDelete: async (ids) => {
        const response = await axios.post(`${API_URL}/bulk-delete`, { ids }, {
            headers: getAuthHeader()
        });
        invalidateLeaveAndEmployeeCache();
        return response.data;
    }
};

export default leaveRequestService;
