/**
 * Resolve an uploaded file URL to an absolute URL that works in both
 * development (Vite proxy) and production (Nginx proxy to backend).
 *
 * On EC2 (production), images are stored in backend/uploads/ and served
 * by Nginx at /uploads/<filename>.  When the app is served at port 80 the
 * relative path /uploads/... works directly.
 *
 * During local dev, Vite's proxy config already maps /uploads → localhost:5000.
 *
 * The backend stores paths as `/uploads/<filename>`.  We just need to make
 * sure the URL is absolute so it always resolves from the correct origin.
 */
export function getImageUrl(url?: string | null): string {
  if (!url) return '';
  // Already a full URL (blob:, http:, https:) – return as-is
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) {
    return url;
  }
  // Relative path like /uploads/logo-xxx.png
  // In production Nginx serves both frontend and /uploads from same origin
  // In dev, Vite proxy handles /uploads → backend:5000
  return url.startsWith('/') ? url : `/${url}`;
}
