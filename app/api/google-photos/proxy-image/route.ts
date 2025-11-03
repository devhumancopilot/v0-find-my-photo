/**
 * Proxy endpoint for Google Photos images
 * Google Photos Picker API baseUrls require authentication to access
 * This proxy fetches images server-side with the user's access token
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { refreshAccessToken, isTokenExpired } from '@/lib/google-photos';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const imageUrl = searchParams.get('url');
    const size = searchParams.get('size') || 'w400-h400';

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'Missing url parameter' },
        { status: 400 }
      );
    }

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('Unauthorized access to proxy-image:', userError);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's Google access token
    const { data: profile } = await supabase
      .from('profiles')
      .select('google_access_token, google_refresh_token, google_token_expires_at')
      .eq('id', user.id)
      .single();

    if (!profile?.google_access_token) {
      console.error('No Google access token found for user:', user.id);
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
      console.log('Access token expired, refreshing...');
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

    // Construct the full Google Photos URL with size parameter
    const fullUrl = `${imageUrl}=${size}`;

    console.log('Fetching Google Photos image with auth:', fullUrl);

    // Fetch the image from Google Photos with authentication
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to fetch image from Google Photos:', {
        status: response.status,
        statusText: response.statusText,
        url: fullUrl,
        error: errorText,
      });

      // Return a 1x1 transparent GIF as fallback instead of JSON error
      // This prevents broken image icons in the UI
      const transparentGif = Buffer.from(
        'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
        'base64'
      );

      return new NextResponse(transparentGif, {
        status: 200,
        headers: {
          'Content-Type': 'image/gif',
          'Cache-Control': 'no-cache',
        },
      });
    }

    // Get the image data
    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    console.log('Successfully fetched Google Photos image:', {
      url: imageUrl,
      size: imageBuffer.byteLength,
      contentType,
    });

    // Return the image with appropriate headers
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Proxy image error:', error);

    // Return a 1x1 transparent GIF as fallback
    const transparentGif = Buffer.from(
      'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      'base64'
    );

    return new NextResponse(transparentGif, {
      status: 200,
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-cache',
      },
    });
  }
}
