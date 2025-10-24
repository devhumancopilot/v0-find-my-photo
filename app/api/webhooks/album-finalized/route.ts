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
