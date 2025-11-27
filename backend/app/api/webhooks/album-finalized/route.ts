import { createClient } from "@/lib/supabase/server"
import { triggerWebhook } from "@/lib/webhooks"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
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
    const { albumTitle, photoIds, description, coverPhotoId } = body

    // Validate input
    if (!albumTitle || !photoIds || !Array.isArray(photoIds) || photoIds.length === 0) {
      return NextResponse.json(
        { error: "albumTitle and photoIds (non-empty array) are required" },
        { status: 400 }
      )
    }

    // SECURITY CHECK: Verify all photo IDs belong to the authenticated user
    // This prevents users from adding other users' photos to their albums
    const { data: verifiedPhotos, error: verifyError } = await supabase
      .from("photos")
      .select("id")
      .in("id", photoIds)
      .eq("user_id", user.id)

    if (verifyError) {
      console.error("[v0] Error verifying photo ownership:", verifyError)
      return NextResponse.json(
        { error: "Failed to verify photo ownership" },
        { status: 500 }
      )
    }

    const verifiedPhotoIds = verifiedPhotos?.map(p => p.id) || []

    // Check if any requested photos don't belong to the user
    const unauthorizedPhotoIds = photoIds.filter(id => !verifiedPhotoIds.includes(id))
    if (unauthorizedPhotoIds.length > 0) {
      console.warn(`[v0] ⚠️ SECURITY: User ${user.id} attempted to add ${unauthorizedPhotoIds.length} unauthorized photos to album`)
      console.warn(`[v0] Unauthorized photo IDs:`, unauthorizedPhotoIds)
      return NextResponse.json(
        { error: "Some photos do not belong to you or do not exist" },
        { status: 403 }
      )
    }

    // Verify coverPhotoId also belongs to user if specified
    if (coverPhotoId && !verifiedPhotoIds.includes(coverPhotoId)) {
      console.warn(`[v0] ⚠️ SECURITY: User ${user.id} attempted to use unauthorized cover photo ${coverPhotoId}`)
      return NextResponse.json(
        { error: "Cover photo does not belong to you or does not exist" },
        { status: 403 }
      )
    }

    console.log(`[v0] ✓ All ${photoIds.length} photos verified to belong to user ${user.id}`)

    // Prepare n8n webhook payload
    const n8nPayload = {
      user: {
        id: user.id,
        email: user.email,
      },
      albumTitle: albumTitle,
      photoIds: photoIds,
      description: description || null,
      coverPhotoId: coverPhotoId || photoIds[0], // Default to first photo if not specified
      timestamp: new Date().toISOString(),
    }

    console.log("[v0] Triggering album finalization webhook:", {
      userId: user.id,
      albumTitle,
      photoCount: photoIds.length,
    })

    // Trigger n8n webhook - n8n will create album and link photos
    const webhookResult = await triggerWebhook(process.env.N8N_WEBHOOK_ALBUM_FINALIZED, n8nPayload)

    if (!webhookResult.success) {
      console.error("[v0] n8n webhook failed:", webhookResult.error)
      return NextResponse.json(
        { error: "Failed to create album. Please try again." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      albumId: webhookResult.data?.albumId || null,
      webhookTriggered: true,
      message: "Album created successfully",
    })
  } catch (error) {
    console.error("[v0] Album finalized webhook error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
