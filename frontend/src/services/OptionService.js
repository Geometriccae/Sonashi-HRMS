import axios from 'axios';
import config from '../config/config';

const API_URL = `${config.API_BASE_URL}/options`;

const CACHE_TTL_MS = 300000; // 5 minutes — options change rarely
const _cache = {};
const _inflight = {};

const cacheGet = (key) => {
  const entry = _cache[key];
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    delete _cache[key];
    return null;
  }
  return entry.data;
};

const cacheSet = (key, data) => {
  _cache[key] = { data, ts: Date.now() };
};

const getOptions = async (type) => {
  const key = `opts:${type}`;
  const cached = cacheGet(key);
  if (cached) return cached;
  if (_inflight[key]) return _inflight[key];
  _inflight[key] = (async () => {
    try {
      const response = await axios.get(`${API_URL}/${type}`);
      cacheSet(key, response.data);
      return response.data;
    } finally {
      delete _inflight[key];
    }
  })();
  return _inflight[key];
};

const addOption = async (type, label) => {
  const token = localStorage.getItem('token');
  const response = await axios.post(
    `${API_URL}/${type}`,
    { label },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  delete _cache[`opts:${type}`];
  delete _cache[`excluded:${type}`];
  return response.data;
};

const deleteOption = async (type, id) => {
  const token = localStorage.getItem('token');
  const response = await axios.delete(
    `${API_URL}/${type}/${id}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  delete _cache[`opts:${type}`];
  delete _cache[`excluded:${type}`];
  return response.data;
};

const getExcludedDefaults = async (type) => {
  const key = `excluded:${type}`;
  const cached = cacheGet(key);
  if (cached) return cached;
  if (_inflight[key]) return _inflight[key];
  _inflight[key] = (async () => {
    try {
      const response = await axios.get(`${API_URL}/${type}/excluded`);
      cacheSet(key, response.data);
      return response.data;
    } finally {
      delete _inflight[key];
    }
  })();
  return _inflight[key];
};

const excludeDefaultOption = async (type, label) => {
  const token = localStorage.getItem('token');
  const response = await axios.post(
    `${API_URL}/${type}/exclude-default`,
    { label },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  delete _cache[`opts:${type}`];
  delete _cache[`excluded:${type}`];
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
