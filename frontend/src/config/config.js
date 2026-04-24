// All API calls use this; ensure REACT_APP_API_URL is set for local backend (e.g. http://localhost:5000)
console.log('API BASE URL:', process.env.REACT_APP_API_URL);

// Automatically detect if we are running locally
const isLocalhost = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || 
   window.location.hostname === '127.0.0.1' || 
   window.location.hostname.startsWith('192.168.'));

const config = {
  API_BASE_URL: process.env.REACT_APP_API_URL || 
    (isLocalhost ? 'http://localhost:5000/api' : 'https://backend.sonashi.in/api'),
  // Add other configuration variables here
};

/**
 * Returns the base URL for API requests (no trailing /api).
 * When REACT_APP_API_URL is set, always use it so requests go to that backend (e.g. localhost:5000).
 * Otherwise uses Hostinger backend.
 */
export function getApiBaseUrl() {
  const env = process.env.REACT_APP_API_URL;
  if (env) {
    const v = String(env).trim();
    if (v.startsWith('http://') || v.startsWith('https://')) {
      return v.replace(/\/api\/?$/, '');
    }
    // Relative API root (e.g. "/api") — assume Hostinger backend
    return isLocalhost ? 'http://localhost:5000' : 'https://backend.sonashi.in';
  }
  if (typeof window !== 'undefined' && window.location.origin === 'https://backend.sonashi.in') {
    return ''; // relative URL - only for same-origin backend
  }
  return isLocalhost ? 'http://localhost:5000' : 'https://backend.sonashi.in';
}

/**
 * Returns full URL for auth endpoints (e.g. /api/auth/login).
 */
export function getAuthApiUrl(path) {
  const base = getApiBaseUrl();
  return base ? `${base}/api/auth${path}` : `/api/auth${path}`;
}

export default config;
