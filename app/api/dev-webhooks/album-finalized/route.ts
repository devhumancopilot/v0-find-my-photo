/**
 * Local Webhook Handler: Album Finalization
 * Fallback for N8N album creation workflow
 *
 * SECURITY NOTE: This endpoint does NOT perform authentication checks because:
 * - It's only called internally by authenticated endpoints
 * - The calling endpoint validates the user session before invoking this
 * - This is a server-to-server call, not a public API
 * - user_id is passed in the payload and validated by the caller
 *
 * DO NOT expose this endpoint directly to clients!
 */

import { NextRequest, NextResponse } from "next/server"
import { createAlbum, getPhotoById } from "@/lib/services/database"
import { createServiceRoleClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { user: requestUser, albumTitle, photoIds, description, coverPhotoId, timestamp } = body

    // Validate payload
    if (!requestUser?.id) {
      return NextResponse.json({ error: "Invalid payload: user.id required" }, { status: 400 })
    }

    if (!albumTitle || !photoIds || !Array.isArray(photoIds) || photoIds.length === 0) {
      return NextResponse.json(
        { error: "albumTitle and photoIds (non-empty array) are required" },
        { status: 400 }
      )
    }

    console.log(`[Fallback] Creating album "${albumTitle}" with ${photoIds.length} photos`)

    // Use service role client to bypass RLS
    const supabase = createServiceRoleClient()

    try {
      // SECURITY CHECK: Verify all photo IDs belong to the user
      // Even though the calling endpoint should validate this, we double-check for defense-in-depth
      const { data: verifiedPhotos, error: verifyError } = await supabase
        .from("photos")
        .select("id")
        .in("id", photoIds)
        .eq("user_id", requestUser.id)

      if (verifyError) {
        console.error("[Fallback] Error verifying photo ownership:", verifyError)
        return NextResponse.json(
          { error: "Failed to verify photo ownership" },
          { status: 500 }
        )
      }

      const verifiedPhotoIds = verifiedPhotos?.map(p => p.id) || []
      const unauthorizedPhotoIds = photoIds.filter(id => !verifiedPhotoIds.includes(id))

      if (unauthorizedPhotoIds.length > 0) {
        console.error(`[Fallback] ⚠️ SECURITY BREACH: Attempted to create album with ${unauthorizedPhotoIds.length} unauthorized photos!`)
        console.error(`[Fallback] User ID: ${requestUser.id}, Unauthorized photo IDs:`, unauthorizedPhotoIds)
        return NextResponse.json(
          { error: "Some photos do not belong to the user" },
          { status: 403 }
        )
      }

      console.log(`[Fallback] ✓ All ${photoIds.length} photos verified to belong to user ${requestUser.id}`)

      // Get cover photo ID (not URL - just like photos field stores IDs)
      const coverPhotoIdToUse = coverPhotoId || photoIds[0]

      // Verify cover photo also belongs to user
      if (!verifiedPhotoIds.includes(coverPhotoIdToUse)) {
        console.error(`[Fallback] ⚠️ SECURITY BREACH: Cover photo ${coverPhotoIdToUse} does not belong to user ${requestUser.id}`)
        return NextResponse.json(
          { error: "Cover photo does not belong to the user" },
          { status: 403 }
        )
      }

      console.log(`[Fallback] Using cover photo ID: ${coverPhotoIdToUse}`)

      // Create album - store photo ID in cover_image_url (not actual URL)
      console.log(`[Fallback] Inserting album into database`)
      const albumId = await createAlbum({
        album_title: albumTitle,
        description: description || null,
        cover_image_url: coverPhotoIdToUse.toString(), // Store ID as string
        photos: photoIds,
        user_id: requestUser.id,
        photo_count: photoIds.length,
      }, supabase)

      console.log(`[Fallback] Album created successfully (ID: ${albumId})`)

      return NextResponse.json({
        success: true,
        albumId,
        message: "Album created successfully",
      })
    } catch (albumError) {
      console.error("[Fallback] Album creation error:", albumError)
      return NextResponse.json(
        {
          error: "Failed to create album",
          details: albumError instanceof Error ? albumError.message : "Unknown error",
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error("[Fallback] Album finalized handler error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
