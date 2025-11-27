import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST: Create or update an upload session
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { session_id, total_photos, uploaded_count, failed_count, status, chunks, errors } = body;

    if (!session_id) {
      return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
    }

    console.log(`[Upload Session API] Saving session ${session_id} for user ${user.id}`);

    // Check if session exists
    const { data: existing } = await supabase
      .from('upload_sessions')
      .select('id')
      .eq('session_id', session_id)
      .eq('user_id', user.id)
      .single();

    if (existing) {
      // Update existing session
      const { data, error } = await supabase
        .from('upload_sessions')
        .update({
          total_photos,
          uploaded_count,
          failed_count,
          status,
          chunks,
          errors,
          last_activity_at: new Date().toISOString(),
          completed_at: status === 'completed' ? new Date().toISOString() : null,
        })
        .eq('session_id', session_id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        console.error('[Upload Session API] Update error:', error);
        return NextResponse.json({ error: 'Failed to update session', details: error.message }, { status: 500 });
      }

      console.log(`[Upload Session API] ✅ Updated session ${session_id}`);

      return NextResponse.json({ success: true, session: data });
    } else {
      // Create new session
      const { data, error } = await supabase
        .from('upload_sessions')
        .insert({
          session_id,
          user_id: user.id,
          total_photos,
          uploaded_count: uploaded_count || 0,
          failed_count: failed_count || 0,
          status: status || 'in_progress',
          chunks: chunks || [],
          errors: errors || [],
          last_activity_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('[Upload Session API] Insert error:', error);
        return NextResponse.json({ error: 'Failed to create session', details: error.message }, { status: 500 });
      }

      console.log(`[Upload Session API] ✅ Created session ${session_id}`);

      return NextResponse.json({ success: true, session: data });
    }
  } catch (error) {
    console.error('[Upload Session API] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET: Retrieve upload session by session_id
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const session_id = searchParams.get('session_id');

    if (!session_id) {
      // Return all in-progress sessions for user
      const { data: sessions, error } = await supabase
        .from('upload_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'in_progress')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('[Upload Session API] Query error:', error);
        return NextResponse.json({ error: 'Failed to fetch sessions', details: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, sessions: sessions || [] });
    }

    // Return specific session
    const { data: session, error } = await supabase
      .from('upload_sessions')
      .select('*')
      .eq('session_id', session_id)
      .eq('user_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      console.error('[Upload Session API] Query error:', error);
      return NextResponse.json({ error: 'Failed to fetch session', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, session });
  } catch (error) {
    console.error('[Upload Session API] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE: Cancel and delete an upload session
 */
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const session_id = searchParams.get('session_id');

    if (!session_id) {
      return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
    }

    console.log(`[Upload Session API] Deleting session ${session_id}`);

    const { error } = await supabase
      .from('upload_sessions')
      .delete()
      .eq('session_id', session_id)
      .eq('user_id', user.id);

    if (error) {
      console.error('[Upload Session API] Delete error:', error);
      return NextResponse.json({ error: 'Failed to delete session', details: error.message }, { status: 500 });
    }

    console.log(`[Upload Session API] ✅ Deleted session ${session_id}`);

    return NextResponse.json({ success: true, message: 'Session deleted' });
  } catch (error) {
    console.error('[Upload Session API] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
