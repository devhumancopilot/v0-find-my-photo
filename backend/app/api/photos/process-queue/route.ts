/**
 * Photo Processing Queue API
 *
 * This endpoint processes photos from the queue in the background:
 * 1. Fetches pending photos from the queue
 * 2. Generates AI captions using OpenAI GPT-4 Vision
 * 3. Creates embeddings for semantic search:
 *    PURE CLIP MODE (when EMBEDDING_PROVIDER=huggingface):
 *    - CLIP text embedding (512D) from caption → embedding field
 *    - CLIP image embedding (512D) from image → embedding_clip field
 *    Both in same 512D space for perfect multimodal matching!
 *
 *    OPENAI MODE (when EMBEDDING_PROVIDER=openai):
 *    - OpenAI text embedding (1536D) from caption → embedding field
 * 4. Performs face detection (if enabled)
 * 5. Updates queue and photo status
 *
 * This allows bulk uploads without overwhelming the server or hitting memory limits.
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

// Timeout configuration for Render deployment
// Queue processing can take time (caption generation, embeddings, face detection)
export const maxDuration = 300 // 5 minutes per photo

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = user.id

    // Use service role client for database operations
    const serviceSupabase = createServiceRoleClient()

    // STEP 0: Reset stale 'processing' items (stuck > 5 minutes)
    // This handles recovery from crashed/timed-out processors
    const STALE_TIMEOUT_MINUTES = 5
    const staleThreshold = new Date(Date.now() - STALE_TIMEOUT_MINUTES * 60 * 1000).toISOString()

    const { data: staleItems, error: staleError } = await serviceSupabase
      .from('photo_processing_queue')
      .select('id, photo_id')
      .eq('user_id', userId)
      .eq('status', 'processing')
      .lt('processing_started_at', staleThreshold)

    if (!staleError && staleItems && staleItems.length > 0) {
      console.log(`[Process Queue] Found ${staleItems.length} stale processing items (stuck > ${STALE_TIMEOUT_MINUTES} min), resetting to pending...`)

      await serviceSupabase
        .from('photo_processing_queue')
        .update({
          status: 'pending',
          processing_started_at: null,
          retry_count: serviceSupabase.raw('retry_count + 1'),
          error_message: `Reset from stale processing state (stuck > ${STALE_TIMEOUT_MINUTES} minutes)`
        })
        .eq('user_id', userId)
        .eq('status', 'processing')
        .lt('processing_started_at', staleThreshold)

      console.log(`[Process Queue] Reset ${staleItems.length} stale items to pending`)
    }

    // STEP 1: Look for an existing 'processing' item for this user
    // Design: Only ONE 'processing' item per user at a time
    let { data: queueItems, error: queueError } = await serviceSupabase
      .from('photo_processing_queue')
      .select('id, photo_id, retry_count')
      .eq('user_id', userId)
      .eq('status', 'processing')
      .order('created_at', { ascending: true })
      .limit(1)

    if (queueError) {
      console.error('[Process Queue] Error fetching processing item:', queueError)
      return NextResponse.json(
        { error: 'Failed to fetch queue', details: queueError.message },
        { status: 500 }
      )
    }

    // STEP 2: If no 'processing' item, get first 'pending' and mark it 'processing'
    if (!queueItems || queueItems.length === 0) {
      console.log('[Process Queue] No processing item found, claiming next pending item')

      const { data: pendingItems, error: pendingError } = await serviceSupabase
        .from('photo_processing_queue')
        .select('id, photo_id, retry_count')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(1)

      if (pendingError) {
        console.error('[Process Queue] Error fetching pending items:', pendingError)
        return NextResponse.json(
          { error: 'Failed to fetch pending items', details: pendingError.message },
          { status: 500 }
        )
      }

      if (!pendingItems || pendingItems.length === 0) {
        console.log('[Process Queue] No pending items found')
        return NextResponse.json({
          success: true,
          message: 'No photos in queue',
          queue_count: 0,
          processed_count: 0,
        })
      }

      // Mark it as processing
      const { error: updateError } = await serviceSupabase
        .from('photo_processing_queue')
        .update({
          status: 'processing',
          processing_started_at: new Date().toISOString(),
        })
        .eq('id', pendingItems[0].id)

      if (updateError) {
        console.error('[Process Queue] Error marking item as processing:', updateError)
        return NextResponse.json(
          { error: 'Failed to mark item as processing', details: updateError.message },
          { status: 500 }
        )
      }

      queueItems = pendingItems
    }

    console.log(`[Process Queue] Processing mode: Sequential (ONE 'processing' item per user)`)
    console.log(`[Process Queue] Processing photo for user ${userId}`)

    // STEP 3: Process the photo
    const results = await processQueueInBackground(userId, queueItems, serviceSupabase)

    // STEP 4: After processing, mark next 'pending' item as 'processing'
    const { data: nextPending, error: nextError } = await serviceSupabase
      .from('photo_processing_queue')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1)

    let hasMore = false
    if (!nextError && nextPending && nextPending.length > 0) {
      // Mark the next item as 'processing'
      await serviceSupabase
        .from('photo_processing_queue')
        .update({
          status: 'processing',
          processing_started_at: new Date().toISOString(),
        })
        .eq('id', nextPending[0].id)

      hasMore = true
    }

    // STEP 5: Trigger next process if needed with retry logic
    if (hasMore) {
      console.log(`[Process Queue] Marked next item as processing, triggering next process...`)

      const protocol = request.headers.get('x-forwarded-proto') || 'http'
      const host = request.headers.get('host') || 'localhost:3000'
      const baseUrl = `${protocol}://${host}`
      const apiUrl = `${baseUrl}/api/photos/process-queue`

      // Retry logic to prevent chain breaks
      const MAX_RETRIES = 3
      let retryCount = 0
      let success = false

      while (retryCount < MAX_RETRIES && !success) {
        try {
          if (retryCount > 0) {
            const delay = Math.pow(2, retryCount - 1) * 1000 // 1s, 2s, 4s
            console.log(`[Process Queue] Retry ${retryCount}/${MAX_RETRIES} after ${delay}ms delay`)
            await new Promise(resolve => setTimeout(resolve, delay))
          }

          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Cookie': request.headers.get('cookie') || '',
            },
            signal: AbortSignal.timeout(60000) // 60 second timeout
          })

          if (response.ok) {
            success = true
            console.log(`[Process Queue] Next process triggered successfully`)
          } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }
        } catch (error) {
          retryCount++
          console.error(`[Process Queue] Failed to trigger next process (attempt ${retryCount}/${MAX_RETRIES}):`, error)

          if (retryCount >= MAX_RETRIES) {
            // Max retries reached - reset the next photo back to pending to prevent stuck state
            console.error(`[Process Queue] Max retries reached, resetting next photo to pending`)
            await serviceSupabase
              .from('photo_processing_queue')
              .update({
                status: 'pending',
                processing_started_at: null,
                error_message: 'Failed to trigger recursive processing - reset to pending'
              })
              .eq('id', nextPending[0].id)
          }
        }
      }
    } else {
      console.log(`[Process Queue] No more photos to process - chain complete`)
    }

    return NextResponse.json({
      success: true,
      message: 'Processing completed',
      queue_count: queueItems.length,
      processed_count: results.processedCount,
      failed_count: results.failedCount,
      has_more: hasMore,
    })
  } catch (error) {
    console.error('[Process Queue] Request error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// Background processing function
async function processQueueInBackground(
  userId: string,
  queueItems: Array<{ id: number; photo_id: number; retry_count: number }>,
  supabase: any
) {
  const embeddingConfig = getEmbeddingConfig()
  console.log(`[Process Queue BG][BATCH-START] ========================================`)
  console.log(`[Process Queue BG][BATCH-START] Starting background processing of ${queueItems.length} photos`)
  console.log(`[Process Queue BG][BATCH-START] User ID: ${userId}`)
  console.log(`[Process Queue BG][BATCH-START] Embedding Provider: ${embeddingConfig.provider.toUpperCase()}`)
  console.log(`[Process Queue BG][BATCH-START] Dimensions: ${embeddingConfig.dimensions}D`)
  console.log(`[Process Queue BG][BATCH-START] Multimodal Support: ${embeddingConfig.supportsMultimodal ? 'YES (CLIP)' : 'NO (Caption-based)'}`)
  console.log(`[Process Queue BG][BATCH-START] ========================================`)

  let processedCount = 0
  let failedCount = 0

  for (const queueItem of queueItems) {
    console.log(`[Process Queue BG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`[Process Queue BG] Starting item ${processedCount + failedCount + 1}/${queueItems.length} - Queue ID: ${queueItem.id}`)
    try {
      // Update photo status to processing (queue item already marked as processing atomically)
      await supabase
        .from('photos')
        .update({ processing_status: 'processing' })
        .eq('id', queueItem.photo_id)

      // Get photo details
      const { data: photo, error: photoError } = await supabase
        .from('photos')
        .select('id, name, file_url, type')
        .eq('id', queueItem.photo_id)
        .single()

      if (photoError || !photo) {
        throw new Error(`Photo not found: ${photoError?.message}`)
      }

      console.log(`[Process Queue BG][${embeddingConfig.provider.toUpperCase()}][${processedCount + 1}/${queueItems.length}] Processing photo ${photo.id}: ${photo.name}`)

      // Fetch image from storage with timeout
      console.log(`[Process Queue BG][${processedCount + 1}/${queueItems.length}] 📥 Fetching image from storage: ${photo.file_url}`)
      const imageResponse = await fetch(photo.file_url, {
        signal: AbortSignal.timeout(30000) // 30 second timeout
      })
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image from storage: ${imageResponse.statusText}`)
      }
      console.log(`[Process Queue BG][${processedCount + 1}/${queueItems.length}] ✓ Image fetched successfully`)

      const imageBuffer = await imageResponse.arrayBuffer()
      const base64Data = Buffer.from(imageBuffer).toString('base64')
      console.log(`[Process Queue BG][${processedCount + 1}/${queueItems.length}] ✓ Image converted to base64 (${Math.round(base64Data.length / 1024)}KB)`)

      // Step 1: Generate caption using OpenAI (always, regardless of provider)
      console.log(`[Process Queue BG][${processedCount + 1}/${queueItems.length}] 📝 Step 1: Generating caption with OpenAI GPT-4 Vision...`)
      const captionStartTime = Date.now()
      const caption = await generateImageCaption(base64Data, photo.type)
      console.log(`[Process Queue BG][${processedCount + 1}/${queueItems.length}] ✓ Caption generated in ${Date.now() - captionStartTime}ms`)

      if (!caption) {
        throw new Error("Failed to generate caption")
      }

      console.log(`[Process Queue BG][${processedCount + 1}/${queueItems.length}] ✓ Caption: ${caption.substring(0, 100)}...`)

      // Step 2: Generate embeddings based on provider
      let openaiEmbedding: number[]
      let clipEmbedding: number[] | null = null

      if (embeddingConfig.supportsMultimodal) {
        // CLIP provider - generate BOTH embeddings using CLIP (same 512D space!)
        console.log(`[Process Queue BG][CLIP][${processedCount + 1}/${queueItems.length}] 🎨 Step 2a: Generating CLIP text embedding from caption...`)

        // CLIP text embedding from caption (512D) - in same space as image!
        const { generateCLIPTextEmbedding } = await import("@/lib/services/huggingface")
        const textEmbedStartTime = Date.now()
        openaiEmbedding = await generateCLIPTextEmbedding(caption)
        console.log(`[Process Queue BG][CLIP][${processedCount + 1}/${queueItems.length}] ✓ CLIP text embedding generated: ${openaiEmbedding.length}D in ${Date.now() - textEmbedStartTime}ms`)

        // CLIP direct image embedding (512D) - same space!
        console.log(`[Process Queue BG][CLIP][${processedCount + 1}/${queueItems.length}] 🎨 Step 2b: Generating CLIP image embedding from image...`)
        const imageEmbedStartTime = Date.now()
        clipEmbedding = await generateImageEmbedding(base64Data, photo.type)
        console.log(`[Process Queue BG][CLIP][${processedCount + 1}/${queueItems.length}] ✓ CLIP image embedding generated: ${clipEmbedding.length}D in ${Date.now() - imageEmbedStartTime}ms`)
      } else {
        // OpenAI provider - caption-based approach
        console.log(`[Process Queue BG][OPENAI][${processedCount + 1}/${queueItems.length}] 📝 Generating OpenAI text embedding from caption`)

        const { generateTextEmbedding: openaiTextEmbedding } = await import("@/lib/services/openai")
        openaiEmbedding = await openaiTextEmbedding(caption)
        console.log(`[Process Queue BG][OPENAI][${processedCount + 1}/${queueItems.length}] ✓ OpenAI embedding: ${openaiEmbedding.length}D`)
      }

      // Step 3: Prepare update data
      const updateData: any = {
        caption, // OpenAI GPT-4 Vision generated caption (for display)
        embedding: JSON.stringify(openaiEmbedding), // CLIP text embedding from caption (512D) OR OpenAI (1536D)
        processing_status: 'processing', // Will be set to 'completed' after face detection
      }

      // Add CLIP image embedding if available (CLIP mode)
      if (clipEmbedding) {
        updateData.embedding_clip = JSON.stringify(clipEmbedding) // 512D CLIP direct image embedding
        console.log(`[Process Queue BG][CLIP][${processedCount + 1}/${queueItems.length}] ✓ Saving both CLIP embeddings - Text: ${openaiEmbedding.length}D, Image: ${clipEmbedding.length}D`)
      }

      // Step 4: Update photo with caption and embeddings
      const { error: updateError } = await supabase
        .from('photos')
        .update(updateData)
        .eq('id', photo.id)

      if (updateError) {
        throw new Error(`Failed to update photo: ${updateError.message}`)
      }

      // Step 5: Face Detection (if enabled)
      const enableFaceDetection = process.env.ENABLE_FACE_DETECTION === "true"

      if (enableFaceDetection) {
        try {
          console.log(`[Process Queue BG] Starting face detection for ${photo.name}`)

          const buffer = Buffer.from(imageBuffer)
          const faces = await detectFaces(buffer)
          console.log(`[Process Queue BG] Detected ${faces.length} faces in ${photo.name}`)

          // Process each detected face
          for (let j = 0; j < faces.length; j++) {
            const face = faces[j]

            try {
              // Try to match with existing face profiles
              const threshold = parseFloat(process.env.FACE_MATCHING_THRESHOLD || "0.4")
              const matches = await matchFaces(face.descriptor, userId, threshold, supabase)

              let faceName: string | null = null
              if (matches.length > 0) {
                faceName = matches[0].face_name
                console.log(
                  `[Process Queue BG] Face ${j + 1}/${faces.length} matched to: ${faceName}`
                )
              } else {
                console.log(`[Process Queue BG] Face ${j + 1}/${faces.length} is new`)
              }

              // Insert face profile
              await insertFaceProfile(
                {
                  photo_id: photo.id,
                  user_id: userId,
                  face_embedding: face.descriptor,
                  face_name: faceName,
                  bbox_x: face.box.x,
                  bbox_y: face.box.y,
                  bbox_width: face.box.width,
                  bbox_height: face.box.height,
                  detection_confidence: face.confidence,
                  metadata: {
                    age: face.age,
                    gender: face.gender,
                    expressions: face.expressions,
                  },
                },
                supabase
              )

              console.log(`[Process Queue BG] Face ${j + 1} profile created`)
            } catch (faceProfileError) {
              console.error(
                `[Process Queue BG] Failed to process face ${j + 1}:`,
                faceProfileError
              )
              // Continue with next face
            }
          }
        } catch (faceDetectionError) {
          console.error(
            `[Process Queue BG] Face detection failed for ${photo.name}:`,
            faceDetectionError
          )
          // Don't fail the entire processing if face detection fails
        }
      }

      // Mark as completed
      await supabase
        .from('photo_processing_queue')
        .update({
          status: 'completed',
          processing_completed_at: new Date().toISOString(),
        })
        .eq('id', queueItem.id)

      await supabase
        .from('photos')
        .update({ processing_status: 'completed' })
        .eq('id', photo.id)

      processedCount++
      console.log(`[Process Queue BG][${embeddingConfig.provider.toUpperCase()}][${processedCount}/${queueItems.length}] ✅ SUCCESS - ${photo.name}`)
    } catch (error) {
      failedCount++
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error(`[Process Queue BG] Failed to process queue item ${queueItem.id}:`, error)

      // Mark as failed (with retry logic)
      const maxRetries = 3
      if (queueItem.retry_count + 1 >= maxRetries) {
        // Max retries reached, mark as failed
        await supabase
          .from('photo_processing_queue')
          .update({
            status: 'failed',
            error_message: errorMessage,
            retry_count: queueItem.retry_count + 1,
            processing_completed_at: new Date().toISOString(),
          })
          .eq('id', queueItem.id)

        await supabase
          .from('photos')
          .update({ processing_status: 'failed' })
          .eq('id', queueItem.photo_id)
      } else {
        // Reset to pending for retry
        await supabase
          .from('photo_processing_queue')
          .update({
            status: 'pending',
            error_message: errorMessage,
            retry_count: queueItem.retry_count + 1,
            processing_started_at: null,
          })
          .eq('id', queueItem.id)

        await supabase
          .from('photos')
          .update({ processing_status: 'queued' })
          .eq('id', queueItem.photo_id)
      }
    }
  }

  console.log(`[Process Queue BG][BATCH-END] ========================================`)
  console.log(`[Process Queue BG][BATCH-END] Batch Processing Complete`)
  console.log(`[Process Queue BG][BATCH-END] Provider Used: ${embeddingConfig.provider.toUpperCase()}`)
  console.log(`[Process Queue BG][BATCH-END] Results: ${processedCount} successful, ${failedCount} failed`)
  console.log(`[Process Queue BG][BATCH-END] Total: ${processedCount + failedCount}/${queueItems.length} processed`)
  console.log(`[Process Queue BG][BATCH-END] ========================================`)

  return {
    processedCount,
    failedCount,
    total: queueItems.length
  }
}
