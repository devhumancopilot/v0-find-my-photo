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
      .select("id, user_id, name")
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

    console.log(`[Delete Photo] ✓ Successfully deleted photo ${photoId} (${photo.name})`)

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
