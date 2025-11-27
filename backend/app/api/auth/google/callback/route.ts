/**
 * Google OAuth 2.0 Callback Handler
 * Handles the OAuth callback from Google and stores tokens
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { exchangeCodeForTokens } from '@/lib/google-photos';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const state = searchParams.get('state');

  // Handle user denied access
  if (error) {
    console.error('OAuth error:', error);
    return NextResponse.redirect(
      new URL(`/dashboard?error=google_auth_denied&message=${encodeURIComponent(error)}`, request.url)
    );
  }

  // Validate authorization code
  if (!code) {
    return NextResponse.redirect(
      new URL('/dashboard?error=missing_code', request.url)
    );
  }

  try {
    // Exchange authorization code for tokens
    const tokens = await exchangeCodeForTokens(code);

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('Failed to get authenticated user:', userError);
      return NextResponse.redirect(
        new URL('/dashboard?error=authentication_required', request.url)
      );
    }

    // Calculate token expiration time
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Ensure profile exists before storing tokens
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (!existingProfile) {
      // Create profile if it doesn't exist
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          display_name: user.email,
          google_access_token: tokens.access_token,
          google_refresh_token: tokens.refresh_token,
          google_token_expires_at: expiresAt.toISOString(),
          google_photos_connected: true,
          google_photos_connected_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error('Failed to create profile with Google tokens:', insertError);
        return NextResponse.redirect(
          new URL('/dashboard?error=profile_creation_failed', request.url)
        );
      }
    } else {
      // Update existing profile with Google tokens
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          google_access_token: tokens.access_token,
          google_refresh_token: tokens.refresh_token,
          google_token_expires_at: expiresAt.toISOString(),
          google_photos_connected: true,
          google_photos_connected_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('Failed to update profile with Google tokens:', updateError);
        return NextResponse.redirect(
          new URL('/dashboard?error=token_storage_failed', request.url)
        );
      }
    }

    // Success - redirect back to upload page or dashboard
    const returnUrl = state ? decodeURIComponent(state) : '/upload-photos';
    return NextResponse.redirect(
      new URL(`${returnUrl}?success=google_photos_connected`, request.url)
    );
  } catch (err) {
    console.error('OAuth callback error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';

    return NextResponse.redirect(
      new URL(`/dashboard?error=oauth_failed&message=${encodeURIComponent(errorMessage)}`, request.url)
    );
  }
}
