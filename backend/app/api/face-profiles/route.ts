/**
 * Face Profiles API
 * GET: List all face profiles for authenticated user
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * GET /api/face-profiles
 * Returns face profiles grouped by face_name
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Fetch all face profiles with photo data
    const { data: faceProfiles, error: fetchError } = await supabase
      .from("face_profiles")
      .select(
        `
        id,
        face_name,
        photo_id,
        created_at,
        photos (
          file_url
        )
      `
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (fetchError) {
      throw new Error(`Failed to fetch face profiles: ${fetchError.message}`)
    }

    if (!faceProfiles || faceProfiles.length === 0) {
      return NextResponse.json({
        success: true,
        unknown_faces: { face_name: "unknown", face_count: 0, face_ids: [], sample_photo_url: null },
        named_faces: [],
        total_faces: 0,
        total_people: 0,
      })
    }

    // Group faces by name manually
    const grouped = new Map<
      string,
      {
        face_name: string
        face_count: number
        face_ids: number[]
        sample_photo_url: string | null
        latest_detection: string
      }
    >()

    for (const profile of faceProfiles) {
      const name = profile.face_name || "unknown"
      const existing = grouped.get(name)

      if (existing) {
        existing.face_count++
        existing.face_ids.push(profile.id)
        // Keep the latest photo URL
        if (profile.created_at > existing.latest_detection) {
          existing.latest_detection = profile.created_at
          existing.sample_photo_url = (profile.photos as any)?.file_url || null
        }
      } else {
        grouped.set(name, {
          face_name: name,
          face_count: 1,
          face_ids: [profile.id],
          sample_photo_url: (profile.photos as any)?.file_url || null,
          latest_detection: profile.created_at,
        })
      }
    }

    // Convert to array
    const profiles = Array.from(grouped.values())

    // Separate unknown faces from named faces
    const unknownFaces = profiles.find((p) => p.face_name === "unknown")
    const namedFaces = profiles.filter((p) => p.face_name !== "unknown")

    return NextResponse.json({
      success: true,
      unknown_faces: unknownFaces || {
        face_name: "unknown",
        face_count: 0,
        face_ids: [],
        sample_photo_url: null,
      },
      named_faces: namedFaces,
      total_faces: faceProfiles.length,
      total_people: namedFaces.length,
    })
  } catch (error) {
    console.error("[FaceProfiles] Error fetching profiles:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch face profiles",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
