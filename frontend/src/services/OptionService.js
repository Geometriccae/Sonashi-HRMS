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

const mergeWithDynamicOptions = (defaultOptions, dbOptions) => {
  const map = new Map();
  
  // Add defaults to map
  for (const opt of defaultOptions || []) {
    if (!opt || opt.value == null) continue;
    map.set(String(opt.value).toLowerCase(), { value: opt.value, label: opt.label });
  }
  
  // Add DB options to map (overwrite or add new)
  for (const opt of dbOptions || []) {
    const val = String(opt.label || opt.value || "").trim();
    if (!val) continue;
    const key = val.toLowerCase();
    if (!map.has(key)) {
      map.set(key, { value: val, label: val });
    }
  }
  
  // Create final list starting with defaults (preserve order)
  const result = [...(defaultOptions || []).filter(Boolean)];
  
  // Add new dynamic options
  const newOptions = [];
  for (const [k, opt] of map.entries()) {
    const existsInDefaults = (defaultOptions || []).some(d => d && String(d.value).toLowerCase() === k);
    if (!existsInDefaults) {
      newOptions.push(opt);
    }
  }
  
  // Sort new options alphabetically
  newOptions.sort((a, b) => a.label.localeCompare(b.label));
  
  return [...result, ...newOptions];
};

const OptionService = {
  getOptions,
  addOption,
  deleteOption,
  mergeWithDynamicOptions
};

export default OptionService;
