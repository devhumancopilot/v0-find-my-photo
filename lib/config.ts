/**
 * Application Configuration
 * Centralized config for backend API URL with auth token support
 */

import { createClient } from '@/lib/supabase/client'

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

/**
 * Get the Supabase access token for authenticated requests
 * @returns Access token or null if not authenticated
 */
export async function getAuthToken(): Promise<string | null> {
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  } catch (error) {
    console.error('[Auth] Failed to get access token:', error)
    return null
  }
}

/**
 * Get headers for authenticated backend requests
 * Includes Authorization header with Supabase access token
 * @returns Headers object with auth token
 */
export async function getAuthHeaders(): Promise<HeadersInit> {
  const token = await getAuthToken()

  if (token) {
    return {
      'Authorization': `Bearer ${token}`,
    }
  }

  return {}
}
