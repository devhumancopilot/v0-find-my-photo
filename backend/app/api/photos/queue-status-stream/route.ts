/**
 * Server-Sent Events (SSE) endpoint for real-time queue status updates
 *
 * This endpoint maintains an open connection and pushes updates whenever
 * the queue status changes, providing live progress updates to the client.
 */

import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/server"

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Verify authentication
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const userId = user.id

  // Create SSE stream
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const serviceSupabase = createServiceRoleClient()

      // Function to send queue status
      const sendStatus = async () => {
        try {
          // Get pending count
          const { count: pendingCount } = await serviceSupabase
            .from('photo_processing_queue')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('status', 'pending')

          // Get processing count
          const { count: processingCount } = await serviceSupabase
            .from('photo_processing_queue')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('status', 'processing')

          // Get completed count (for total progress tracking)
          const { count: completedCount } = await serviceSupabase
            .from('photo_processing_queue')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('status', 'completed')

          const data = {
            pending_count: pendingCount || 0,
            processing_count: processingCount || 0,
            completed_count: completedCount || 0,
            timestamp: new Date().toISOString(),
          }

          // Send SSE message
          const message = `data: ${JSON.stringify(data)}\n\n`
          controller.enqueue(encoder.encode(message))

          // If no more items to process, close the stream
          if ((pendingCount || 0) === 0 && (processingCount || 0) === 0) {
            console.log('[SSE] All processing complete, closing stream')
            controller.close()
            return false // Stop interval
          }

          return true // Continue interval
        } catch (error) {
          console.error('[SSE] Error sending status:', error)
          controller.error(error)
          return false // Stop interval
        }
      }

      // Send initial status
      const shouldContinue = await sendStatus()

      if (shouldContinue) {
        // Poll every 2 seconds and push updates
        const intervalId = setInterval(async () => {
          const shouldContinue = await sendStatus()
          if (!shouldContinue) {
            clearInterval(intervalId)
          }
        }, 2000)

        // Clean up on client disconnect
        request.signal.addEventListener('abort', () => {
          console.log('[SSE] Client disconnected')
          clearInterval(intervalId)
          controller.close()
        })

        // Timeout after 10 minutes (Vercel limit)
        setTimeout(() => {
          console.log('[SSE] Timeout reached, closing stream')
          clearInterval(intervalId)
          controller.close()
        }, 10 * 60 * 1000)
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable buffering for nginx
    },
  })
}
