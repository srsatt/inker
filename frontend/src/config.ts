/**
 * Dynamic Configuration
 *
 * This file provides dynamic configuration that adapts to the server's IP/hostname.
 *
 * HOW IT WORKS:
 * - Browser and device traffic use one public origin.
 * - In Vite dev, /api and /uploads are proxied to the internal backend.
 * - In single/prod mode, the backend serves both API and frontend assets.
 */

// Get the current hostname from the browser
const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';

// Public browser/device port. In dev this is Vite; in single/prod this is Nest.
const PUBLIC_PORT = typeof window !== 'undefined' ? window.location.port || '80' : '3337';

// Backend public URL for external domain access (e.g., https://api.your-domain.com)
// When set, /uploads/* paths will be prefixed with this URL
const BACKEND_PUBLIC_URL = import.meta.env.VITE_BACKEND_PUBLIC_URL || '';

/**
 * Application configuration object
 * Uses same-origin URLs so TRMNL always talks to the same public port.
 */
export const config = {
  // Current hostname (e.g., "192.168.1.100" or "your-domain.com")
  hostname,

  // Public app port
  backendPort: PUBLIC_PORT,

  // API base URL
  apiUrl: '/api',

  // Full backend URL (for images, downloads, etc.)
  backendUrl: '',

  // Helper to construct backend URLs
  getBackendUrl: (path: string = '') => {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return cleanPath;
  },

  // Helper to construct asset URLs (images, uploads)
  // Transforms /uploads/* paths to use VITE_BACKEND_PUBLIC_URL when configured
  getAssetUrl: (path: string) => {
    if (!path) return path;
    // Only transform /uploads/ paths when backend public URL is configured
    if (path.startsWith('/uploads/') && BACKEND_PUBLIC_URL) {
      // Remove trailing slash from URL if present
      const baseUrl = BACKEND_PUBLIC_URL.replace(/\/$/, '');
      return `${baseUrl}${path}`;
    }
    return path;
  },
};

// Log configuration in development for debugging
if (import.meta.env.DEV) {
  console.log('Dynamic Config:', {
    hostname: config.hostname,
    apiUrl: config.apiUrl,
    backendUrl: config.backendUrl,
    backendPublicUrl: BACKEND_PUBLIC_URL || '(not set)',
  });
}

export default config;
