/**
 * API Route: Toggle Album Favorite
 * POST /api/favorites/albums/[id]
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const albumId = parseInt(id)

    if (isNaN(albumId)) {
      return NextResponse.json({ error: "Invalid album ID" }, { status: 400 })
    }

    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get current favorite status
    const { data: album, error: fetchError } = await supabase
      .from("albums")
      .select("is_favorite")
      .eq("id", albumId)
      .eq("user_id", user.id)
      .single()

    if (fetchError || !album) {
      return NextResponse.json(
        { error: "Album not found" },
        { status: 404 }
      )
    }

    // Toggle favorite status
    const newFavoriteStatus = !album.is_favorite

    const { error: updateError } = await supabase
      .from("albums")
      .update({
        is_favorite: newFavoriteStatus,
        favorited_at: newFavoriteStatus ? new Date().toISOString() : null,
      })
      .eq("id", albumId)
      .eq("user_id", user.id)

    if (updateError) {
      console.error("Error updating album favorite status:", updateError)
      return NextResponse.json(
        { error: "Failed to update favorite status" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      is_favorite: newFavoriteStatus,
      album_id: albumId,
    })
  } catch (error) {
    console.error("Favorite album error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
