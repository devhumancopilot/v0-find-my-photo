/**
 * Application Configuration
 * Centralized config for backend API URL
 */

/**
 * Get the backend API URL
 * - In production: Uses NEXT_PUBLIC_BACKEND_URL from environment
 * - In development: Falls back to localhost:3001
 */
export const getBackendURL = (): string => {
  // Use environment variable if set, otherwise default to localhost
  const backendURL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'

  // Remove trailing slash if present
  return backendURL.endsWith('/') ? backendURL.slice(0, -1) : backendURL
}

/**
 * Construct a full backend API URL from a path
 * @param path - API path (e.g., '/api/photos/upload')
 * @returns Full URL to backend API endpoint
 */
export function getBackendAPIURL(path: string): string {
  const baseURL = getBackendURL()
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${baseURL}${cleanPath}`
}
