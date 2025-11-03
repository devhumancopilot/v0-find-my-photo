/**
 * Google Photos Picker API Integration
 * Handles OAuth 2.0 authentication and Picker API interactions
 */

const GOOGLE_OAUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_PHOTOS_PICKER_API_URL = 'https://photospicker.googleapis.com/v1';

// OAuth 2.0 scope for Google Photos Picker API
const GOOGLE_PHOTOS_SCOPE = 'https://www.googleapis.com/auth/photospicker.mediaitems.readonly';

export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface PickingSession {
  id: string;
  pickerUri: string;
  pollingConfig?: {
    pollInterval?: {
      seconds: number;
    };
    sessionTimeout?: {
      seconds: number;
    };
  };
  mediaItemsSet?: boolean;
}

export interface PickedMediaItem {
  id: string;
  baseUrl: string;
  mimeType: string;
  filename?: string;
}

export interface MediaItemsResponse {
  mediaItems: PickedMediaItem[];
  nextPageToken?: string;
}

/**
 * Generate OAuth 2.0 authorization URL
 */
export function getGoogleAuthUrl(state?: string): string {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const redirectUri = process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    throw new Error('Google OAuth credentials not configured');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_PHOTOS_SCOPE,
    access_type: 'offline', // Request refresh token
    prompt: 'consent', // Force consent screen to get refresh token
    ...(state && { state }),
  });

  return `${GOOGLE_OAUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for access and refresh tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<GoogleTokens> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Google OAuth credentials not configured');
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange code for tokens: ${error}`);
  }

  return response.json();
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<GoogleTokens> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured');
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh access token: ${error}`);
  }

  return response.json();
}

/**
 * Create a new Google Photos Picker session
 */
export async function createPickerSession(accessToken: string): Promise<PickingSession> {
  const response = await fetch(`${GOOGLE_PHOTOS_PICKER_API_URL}/sessions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}), // Empty body creates a basic session
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Failed to create picker session:', error);

    if (response.status === 401) {
      throw new Error('Unauthorized: Access token may be expired');
    }

    throw new Error(`Failed to create picker session: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get session status (polling)
 */
export async function getPickerSession(
  sessionId: string,
  accessToken: string
): Promise<PickingSession> {
  const response = await fetch(`${GOOGLE_PHOTOS_PICKER_API_URL}/sessions/${sessionId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get picker session: ${error}`);
  }

  return response.json();
}

/**
 * List media items from a completed session
 */
export async function listMediaItems(
  sessionId: string,
  accessToken: string,
  pageToken?: string
): Promise<MediaItemsResponse> {
  const params = new URLSearchParams({
    sessionId,
    ...(pageToken && { pageToken }),
  });

  const response = await fetch(
    `${GOOGLE_PHOTOS_PICKER_API_URL}/mediaItems?${params.toString()}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to list media items: ${error}`);
  }

  return response.json();
}

/**
 * Delete a picker session (cleanup)
 */
export async function deletePickerSession(
  sessionId: string,
  accessToken: string
): Promise<void> {
  const response = await fetch(`${GOOGLE_PHOTOS_PICKER_API_URL}/sessions/${sessionId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok && response.status !== 404) {
    const error = await response.text();
    console.error(`Failed to delete picker session: ${error}`);
    // Don't throw - cleanup is best-effort
  }
}

/**
 * Download photo from Google Photos base URL
 * Base URLs expire after 60 minutes
 *
 * @param baseUrl - The base URL from Google Photos
 * @param width - Desired width (e.g., 2048)
 * @param height - Desired height (e.g., 1024)
 * @returns Full URL to download the photo
 */
export function getPhotoDownloadUrl(
  baseUrl: string,
  width: number = 2048,
  height: number = 1024
): string {
  return `${baseUrl}=w${width}-h${height}`;
}

/**
 * Get thumbnail URL for a photo
 */
export function getPhotoThumbnailUrl(baseUrl: string): string {
  return `${baseUrl}=w400-h400`;
}

/**
 * Check if access token is expired or about to expire
 */
export function isTokenExpired(expiresAt: Date): boolean {
  // Consider token expired if it expires in less than 5 minutes
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
  return new Date(expiresAt) < fiveMinutesFromNow;
}

/**
 * Validate that required environment variables are set
 */
export function validateGooglePhotosConfig(): void {
  const required = [
    'NEXT_PUBLIC_GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'NEXT_PUBLIC_GOOGLE_REDIRECT_URI',
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required Google Photos environment variables: ${missing.join(', ')}\n` +
      'Please check GOOGLE_PHOTOS_SETUP.md for configuration instructions.'
    );
  }
}
