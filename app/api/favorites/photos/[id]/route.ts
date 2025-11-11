/**
 * API Route: Toggle Photo Favorite
 * POST /api/favorites/photos/[id]
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const photoId = parseInt(id)

    if (isNaN(photoId)) {
      return NextResponse.json({ error: "Invalid photo ID" }, { status: 400 })
    }

    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get current favorite status
    const { data: photo, error: fetchError } = await supabase
      .from("photos")
      .select("is_favorite")
      .eq("id", photoId)
      .eq("user_id", user.id)
      .single()

    if (fetchError || !photo) {
      return NextResponse.json(
        { error: "Photo not found" },
        { status: 404 }
      )
    }

    // Toggle favorite status
    const newFavoriteStatus = !photo.is_favorite

    const { error: updateError } = await supabase
      .from("photos")
      .update({
        is_favorite: newFavoriteStatus,
        favorited_at: newFavoriteStatus ? new Date().toISOString() : null,
      })
      .eq("id", photoId)
      .eq("user_id", user.id)

    if (updateError) {
      console.error("Error updating photo favorite status:", updateError)
      return NextResponse.json(
        { error: "Failed to update favorite status" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      is_favorite: newFavoriteStatus,
      photo_id: photoId,
    })
  } catch (error) {
    console.error("Favorite photo error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
