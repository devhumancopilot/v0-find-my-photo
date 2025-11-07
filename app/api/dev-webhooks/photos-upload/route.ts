/**
 * Local Webhook Handler: Photo Upload
 * Fallback for N8N manual image upload workflow
 *
 * SECURITY NOTE: This endpoint does NOT perform authentication checks because:
 * - It's only called internally by /api/webhooks/photos-upload (which IS authenticated)
 * - The calling endpoint validates the user session before invoking this
 * - This is a server-to-server call, not a public API
 * - user_id is passed in the payload and validated by the caller
 *
 * DO NOT expose this endpoint directly to clients!
 */

import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { generateImageCaption, generateTextEmbedding } from "@/lib/services/openai"
import { uploadPhotoToStorage } from "@/lib/services/storage"
import { insertPhoto, insertFaceProfile, matchFaces } from "@/lib/services/database"
import { detectFaces } from "@/lib/services/face-detection"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { user_id, images, timestamp } = body

    // Validate payload
    if (!user_id || !images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: "Invalid payload: user_id and images array required" }, { status: 400 })
    }

    // Create service role supabase client (bypasses RLS for internal operations)
    // This is safe because this endpoint is only called by the authenticated /api/webhooks/photos-upload
    const supabase = createServiceRoleClient()

    console.log(`[Fallback] Processing ${images.length} images for user ${user_id}`)

    const processedPhotoIds: number[] = []
    const errors: string[] = []
    const duplicates: Array<{ name: string; id: number }> = []

    // Process each image sequentially with optimized parallel operations
    for (let i = 0; i < images.length; i++) {
      const { name, data, type, size } = images[i]

      try {
        console.log(`[Fallback] Processing image ${i + 1}/${images.length}: ${name}`)

        // Step 1: Generate caption
        console.log(`[Fallback] Generating caption for ${name}`)
        const caption = await generateImageCaption(data, type)
        console.log(`[Fallback] Caption generated: ${caption.substring(0, 100)}...`)

        // Step 2 & 3: Upload to storage and generate embedding IN PARALLEL (2x speedup)
        console.log(`[Fallback] Uploading ${name} and generating embedding in parallel`)
        const [fileUrl, embedding] = await Promise.all([
          uploadPhotoToStorage(data, user_id, name, type),
          generateTextEmbedding(caption),
        ])
        console.log(`[Fallback] Uploaded to: ${fileUrl}`)
        console.log(`[Fallback] Embedding generated (${embedding.length} dimensions)`)

        // Step 4: Insert into database
        console.log(`[Fallback] Inserting ${name} into database`)
        const photoId = await insertPhoto(
          {
            name,
            file_url: fileUrl,
            type,
            size,
            caption,
            embedding,
            user_id,
            data: process.env.STORE_BASE64_IN_DB === "true" ? data : undefined,
          },
          supabase
        )

        console.log(`[Fallback] Successfully processed ${name} (ID: ${photoId})`)
        processedPhotoIds.push(photoId)

        // Step 5: Face Detection (if enabled)
        const enableFaceDetection = process.env.ENABLE_FACE_DETECTION === "true"

        if (enableFaceDetection) {
          try {
            console.log(`[Fallback] Starting face detection for ${name}`)

            // Convert base64 to buffer
            const imageBuffer = Buffer.from(data, "base64")

            // Detect faces
            const faces = await detectFaces(imageBuffer)
            console.log(`[Fallback] Detected ${faces.length} faces in ${name}`)

            // If no faces detected, continue with next image
            if (faces.length === 0) {
              console.log(`[Fallback] No faces to process in ${name}`)
            }

            // Process each detected face
            for (let j = 0; j < faces.length; j++) {
              const face = faces[j]

              try {
                // Try to match with existing face profiles
                const threshold = parseFloat(process.env.FACE_MATCHING_THRESHOLD || "0.4")
                const matches = await matchFaces(face.descriptor, user_id, threshold, supabase)

                let faceName: string | null = null
                if (matches.length > 0) {
                  // Match found! Inherit the face_name
                  faceName = matches[0].face_name
                  console.log(
                    `[Fallback] Face ${j + 1}/${faces.length} matched to: ${faceName} (similarity: ${matches[0].similarity.toFixed(3)})`
                  )
                } else {
                  console.log(`[Fallback] Face ${j + 1}/${faces.length} is new (no match found)`)
                }

                // Insert face profile
                console.log(`[Fallback] Inserting face profile for face ${j + 1}:`, {
                  photo_id: photoId,
                  user_id,
                  face_name: faceName,
                  bbox: face.box,
                  confidence: face.confidence,
                  descriptor_length: face.descriptor.length,
                })

                const faceProfileId = await insertFaceProfile(
                  {
                    photo_id: photoId,
                    user_id,
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

                console.log(`[Fallback] Face ${j + 1}/${faces.length} profile created with ID: ${faceProfileId}`)
              } catch (faceProfileError) {
                console.error(`[Fallback] Failed to process face ${j + 1} in ${name}:`, faceProfileError)
                // Continue with next face
              }
            }
          } catch (faceDetectionError) {
            console.error(`[Fallback] Face detection failed for ${name}:`, faceDetectionError)
            // Don't fail the entire upload if face detection fails
          }
        }
      } catch (imageError) {
        // Check if it's a duplicate error
        if (imageError instanceof Error && imageError.message.startsWith("DUPLICATE_PHOTO:")) {
          const existingId = parseInt(imageError.message.split(":")[1])
          duplicates.push({ name, id: existingId })
          console.log(`[Fallback] Skipping duplicate photo: ${name} (existing ID: ${existingId})`)
        } else {
          const errorMsg = `Failed to process ${name}: ${imageError instanceof Error ? imageError.message : "Unknown error"}`
          console.error(`[Fallback] ${errorMsg}`)
          errors.push(errorMsg)
        }
        // Continue processing other images
      }
    }

    // Return results
    const successCount = processedPhotoIds.length
    const failedCount = errors.length
    const duplicateCount = duplicates.length

    console.log(`[Fallback] Completed: ${successCount} successful, ${duplicateCount} duplicates skipped, ${failedCount} failed`)

    return NextResponse.json({
      success: true,
      processed_count: successCount,
      duplicate_count: duplicateCount,
      failed_count: failedCount,
      photo_ids: processedPhotoIds,
      duplicates: duplicates.length > 0 ? duplicates : undefined,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error("[Fallback] Photo upload handler error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
