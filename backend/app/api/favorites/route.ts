/**
 * API Route: Get All Favorites
 * GET /api/favorites
 * Returns all favorite photos and albums for the authenticated user
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get favorite photos
    const { data: favoritePhotos, error: photosError } = await supabase
      .from("photos")
      .select("id, name, file_url, caption, is_favorite, favorited_at, created_at")
      .eq("user_id", user.id)
      .eq("is_favorite", true)
      .order("favorited_at", { ascending: false })

    if (photosError) {
      console.error("Error fetching favorite photos:", photosError)
    }

    // Get favorite albums
    const { data: favoriteAlbums, error: albumsError } = await supabase
      .from("albums")
      .select("id, name, description, cover_image_url, photo_count, is_favorite, favorited_at, created_at")
      .eq("user_id", user.id)
      .eq("is_favorite", true)
      .order("favorited_at", { ascending: false })

    if (albumsError) {
      console.error("Error fetching favorite albums:", albumsError)
    }

    // Get counts
    const photoCount = favoritePhotos?.length || 0
    const albumCount = favoriteAlbums?.length || 0

    return NextResponse.json({
      success: true,
      favorites: {
        photos: favoritePhotos || [],
        albums: favoriteAlbums || [],
      },
      counts: {
        photos: photoCount,
        albums: albumCount,
        total: photoCount + albumCount,
      },
    })
  } catch (error) {
    console.error("Get favorites error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
