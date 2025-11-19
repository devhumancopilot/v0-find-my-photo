/**
 * Photo Processing Queue API
 *
 * This endpoint processes photos from the queue in the background:
 * 1. Fetches pending photos from the queue
 * 2. Generates AI captions
 * 3. Creates embeddings for semantic search
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

    // Get pending queue items for this user
    const { data: queueItems, error: queueError } = await serviceSupabase
      .from('photo_processing_queue')
      .select('id, photo_id, retry_count')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(50) // Process up to 50 photos at a time

    if (queueError) {
      console.error('[Process Queue] Error fetching queue:', queueError)
      return NextResponse.json(
        { error: 'Failed to fetch queue', details: queueError.message },
        { status: 500 }
      )
    }

    if (!queueItems || queueItems.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No photos in queue',
        queue_count: 0,
        processed_count: 0,
      })
    }

    console.log(`[Process Queue] Found ${queueItems.length} photos to process for user ${userId}`)

    // Start processing in the background
    // Note: In production, you might want to use a job queue system like BullMQ or trigger this via cron
    processQueueInBackground(userId, queueItems, serviceSupabase)

    return NextResponse.json({
      success: true,
      message: 'Processing started',
      queue_count: queueItems.length,
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
    try {
      // Mark as processing
      await supabase
        .from('photo_processing_queue')
        .update({
          status: 'processing',
          processing_started_at: new Date().toISOString(),
        })
        .eq('id', queueItem.id)

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

      // Fetch image from storage
      const imageResponse = await fetch(photo.file_url)
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image from storage: ${imageResponse.statusText}`)
      }

      const imageBuffer = await imageResponse.arrayBuffer()
      const base64Data = Buffer.from(imageBuffer).toString('base64')

      // Generate caption and embedding based on provider
      let caption: string | null
      let embedding: number[]

      if (embeddingConfig.supportsMultimodal) {
        // CLIP approach: direct image embedding
        console.log(`[Process Queue BG][CLIP][${processedCount + 1}/${queueItems.length}] 🎨 Using CLIP multimodal approach`)
        console.log(`[Process Queue BG][CLIP][${processedCount + 1}/${queueItems.length}] -> Direct image encoding`)

        embedding = await generateImageEmbedding(base64Data, photo.type)
        console.log(`[Process Queue BG][CLIP][${processedCount + 1}/${queueItems.length}] ✓ Embedding generated: ${embedding.length}D`)

        // Caption is optional for CLIP but nice to have for display
        caption = await generateImageCaption(base64Data, photo.type)
        if (caption) {
          console.log(`[Process Queue BG][CLIP][${processedCount + 1}/${queueItems.length}] Caption (optional): ${caption.substring(0, 100)}...`)
        } else {
          // CLIP doesn't generate captions, use a placeholder
          caption = "Image processed with CLIP"
        }
      } else {
        // OpenAI approach: caption-based
        console.log(`[Process Queue BG][OPENAI][${processedCount + 1}/${queueItems.length}] 📝 Using OpenAI caption-based approach`)
        console.log(`[Process Queue BG][OPENAI][${processedCount + 1}/${queueItems.length}] -> Step 1: Generating caption with GPT-4 Vision`)

        caption = await generateImageCaption(base64Data, photo.type)
        console.log(`[Process Queue BG][OPENAI][${processedCount + 1}/${queueItems.length}] ✓ Caption: ${caption?.substring(0, 100)}...`)

        console.log(`[Process Queue BG][OPENAI][${processedCount + 1}/${queueItems.length}] -> Step 2: Generating embedding`)
        embedding = await generateImageEmbedding(base64Data, photo.type)
        console.log(`[Process Queue BG][OPENAI][${processedCount + 1}/${queueItems.length}] ✓ Embedding generated: ${embedding.length}D`)
      }

      // Step 2.5: Generate BOTH embeddings for hybrid search
      let openaiEmbedding: number[]
      let clipEmbedding: number[] | null = null

      if (embeddingConfig.supportsMultimodal) {
        // Using CLIP provider - need to generate BOTH embeddings
        console.log(`[Process Queue BG][HYBRID][${processedCount + 1}/${queueItems.length}] Generating both OpenAI and CLIP embeddings`)

        // We already have the caption, now generate OpenAI embedding from it
        const { generateTextEmbedding: openaiTextEmbedding } = await import("@/lib/services/openai")
        openaiEmbedding = await openaiTextEmbedding(caption || "No caption")
        console.log(`[Process Queue BG][HYBRID][${processedCount + 1}/${queueItems.length}] ✓ OpenAI embedding: ${openaiEmbedding.length}D`)

        // The embedding variable contains CLIP's caption-based embedding, but we need direct image embedding
        const { generateCLIPImageEmbedding } = await import("@/lib/services/huggingface")
        clipEmbedding = await generateCLIPImageEmbedding(base64Data, photo.type)
        console.log(`[Process Queue BG][HYBRID][${processedCount + 1}/${queueItems.length}] ✓ CLIP image embedding: ${clipEmbedding.length}D`)
      } else {
        // Using OpenAI provider - already have the OpenAI embedding
        openaiEmbedding = embedding
        console.log(`[Process Queue BG][OPENAI][${processedCount + 1}/${queueItems.length}] Using OpenAI embedding: ${openaiEmbedding.length}D`)
      }

      // Prepare update data
      const updateData: any = {
        caption,
        embedding: JSON.stringify(openaiEmbedding), // Always 1536D OpenAI embedding
        processing_status: 'processing', // Will be set to 'completed' after face detection
      }

      // Add CLIP embedding if available
      if (clipEmbedding) {
        updateData.embedding_clip = JSON.stringify(clipEmbedding) // 512D CLIP image embedding
        console.log(`[Process Queue BG][HYBRID][${processedCount + 1}/${queueItems.length}] Saving both embeddings - OpenAI: ${openaiEmbedding.length}D, CLIP: ${clipEmbedding.length}D`)
      }

      // Step 3: Update photo with caption and embedding
      const { error: updateError } = await supabase
        .from('photos')
        .update(updateData)
        .eq('id', photo.id)

      if (updateError) {
        throw new Error(`Failed to update photo: ${updateError.message}`)
      }

      // Step 4: Face Detection (if enabled)
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
}
