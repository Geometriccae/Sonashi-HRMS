// All API calls use this; ensure REACT_APP_API_URL is set for local backend (e.g. http://localhost:5000)
console.log('API BASE URL:', process.env.REACT_APP_API_URL);

const config = {
  API_BASE_URL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  // Add other configuration variables here
};

/**
 * Returns the base URL for API requests (no trailing /api).
 * When REACT_APP_API_URL is set, always use it so requests go to that backend (e.g. localhost:5000).
 * Otherwise on auxincrm.cloud uses relative URL for same-origin; elsewhere uses localhost:5000.
 */
export function getApiBaseUrl() {
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL.replace(/\/api\/?$/, '');
  }
  if (typeof window !== 'undefined' && window.location.origin === 'https://auxincrm.cloud') {
    return ''; // relative URL - request goes to same origin
  }
  return 'http://localhost:5000';
}

/**
 * Returns full URL for auth endpoints (e.g. /api/auth/login).
 */
export function getAuthApiUrl(path) {
  const base = getApiBaseUrl();
  return base ? `${base}/api/auth${path}` : `/api/auth${path}`;
}

export default config;
