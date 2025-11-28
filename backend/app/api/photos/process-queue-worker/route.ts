/**
 * Dedicated Photo Processing Worker
 *
 * This endpoint processes the photo queue in a loop until:
 * - Queue is empty, OR
 * - Approaching maxDuration timeout (4.5 min of 5 min limit)
 *
 * If queue still has photos when approaching timeout, it triggers
 * itself ONE more time to continue processing. This avoids the
 * fragile recursive fetch() pattern while still handling large queues.
 *
 * Usage:
 * - Client calls this endpoint ONCE after upload
 * - Worker processes all photos in background
 * - No need for client polling
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  generateImageCaption,
  generateImageEmbedding,
  prepareEmbeddingForStorage,
  getEmbeddingConfig
} from "@/lib/services/embeddings"
import { detectFaces } from "@/lib/services/face-detection"
import { insertFaceProfile, matchFaces } from "@/lib/services/database"

// 5 minute timeout - enough to process 10-15 photos
export const maxDuration = 300

// Helper function to sleep
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const MAX_RUNTIME = 270000 // 4.5 minutes (leave 30s buffer for cleanup + triggering next worker)

  let totalProcessed = 0
  let totalFailed = 0

  try {
    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = user.id
    const serviceSupabase = createServiceRoleClient()

    console.log(`[Worker] Starting queue processing for user ${userId}`)

    // Process photos in a loop until queue empty or timeout approaching
    while (Date.now() - startTime < MAX_RUNTIME) {
      try {
        // Check for pending photos
        const { data: pendingPhotos, error: pendingError } = await serviceSupabase
          .from('photo_processing_queue')
          .select('id, photo_id')
          .eq('user_id', userId)
          .eq('status', 'pending')
          .order('created_at', { ascending: true })
          .limit(1)

        if (pendingError) {
          console.error('[Worker] Error fetching pending photos:', pendingError)
          break
        }

        if (!pendingPhotos || pendingPhotos.length === 0) {
          console.log('[Worker] No more pending photos - queue complete!')
          break
        }

        const queueItem = pendingPhotos[0]

        // Mark as processing
        await serviceSupabase
          .from('photo_processing_queue')
          .update({
            status: 'processing',
            processing_started_at: new Date().toISOString(),
          })
          .eq('id', queueItem.id)

        console.log(`[Worker] Processing photo ${queueItem.photo_id} (${totalProcessed + 1} total)`)

        // Process the photo
        const result = await processPhoto(userId, queueItem, serviceSupabase, supabase)

        if (result.success) {
          totalProcessed++
          console.log(`[Worker] ✓ Photo ${queueItem.photo_id} completed`)
        } else {
          totalFailed++
          console.error(`[Worker] ✗ Photo ${queueItem.photo_id} failed:`, result.error)
        }

        // Brief delay between photos to avoid overwhelming the system
        await sleep(1000) // 1 second

      } catch (error) {
        console.error('[Worker] Error in processing loop:', error)
        totalFailed++
        // Continue to next photo instead of breaking
      }
    }

    // Check if there are still pending photos
    const { count: remainingCount } = await serviceSupabase
      .from('photo_processing_queue')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'pending')

    const hasMore = (remainingCount || 0) > 0

    console.log(`[Worker] Session complete. Processed: ${totalProcessed}, Failed: ${totalFailed}, Remaining: ${remainingCount || 0}`)

    // If still more photos and we're approaching timeout, trigger next worker
    if (hasMore && (Date.now() - startTime) >= MAX_RUNTIME) {
      console.log('[Worker] Timeout approaching with photos remaining - triggering next worker...')

      const protocol = request.headers.get('x-forwarded-proto') || 'http'
      const host = request.headers.get('host') || 'localhost:3000'
      const apiUrl = `${protocol}://${host}/api/photos/process-queue-worker`

      // Fire and forget - don't wait for response
      fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': request.headers.get('cookie') || '',
        },
      }).catch(err => {
        console.error('[Worker] Failed to trigger next worker:', err)
        // Not critical - user can manually trigger or photos will process on next upload
      })

      console.log('[Worker] Next worker triggered')
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${totalProcessed} photos`,
      processed: totalProcessed,
      failed: totalFailed,
      remaining: remainingCount || 0,
      completed: !hasMore,
    })

  } catch (error) {
    console.error('[Worker] Fatal error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Worker failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        processed: totalProcessed,
        failed: totalFailed,
      },
      { status: 500 }
    )
  }
}

/**
 * Process a single photo from the queue
 */
async function processPhoto(
  userId: string,
  queueItem: { id: number; photo_id: number },
  serviceSupabase: any,
  supabase: any
): Promise<{ success: boolean; error?: string }> {
  try {
    const embeddingConfig = getEmbeddingConfig()

    // Get photo details
    const { data: photo, error: photoError } = await supabase
      .from('photos')
      .select('id, name, file_url, type')
      .eq('id', queueItem.photo_id)
      .single()

    if (photoError || !photo) {
      throw new Error(`Photo not found: ${photoError?.message}`)
    }

    // Update photo status
    await supabase
      .from('photos')
      .update({ processing_status: 'processing' })
      .eq('id', photo.id)

    // Fetch image from storage
    const imageResponse = await fetch(photo.file_url, {
      signal: AbortSignal.timeout(30000)
    })
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.statusText}`)
    }

    const imageBuffer = await imageResponse.arrayBuffer()
    const base64Data = Buffer.from(imageBuffer).toString('base64')

    // Step 1: Generate caption
    const caption = await generateImageCaption(base64Data, photo.type)
    if (!caption) {
      throw new Error("Failed to generate caption")
    }

    // Step 2: Generate embeddings
    let openaiEmbedding: number[]
    let clipEmbedding: number[] | null = null

    if (embeddingConfig.supportsMultimodal) {
      // CLIP mode
      const { generateCLIPTextEmbedding } = await import("@/lib/services/huggingface")
      openaiEmbedding = await generateCLIPTextEmbedding(caption)
      clipEmbedding = await generateImageEmbedding(base64Data, photo.type)
    } else {
      // OpenAI mode
      const { generateTextEmbedding: openaiTextEmbedding } = await import("@/lib/services/openai")
      openaiEmbedding = await openaiTextEmbedding(caption)
    }

    // Step 3: Update photo with caption and embeddings
    const updateData: any = {
      caption,
      embedding: JSON.stringify(openaiEmbedding),
      processing_status: 'processing',
    }

    if (clipEmbedding) {
      updateData.embedding_clip = JSON.stringify(clipEmbedding)
    }

    await supabase
      .from('photos')
      .update(updateData)
      .eq('id', photo.id)

    // Step 4: Face detection (if enabled)
    const enableFaceDetection = process.env.ENABLE_FACE_DETECTION === "true"

    if (enableFaceDetection) {
      try {
        const faces = await detectFaces(base64Data, photo.type)

        if (faces.length > 0) {
          for (const face of faces) {
            const faceId = await insertFaceProfile(face.embedding, photo.id, face.boundingBox, supabase)
            const matches = await matchFaces(face.embedding, userId, supabase)

            if (matches.length > 0) {
              console.log(`[Worker] Face detected - ${matches.length} similar faces found`)
            }
          }
        }
      } catch (faceError) {
        console.error('[Worker] Face detection failed:', faceError)
        // Don't fail the whole photo processing if face detection fails
      }
    }

    // Step 5: Mark as completed
    await supabase
      .from('photos')
      .update({ processing_status: 'completed' })
      .eq('id', photo.id)

    await serviceSupabase
      .from('photo_processing_queue')
      .update({ status: 'completed' })
      .eq('id', queueItem.id)

    return { success: true }

  } catch (error) {
    // Mark as failed
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    await serviceSupabase
      .from('photo_processing_queue')
      .update({
        status: 'failed',
        error_message: errorMessage,
      })
      .eq('id', queueItem.id)

    await supabase
      .from('photos')
      .update({ processing_status: 'failed' })
      .eq('id', queueItem.photo_id)

    return { success: false, error: errorMessage }
  }
}
