/**
 * React Hook for Google Photos Picker Integration
 * Handles authentication, session creation, polling, and media retrieval
 */

'use client';

import { useState, useCallback } from 'react';

interface PickedMediaItem {
  id: string;
  baseUrl: string;
  mimeType: string;
  filename?: string;
}

interface UseGooglePhotosReturn {
  // State
  isConnected: boolean;
  isConnecting: boolean;
  isLoading: boolean;
  error: string | null;
  selectedPhotos: PickedMediaItem[];

  // Actions
  connectGooglePhotos: (returnUrl?: string) => void;
  openPhotoPicker: () => Promise<void>;
  reset: () => void;
}

export function useGooglePhotos(): UseGooglePhotosReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<PickedMediaItem[]>([]);

  /**
   * Initiate Google Photos OAuth flow
   */
  const connectGooglePhotos = useCallback((returnUrl?: string) => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const redirectUri = process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      setError('Google Photos is not configured. Please contact support.');
      return;
    }

    setIsConnecting(true);
    setError(null);

    // Build OAuth URL
    const state = returnUrl ? encodeURIComponent(returnUrl) : '';
    const scope = 'https://www.googleapis.com/auth/photospicker.mediaitems.readonly';

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scope,
      access_type: 'offline',
      prompt: 'consent',
      ...(state && { state }),
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    // Redirect to Google OAuth
    window.location.href = authUrl;
  }, []);

  /**
   * Open Google Photos Picker and handle selection
   */
  const openPhotoPicker = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setSelectedPhotos([]);

    try {
      // Step 1: Create picker session
      const createResponse = await fetch('/api/google-photos/create-session', {
        method: 'POST',
      });

      if (!createResponse.ok) {
        const data = await createResponse.json();

        // If requires auth, redirect to OAuth
        if (data.requiresAuth) {
          const currentPath = window.location.pathname;
          connectGooglePhotos(currentPath);
          return;
        }

        throw new Error(data.message || 'Failed to create picker session');
      }

      const { session } = await createResponse.json();

      // Step 2: Open picker in new window
      const pickerWindow = window.open(
        session.pickerUri,
        'GooglePhotosPicker',
        'width=800,height=600,scrollbars=yes'
      );

      if (!pickerWindow) {
        throw new Error('Failed to open picker window. Please allow popups for this site.');
      }

      // Step 3: Poll for completion
      const pollInterval = session.pollingConfig?.pollInterval?.seconds || 2;
      const sessionTimeout = session.pollingConfig?.sessionTimeout?.seconds || 300;

      const startTime = Date.now();
      let mediaItemsSet = false;

      const poll = async (): Promise<void> => {
        // Check timeout
        if ((Date.now() - startTime) / 1000 > sessionTimeout) {
          throw new Error('Session timeout: Please try again');
        }

        try {
          const pollResponse = await fetch(`/api/google-photos/poll-session/${session.id}`);

          if (!pollResponse.ok) {
            throw new Error('Failed to poll session status');
          }

          const pollData = await pollResponse.json();
          mediaItemsSet = pollData.session.mediaItemsSet;

          if (mediaItemsSet) {
            // Close picker window
            if (pickerWindow && !pickerWindow.closed) {
              pickerWindow.close();
            }

            // Step 4: Retrieve selected media items
            await retrieveMediaItems(session.id);
          } else {
            // Continue polling
            setTimeout(poll, pollInterval * 1000);
          }
        } catch (err) {
          // If window was closed manually, stop polling
          if (pickerWindow && pickerWindow.closed) {
            throw new Error('Photo selection was cancelled');
          }
          throw err;
        }
      };

      // Start polling
      await poll();
      setIsConnected(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Photo picker error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [connectGooglePhotos]);

  /**
   * Retrieve media items from completed session
   */
  const retrieveMediaItems = async (sessionId: string) => {
    const allItems: PickedMediaItem[] = [];
    let pageToken: string | undefined;

    do {
      const params = new URLSearchParams({
        sessionId,
        ...(pageToken && { pageToken }),
      });

      const response = await fetch(`/api/google-photos/media-items?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to retrieve selected photos');
      }

      const data = await response.json();
      allItems.push(...data.mediaItems);
      pageToken = data.nextPageToken;
    } while (pageToken);

    setSelectedPhotos(allItems);
  };

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    setError(null);
    setSelectedPhotos([]);
    setIsLoading(false);
  }, []);

  return {
    isConnected,
    isConnecting,
    isLoading,
    error,
    selectedPhotos,
    connectGooglePhotos,
    openPhotoPicker,
    reset,
  };
}
