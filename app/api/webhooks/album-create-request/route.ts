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
    const { query, image } = body

    // Validate input - must have either query or image
    if (!query && !image) {
      return NextResponse.json(
        { error: "Either 'query' (text) or 'image' (base64) must be provided" },
        { status: 400 }
      )
    }

    // Create album request record
    const { data: albumRequest, error: requestError } = await supabase
      .from("album_requests")
      .insert({
        user_id: user.id,
        user_description: query || "Image-based search",
        processing_status: "pending",
      })
      .select()
      .single()

    if (requestError) {
      console.error("[v0] Album request creation failed:", requestError)
      return NextResponse.json({ error: "Failed to create album request" }, { status: 500 })
    }

    // Prepare n8n webhook payload for Find Photos (Semantic Search)
    const n8nPayload: {
      userId: string
      requestId: number
      timestamp: string
      query?: string
      image?: string
    } = {
      userId: user.id,
      requestId: albumRequest.id,
      timestamp: new Date().toISOString(),
    }

    // Add query or image based on what was provided
    if (query) {
      n8nPayload.query = query
    }
    if (image) {
      n8nPayload.image = image
    }

    // Trigger n8n webhook for semantic search
    const webhookResult = await triggerWebhook(process.env.N8N_WEBHOOK_FIND_PHOTOS, n8nPayload)

    return NextResponse.json({
      success: true,
      requestId: albumRequest.id,
      webhookTriggered: webhookResult.success,
      searchType: query ? "text" : "image",
    })
  } catch (error) {
    console.error("[v0] Find photos webhook error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
