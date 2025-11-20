/**
 * Queue Status API
 *
 * Lightweight endpoint to fetch current queue counts for real-time UI updates.
 * Used by QueueNotificationBanner to poll for status changes while processing.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = user.id

    // Fetch pending queue count
    const { count: pendingCount, error: pendingError } = await supabase
      .from('photo_processing_queue')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'pending')

    if (pendingError) {
      console.error('[Queue Status] Error fetching pending count:', pendingError)
      return NextResponse.json(
        { error: 'Failed to fetch pending count', details: pendingError.message },
        { status: 500 }
      )
    }

    // Fetch processing queue count
    const { count: processingCount, error: processingError } = await supabase
      .from('photo_processing_queue')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'processing')

    if (processingError) {
      console.error('[Queue Status] Error fetching processing count:', processingError)
      return NextResponse.json(
        { error: 'Failed to fetch processing count', details: processingError.message },
        { status: 500 }
      )
    }

    // Return the counts
    return NextResponse.json({
      success: true,
      pending_count: pendingCount || 0,
      processing_count: processingCount || 0,
      total_count: (pendingCount || 0) + (processingCount || 0),
    })
  } catch (error) {
    console.error('[Queue Status] Request error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
