/**
 * Retrieve Media Items from Google Photos Picker Session
 * GET /api/google-photos/media-items?sessionId=xxx&pageToken=xxx
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  listMediaItems,
  refreshAccessToken,
  isTokenExpired,
  deletePickerSession,
} from '@/lib/google-photos';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get('sessionId');
    const pageToken = searchParams.get('pageToken') || undefined;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing sessionId parameter' },
        { status: 400 }
      );
    }

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify session belongs to user
    const { data: dbSession, error: sessionError } = await supabase
      .from('google_photos_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (sessionError || !dbSession) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Check if session is ready
    if (!dbSession.media_items_set) {
      return NextResponse.json(
        { error: 'Session not ready', message: 'User has not completed photo selection' },
        { status: 400 }
      );
    }

    // Get user's access token
    const { data: profile } = await supabase
      .from('profiles')
      .select('google_access_token, google_refresh_token, google_token_expires_at')
      .eq('id', user.id)
      .single();

    if (!profile?.google_access_token) {
      return NextResponse.json(
        { error: 'Google Photos not connected' },
        { status: 403 }
      );
    }

    let accessToken = profile.google_access_token;

    // Refresh token if expired
    if (
      profile.google_token_expires_at &&
      isTokenExpired(new Date(profile.google_token_expires_at)) &&
      profile.google_refresh_token
    ) {
      const tokens = await refreshAccessToken(profile.google_refresh_token);
      accessToken = tokens.access_token;

      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
      await supabase
        .from('profiles')
        .update({
          google_access_token: tokens.access_token,
          google_token_expires_at: expiresAt.toISOString(),
        })
        .eq('id', user.id);
    }

    // Get media items from Google Photos
    const response = await listMediaItems(sessionId, accessToken, pageToken);

    // Map the nested structure to a flat structure for frontend
    // Google Photos API returns: { mediaFile: { baseUrl, mimeType, filename } }
    // We need: { baseUrl, mimeType, filename }
    const mappedItems = (response.mediaItems || []).map((item) => ({
      id: item.id,
      baseUrl: item.mediaFile.baseUrl,
      mimeType: item.mediaFile.mimeType,
      filename: item.mediaFile.filename || `photo-${item.id}.jpg`,
    }));

    console.log(`Successfully retrieved ${mappedItems.length} Google Photos media items`);

    // Clean up session if all items retrieved (no next page)
    if (!response.nextPageToken) {
      // Delete session from Google (best effort)
      deletePickerSession(sessionId, accessToken).catch((err) => {
        console.error('Failed to cleanup Google session:', err);
      });

      // Mark session as completed in database
      await supabase
        .from('google_photos_sessions')
        .update({ status: 'completed' })
        .eq('id', sessionId);
    }

    return NextResponse.json({
      success: true,
      mediaItems: mappedItems,
      nextPageToken: response.nextPageToken,
      hasMore: !!response.nextPageToken,
    });
  } catch (error) {
    console.error('Get media items error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      { error: 'Failed to retrieve media items', message: errorMessage },
      { status: 500 }
    );
  }
}
