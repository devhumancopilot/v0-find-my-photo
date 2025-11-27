/**
 * Bulk Update Face Profiles API
 * POST: Assign same name to multiple face profiles
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { bulkUpdateFaceNames } from "@/lib/services/database"

/**
 * POST /api/face-profiles/bulk-update
 * Assign same name to multiple face profiles at once
 *
 * Body:
 * {
 *   face_profile_ids: number[],
 *   face_name: string
 * }
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { face_profile_ids, face_name } = body

    // Validate input
    if (!Array.isArray(face_profile_ids) || face_profile_ids.length === 0) {
      return NextResponse.json({ error: "face_profile_ids must be a non-empty array" }, { status: 400 })
    }

    if (!face_name || typeof face_name !== "string") {
      return NextResponse.json({ error: "face_name is required and must be a string" }, { status: 400 })
    }

    // Validate all IDs are numbers
    if (!face_profile_ids.every((id) => typeof id === "number")) {
      return NextResponse.json({ error: "All face_profile_ids must be numbers" }, { status: 400 })
    }

    // Bulk update
    const updatedCount = await bulkUpdateFaceNames(face_profile_ids, face_name, user.id)

    return NextResponse.json({
      success: true,
      updated_count: updatedCount,
      message: `Successfully updated ${updatedCount} face profile(s)`,
    })
  } catch (error) {
    console.error("[FaceProfiles] Error bulk updating:", error)
    return NextResponse.json(
      {
        error: "Failed to bulk update face profiles",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
