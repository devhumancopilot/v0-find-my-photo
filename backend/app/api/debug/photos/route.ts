/**
 * Debug endpoint to check photo database status
 * Access: /api/debug/photos
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log(`[Debug] Checking photos for user: ${user.id}`)

    // Get photo count
    const { count, error: countError } = await supabase
      .from("photos")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)

    if (countError) {
      console.error(`[Debug] Error counting photos:`, countError)
      return NextResponse.json({ error: countError.message }, { status: 500 })
    }

    // Get recent photos with details
    const { data: photos, error: photosError } = await supabase
      .from("photos")
      .select("id, name, user_id, caption, created_at, file_url")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10)

    if (photosError) {
      console.error(`[Debug] Error fetching photos:`, photosError)
      return NextResponse.json({ error: photosError.message }, { status: 500 })
    }

    // Get ALL photos (regardless of user) - for debugging
    const { count: totalCount, error: totalCountError } = await supabase
      .from("photos")
      .select("*", { count: "exact", head: true })

    if (totalCountError) {
      console.error(`[Debug] Error counting all photos:`, totalCountError)
    }

    // Check storage bucket
    const { data: bucketFiles, error: storageError } = await supabase
      .storage
      .from("photos")
      .list(user.id, {
        limit: 10,
        offset: 0,
        sortBy: { column: "created_at", order: "desc" },
      })

    const response = {
      user: {
        id: user.id,
        email: user.email,
      },
      database: {
        user_photos_count: count || 0,
        total_photos_in_db: totalCount || 0,
        recent_photos: photos || [],
      },
      storage: {
        files_in_bucket: bucketFiles?.length || 0,
        files: bucketFiles?.map(f => ({ name: f.name, size: f.metadata?.size })) || [],
        error: storageError?.message,
      },
      diagnosis: {
        has_photos_in_db: (count || 0) > 0,
        has_photos_in_storage: (bucketFiles?.length || 0) > 0,
        issue: (count || 0) === 0 && (bucketFiles?.length || 0) > 0
          ? "Photos in storage but not in database - upload process incomplete"
          : (count || 0) === 0
          ? "No photos found - need to upload photos first"
          : "OK - Photos exist in database",
      }
    }

    console.log(`[Debug] Diagnosis:`, response.diagnosis)

    return NextResponse.json(response, { status: 200 })
  } catch (error) {
    console.error("[Debug] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
