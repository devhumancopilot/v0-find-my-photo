/**
 * Photo Delete API
 *
 * DELETE endpoint to remove a photo from the database
 *
 * Security:
 * - Requires authentication
 * - Only allows users to delete their own photos
 * - Verifies photo ownership before deletion
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { del } from '@vercel/blob'

export async function DELETE(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get photo ID from request body
    const body = await request.json()
    const { photoId } = body

    if (!photoId) {
      return NextResponse.json(
        { error: "photoId is required" },
        { status: 400 }
      )
    }

    console.log(`[Delete Photo] User ${user.id} attempting to delete photo ${photoId}`)

    // SECURITY CHECK: Verify the photo belongs to the user
    const { data: photo, error: fetchError } = await supabase
      .from("photos")
      .select("id, user_id, name, file_url")
      .eq("id", photoId)
      .single()

    if (fetchError || !photo) {
      console.error(`[Delete Photo] Photo ${photoId} not found:`, fetchError)
      return NextResponse.json(
        { error: "Photo not found" },
        { status: 404 }
      )
    }

    if (photo.user_id !== user.id) {
      console.warn(`[Delete Photo] ⚠️ SECURITY: User ${user.id} attempted to delete photo ${photoId} owned by ${photo.user_id}`)
      return NextResponse.json(
        { error: "You don't have permission to delete this photo" },
        { status: 403 }
      )
    }

    // Delete from storage (Vercel Blob or Supabase Storage)
    if (photo.file_url) {
      try {
        if (photo.file_url.includes('vercel-storage.com') || photo.file_url.includes('blob.vercel-storage.com')) {
          // Delete from Vercel Blob
          console.log(`[Delete Photo] Deleting from Vercel Blob: ${photo.file_url}`)
          await del(photo.file_url)
          console.log(`[Delete Photo] ✓ Deleted from Vercel Blob`)
        } else if (photo.file_url.includes('supabase.co/storage')) {
          // Delete from Supabase Storage
          console.log(`[Delete Photo] Deleting from Supabase Storage: ${photo.file_url}`)
          // Extract the file path from the URL
          // Format: https://{project}.supabase.co/storage/v1/object/public/photos/{userId}/{filename}
          const urlParts = photo.file_url.split('/storage/v1/object/public/photos/')
          if (urlParts.length > 1) {
            const filePath = urlParts[1]
            const { error: storageError } = await supabase.storage
              .from('photos')
              .remove([filePath])

            if (storageError) {
              console.error(`[Delete Photo] Failed to delete from Supabase Storage:`, storageError)
            } else {
              console.log(`[Delete Photo] ✓ Deleted from Supabase Storage`)
            }
          }
        }
      } catch (error) {
        console.error(`[Delete Photo] Storage deletion error:`, error)
        // Continue with database deletion even if storage deletion fails
      }
    }

    // Delete the photo from the database
    const { error: deleteError } = await supabase
      .from("photos")
      .delete()
      .eq("id", photoId)
      .eq("user_id", user.id) // Double-check user_id for extra security

    if (deleteError) {
      console.error(`[Delete Photo] Failed to delete photo ${photoId}:`, deleteError)
      return NextResponse.json(
        { error: "Failed to delete photo", details: deleteError.message },
        { status: 500 }
      )
    }

    console.log(`[Delete Photo] ✓ Successfully deleted photo ${photoId} (${photo.name}) from database`)

    return NextResponse.json({
      success: true,
      message: "Photo deleted successfully",
      photoId: photoId
    })
  } catch (error) {
    console.error("[Delete Photo] Unexpected error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
