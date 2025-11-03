/**
 * Poll Google Photos Picker Session Status
 * GET /api/google-photos/poll-session/[sessionId]
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPickerSession, refreshAccessToken, isTokenExpired } from '@/lib/google-photos';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

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

    // Poll Google Photos API
    const session = await getPickerSession(sessionId, accessToken);

    // Update session in database
    await supabase
      .from('google_photos_sessions')
      .update({
        media_items_set: session.mediaItemsSet || false,
        status: session.mediaItemsSet ? 'completed' : 'pending',
        ...(session.mediaItemsSet && { completed_at: new Date().toISOString() }),
      })
      .eq('id', sessionId);

    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        mediaItemsSet: session.mediaItemsSet || false,
        pollingConfig: session.pollingConfig,
      },
    });
  } catch (error) {
    console.error('Poll session error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      { error: 'Failed to poll session', message: errorMessage },
      { status: 500 }
    );
  }
}
