// Automatically detect if we are running locally
const isLocalhost = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || 
   window.location.hostname === '127.0.0.1' || 
   window.location.hostname.startsWith('192.168.') || 
   window.location.hostname.startsWith('10.') || 
   window.location.hostname.startsWith('172.') || 
   window.location.hostname.endsWith('.local') ||
   window.location.hostname === '0.0.0.0');

const config = {
  API_BASE_URL: process.env.REACT_APP_API_URL || 
    (isLocalhost ? `http://${window.location.hostname}:5000/api` : 'https://backend.sonashi.in/api'),
};

/**
 * Returns the base URL for API requests (no trailing /api).
 */
export function getApiBaseUrl() {
  const env = process.env.REACT_APP_API_URL;
  if (env) {
    return String(env).replace(/\/api\/?$/, '');
  }
  return isLocalhost ? `http://${window.location.hostname}:5000` : 'https://backend.sonashi.in';
}

/**
 * Returns full URL for an image/file path.
 * Handles absolute URLs, relative paths, and local/production switching.
 */
export function buildImageUrl(path) {
  if (!path) return '';
  
  // If it's already a full URL or base64 data, return it
  if (String(path).startsWith('data:') || /^https?:\/\//i.test(path)) return path;
  
  const base = getApiBaseUrl();
  
  // Normalize slashes (especially for paths stored with backslashes on Windows)
  const normalizedPath = String(path).replace(/\\/g, '/');
  
  // Ensure exactly one leading slash
  const cleanPath = normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;
  
  const finalUrl = `${base.replace(/\/$/, '')}${cleanPath}`;
  
  // Debug log to help identify issues in the console
  if (isLocalhost) {
    console.log(`[buildImageUrl] Input: "${path}" -> Final: "${finalUrl}"`);
  }
  
  return finalUrl;
}

/**
 * Returns full URL for auth endpoints (e.g. /api/auth/login).
 */
export function getAuthApiUrl(path) {
  const base = getApiBaseUrl();
  return `${base}/api/auth${path}`;
}

/**
 * Shared error handler for images to fallback to production backend.
 */
export const handleImageError = (e) => {
  const currentSrc = e.target.src;
  const productionBase = 'https://backend.sonashi.in';
  
  if (currentSrc && !currentSrc.startsWith(productionBase) && !currentSrc.startsWith('blob:')) {
    // Try production fallback
    try {
      const url = new URL(currentSrc);
      e.target.src = `${productionBase}${url.pathname}`;
    } catch (err) {
      e.target.style.display = 'none';
    }
  } else {
    e.target.style.display = 'none';
  }
};

export default config;

