/**
 * Photo Upload API - Multipart Upload with Queue System
 *
 * This endpoint:
 * 1. Accepts multipart/form-data file uploads
 * 2. Uploads files directly to Supabase Storage
 * 3. Creates photo records in the database
 * 4. Adds photos to processing queue for background AI processing
 *
 * This approach prevents memory issues with large bulk uploads by:
 * - Not converting to base64 (saves 33% overhead)
 * - Uploading directly to storage (doesn't keep in RAM)
 * - Deferring AI processing to background queue
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/server"

// Helper function to extract filename without folder path
function getBaseName(filename: string): string {
  // Remove folder paths (handles both / and \ separators)
  return filename.split(/[/\\]/).pop() || filename
}

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = user.id

    // Parse multipart form data
    const formData = await request.formData()
    const photos = formData.getAll('photos') as File[]

    if (!photos || photos.length === 0) {
      return NextResponse.json(
        { error: "No photos provided" },
        { status: 400 }
      )
    }

    console.log(`[Upload API] Received ${photos.length} photos from user ${userId}`)

    // Use service role client for database operations
    const serviceSupabase = createServiceRoleClient()

    const uploadedPhotos: Array<{ id: number; name: string; url: string }> = []
    const errors: string[] = []

    // Process each photo
    for (let i = 0; i < photos.length; i++) {
      const file = photos[i]

      try {
        // Extract clean filename without folder path
        const cleanFileName = getBaseName(file.name)

        console.log(`[Upload API] Processing ${i + 1}/${photos.length}: ${cleanFileName} (${file.size} bytes)`)

        // Validate file type
        if (!file.type.startsWith('image/')) {
          errors.push(`${cleanFileName}: Not an image file`)
          continue
        }

        // Validate file size (50MB max)
        const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
        if (file.size > MAX_FILE_SIZE) {
          errors.push(`${cleanFileName}: File too large (max 50MB)`)
          continue
        }

        // Generate unique file path
        const timestamp = Date.now()
        const randomString = Math.random().toString(36).substring(7)
        const fileExt = cleanFileName.split('.').pop() || 'jpg'
        const fileName = `${timestamp}-${randomString}.${fileExt}`
        const filePath = `${userId}/${fileName}`

        // Convert File to ArrayBuffer then to Buffer
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        // Upload to Supabase Storage
        console.log(`[Upload API] Uploading ${cleanFileName} to storage: ${filePath}`)
        const { data: uploadData, error: uploadError } = await serviceSupabase.storage
          .from('photos')
          .upload(filePath, buffer, {
            contentType: file.type,
            upsert: false,
          })

        if (uploadError) {
          console.error(`[Upload API] Storage upload failed for ${cleanFileName}:`, uploadError)
          errors.push(`${cleanFileName}: Upload failed - ${uploadError.message}`)
          continue
        }

        // Get public URL
        const { data: urlData } = serviceSupabase.storage
          .from('photos')
          .getPublicUrl(filePath)

        const fileUrl = urlData.publicUrl

        console.log(`[Upload API] Photo uploaded to: ${fileUrl}`)

        // Insert photo record into database with processing_status = 'uploaded'
        const { data: photoData, error: dbError } = await serviceSupabase
          .from('photos')
          .insert({
            user_id: userId,
            name: cleanFileName,
            file_url: fileUrl,
            type: file.type,
            size: file.size,
            processing_status: 'uploaded',
            source: 'manual_upload',
            created_at: new Date().toISOString(),
          })
          .select('id')
          .single()

        if (dbError) {
          console.error(`[Upload API] Database insert failed for ${cleanFileName}:`, dbError)
          errors.push(`${cleanFileName}: Database error - ${dbError.message}`)

          // Clean up uploaded file
          await serviceSupabase.storage.from('photos').remove([filePath])
          continue
        }

        const photoId = photoData.id

        console.log(`[Upload API] Photo record created with ID: ${photoId}`)

        // Add to processing queue
        const { error: queueError } = await serviceSupabase
          .from('photo_processing_queue')
          .insert({
            photo_id: photoId,
            user_id: userId,
            status: 'pending',
            priority: 0,
            created_at: new Date().toISOString(),
          })

        if (queueError) {
          console.error(`[Upload API] Queue insert failed for ${cleanFileName}:`, queueError)
          // Don't fail the upload, just log it
          // The photo is still uploaded, just not queued for processing
        } else {
          console.log(`[Upload API] Photo ${photoId} added to processing queue`)

          // Update photo status to 'queued'
          await serviceSupabase
            .from('photos')
            .update({ processing_status: 'queued' })
            .eq('id', photoId)
        }

        uploadedPhotos.push({
          id: photoId,
          name: cleanFileName,
          url: fileUrl,
        })

        console.log(`[Upload API] Successfully processed ${cleanFileName}`)
      } catch (error) {
        const errorFileName = getBaseName(file.name)
        console.error(`[Upload API] Error processing ${errorFileName}:`, error)
        errors.push(
          `${errorFileName}: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    }

    console.log(
      `[Upload API] Completed: ${uploadedPhotos.length} uploaded, ${errors.length} failed`
    )

    return NextResponse.json({
      success: true,
      uploaded_count: uploadedPhotos.length,
      failed_count: errors.length,
      photos: uploadedPhotos,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('[Upload API] Request error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
