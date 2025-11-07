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
    const { query, image, albumTitle } = body

    // Validate input - must have either query or image
    if (!query && !image) {
      return NextResponse.json(
        { error: "Either 'query' (text) or 'image' (base64) must be provided" },
        { status: 400 }
      )
    }

    // Prepare n8n webhook payload for Find Photos (Semantic Search)
    // n8n will handle ALL database operations
    const n8nPayload = {
      user: {
        id: user.id,
        email: user.email,
      },
      albumTitle: albumTitle,
      query: query || null,
      image: image || null,
      timestamp: new Date().toISOString(),
    }

    console.log("[v0] Triggering find photos webhook:", {
      userId: user.id,
      albumTitle,
      searchType: query ? "text" : "image",
    })

    // Trigger n8n webhook for semantic search
    const webhookResult = await triggerWebhook(process.env.N8N_WEBHOOK_FIND_PHOTOS, n8nPayload)

    if (!webhookResult.success) {
      console.error("[v0] n8n webhook failed:", webhookResult.error)
      return NextResponse.json(
        { error: "Failed to find photos. Please try again." },
        { status: 500 }
      )
    }

    // Return the photo results from webhook
    // webhookResult.data contains { success, photos, count, searchType }
    const photos = webhookResult.data?.photos || []

    console.log(`[v0] Returning ${photos.length} photos to frontend`)

    return NextResponse.json({
      success: true,
      webhookTriggered: true,
      searchType: query ? "text" : "image",
      photos: photos,
      count: photos.length,
    })
  } catch (error) {
    console.error("[v0] Find photos webhook error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
