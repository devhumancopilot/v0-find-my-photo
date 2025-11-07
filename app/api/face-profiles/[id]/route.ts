/**
 * Face Profile API
 * PATCH: Update face name for a single profile
 * DELETE: Delete a face profile
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { updateFaceName, deleteFaceProfile } from "@/lib/services/database"

/**
 * PATCH /api/face-profiles/[id]
 * Update face name for a profile
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
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

    const faceProfileId = parseInt(params.id)
    if (isNaN(faceProfileId)) {
      return NextResponse.json({ error: "Invalid face profile ID" }, { status: 400 })
    }

    const body = await request.json()
    const { face_name } = body

    if (!face_name || typeof face_name !== "string") {
      return NextResponse.json({ error: "face_name is required and must be a string" }, { status: 400 })
    }

    // Update face name
    await updateFaceName(faceProfileId, face_name, user.id)

    return NextResponse.json({
      success: true,
      message: "Face name updated successfully",
    })
  } catch (error) {
    console.error("[FaceProfiles] Error updating face name:", error)
    return NextResponse.json(
      {
        error: "Failed to update face name",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/face-profiles/[id]
 * Delete a face profile
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
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

    const faceProfileId = parseInt(params.id)
    if (isNaN(faceProfileId)) {
      return NextResponse.json({ error: "Invalid face profile ID" }, { status: 400 })
    }

    // Delete face profile
    await deleteFaceProfile(faceProfileId, user.id)

    return NextResponse.json({
      success: true,
      message: "Face profile deleted successfully",
    })
  } catch (error) {
    console.error("[FaceProfiles] Error deleting face profile:", error)
    return NextResponse.json(
      {
        error: "Failed to delete face profile",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
