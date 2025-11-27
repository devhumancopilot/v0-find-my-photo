/**
 * Create Google Photos Picker Session
 * POST /api/google-photos/create-session
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  createPickerSession,
  refreshAccessToken,
  isTokenExpired,
  validateGooglePhotosConfig,
} from '@/lib/google-photos';

export async function POST(request: NextRequest) {
  try {
    // Validate configuration
    validateGooglePhotosConfig();

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'You must be logged in to use this feature' },
        { status: 401 }
      );
    }

    // Get user's Google tokens from profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('google_access_token, google_refresh_token, google_token_expires_at, google_photos_connected')
      .eq('id', user.id)
      .maybeSingle();

    // If profile doesn't exist, create one
    if (!profile) {
      console.log('Profile not found for user, creating one...');
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          display_name: user.email,
        })
        .select('google_access_token, google_refresh_token, google_token_expires_at, google_photos_connected')
        .single();

      if (createError || !newProfile) {
        console.error('Failed to create profile:', createError);
        return NextResponse.json(
          {
            error: 'Profile creation failed',
            message: 'Failed to create user profile. Please try again.',
          },
          { status: 500 }
        );
      }

      // Use the newly created profile (which has no Google tokens yet)
      return NextResponse.json(
        {
          error: 'Not connected',
          message: 'Please connect your Google Photos account first',
          requiresAuth: true,
        },
        { status: 403 }
      );
    }

    if (profileError) {
      console.error('Profile query error:', profileError);
      return NextResponse.json(
        { error: 'Profile query failed', message: 'Failed to retrieve user profile' },
        { status: 500 }
      );
    }

    // Check if user has connected Google Photos
    if (!profile.google_photos_connected || !profile.google_access_token) {
      return NextResponse.json(
        {
          error: 'Not connected',
          message: 'Please connect your Google Photos account first',
          requiresAuth: true,
        },
        { status: 403 }
      );
    }

    let accessToken = profile.google_access_token;

    // Check if token is expired and refresh if needed
    if (
      profile.google_token_expires_at &&
      isTokenExpired(new Date(profile.google_token_expires_at))
    ) {
      if (!profile.google_refresh_token) {
        return NextResponse.json(
          {
            error: 'Token expired',
            message: 'Your Google Photos connection has expired. Please reconnect.',
            requiresAuth: true,
          },
          { status: 401 }
        );
      }

      try {
        // Refresh the access token
        const tokens = await refreshAccessToken(profile.google_refresh_token);
        accessToken = tokens.access_token;

        // Update tokens in database
        const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
        await supabase
          .from('profiles')
          .update({
            google_access_token: tokens.access_token,
            google_token_expires_at: expiresAt.toISOString(),
          })
          .eq('id', user.id);
      } catch (refreshError) {
        console.error('Failed to refresh token:', refreshError);
        return NextResponse.json(
          {
            error: 'Token refresh failed',
            message: 'Failed to refresh access token. Please reconnect your Google Photos account.',
            requiresAuth: true,
          },
          { status: 401 }
        );
      }
    }

    // Create Google Photos Picker session
    const session = await createPickerSession(accessToken);

    // Store session in database
    const { error: sessionError } = await supabase
      .from('google_photos_sessions')
      .insert({
        id: session.id,
        user_id: user.id,
        picker_uri: session.pickerUri,
        status: 'pending',
        media_items_set: false,
      });

    if (sessionError) {
      console.error('Failed to store session:', sessionError);
      // Continue anyway - session creation succeeded
    }

    // Return session info
    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        pickerUri: session.pickerUri,
        pollingConfig: session.pollingConfig,
      },
    });
  } catch (error) {
    console.error('Create session error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isAuthError = errorMessage.includes('Unauthorized') || errorMessage.includes('expired');

    return NextResponse.json(
      {
        error: 'Session creation failed',
        message: errorMessage,
        requiresAuth: isAuthError,
      },
      { status: isAuthError ? 401 : 500 }
    );
  }
}
