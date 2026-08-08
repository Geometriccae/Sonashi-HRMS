import axios from 'axios';
import config from '../config/config';

const API_URL = `${config.API_BASE_URL}/options`;

const getOptions = async (type) => {
  const response = await axios.get(`${API_URL}/${type}`);
  return response.data;
};

const addOption = async (type, label) => {
  const token = localStorage.getItem('token');
  const response = await axios.post(
    `${API_URL}/${type}`,
    { label },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
};

const deleteOption = async (type, id) => {
  const token = localStorage.getItem('token');
  const response = await axios.delete(
    `${API_URL}/${type}/${id}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
};

const getExcludedDefaults = async (type) => {
  const response = await axios.get(`${API_URL}/${type}/excluded`);
  return response.data;
};

const excludeDefaultOption = async (type, label) => {
  const token = localStorage.getItem('token');
  const response = await axios.post(
    `${API_URL}/${type}/exclude-default`,
    { label },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
};

const mergeWithDynamicOptions = (defaultOptions, dbOptions, excludedDefaults = []) => {
  const excluded = new Set(
    (excludedDefaults || []).map((label) => String(label || "").trim().toLowerCase()).filter(Boolean)
  );
  const visibleDefaults = (defaultOptions || []).filter((opt) => {
    if (!opt || opt.value == null) return false;
    if (!opt.value) return true;
    return !excluded.has(String(opt.value).toLowerCase());
  });

  const map = new Map();

  for (const opt of visibleDefaults) {
    map.set(String(opt.value).toLowerCase(), { value: opt.value, label: opt.label });
  }

  for (const opt of dbOptions || []) {
    const val = String(opt.label || opt.value || "").trim();
    if (!val) continue;
    const key = val.toLowerCase();
    if (!map.has(key)) {
      map.set(key, { value: val, label: val });
    }
  }

  const result = [...visibleDefaults.filter(Boolean)];

  const newOptions = [];
  for (const [k, opt] of map.entries()) {
    const existsInDefaults = visibleDefaults.some((d) => d && String(d.value).toLowerCase() === k);
    if (!existsInDefaults) {
      newOptions.push(opt);
    }
  }

  newOptions.sort((a, b) => a.label.localeCompare(b.label));

  return [...result, ...newOptions];
};

const OptionService = {
  getOptions,
  addOption,
  deleteOption,
  getExcludedDefaults,
  excludeDefaultOption,
  mergeWithDynamicOptions
};

export default OptionService;
