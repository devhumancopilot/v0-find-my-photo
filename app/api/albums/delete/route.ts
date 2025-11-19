/**
 * Album Delete API
 *
 * DELETE endpoint to remove an album from the database
 *
 * Security:
 * - Requires authentication
 * - Only allows users to delete their own albums
 * - Verifies album ownership before deletion
 *
 * Note: Deleting an album does NOT delete the photos in it.
 * Photos remain in the user's library and can be viewed/used elsewhere.
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

    // Get album ID from request body
    const body = await request.json()
    const { albumId } = body

    if (!albumId) {
      return NextResponse.json(
        { error: "albumId is required" },
        { status: 400 }
      )
    }

    console.log(`[Delete Album] User ${user.id} attempting to delete album ${albumId}`)

    // SECURITY CHECK: Verify the album belongs to the user
    const { data: album, error: fetchError } = await supabase
      .from("albums")
      .select("id, user_id, album_title, photo_count")
      .eq("id", albumId)
      .single()

    if (fetchError || !album) {
      console.error(`[Delete Album] Album ${albumId} not found:`, fetchError)
      return NextResponse.json(
        { error: "Album not found" },
        { status: 404 }
      )
    }

    if (album.user_id !== user.id) {
      console.warn(`[Delete Album] ⚠️ SECURITY: User ${user.id} attempted to delete album ${albumId} owned by ${album.user_id}`)
      return NextResponse.json(
        { error: "You don't have permission to delete this album" },
        { status: 403 }
      )
    }

    // Delete the album from the database
    // Photos in the album are NOT deleted (they remain in the photos table)
    const { error: deleteError } = await supabase
      .from("albums")
      .delete()
      .eq("id", albumId)
      .eq("user_id", user.id) // Double-check user_id for extra security

    if (deleteError) {
      console.error(`[Delete Album] Failed to delete album ${albumId}:`, deleteError)
      return NextResponse.json(
        { error: "Failed to delete album", details: deleteError.message },
        { status: 500 }
      )
    }

    console.log(`[Delete Album] ✓ Successfully deleted album ${albumId} (${album.album_title})`)
    console.log(`[Delete Album] Note: ${album.photo_count} photos from this album remain in user's library`)

    return NextResponse.json({
      success: true,
      message: "Album deleted successfully. Photos remain in your library.",
      albumId: albumId,
      photoCount: album.photo_count
    })
  } catch (error) {
    console.error("[Delete Album] Unexpected error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
