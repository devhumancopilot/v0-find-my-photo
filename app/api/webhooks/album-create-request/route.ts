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
    const { description } = body

    // Create album request record
    const { data: albumRequest, error: requestError } = await supabase
      .from("album_requests")
      .insert({
        user_id: user.id,
        user_description: description,
        processing_status: "pending",
      })
      .select()
      .single()

    if (requestError) {
      console.error("[v0] Album request creation failed:", requestError)
      return NextResponse.json({ error: "Failed to create album request" }, { status: 500 })
    }

    // Trigger n8n webhook for AI processing
    const webhookResult = await triggerWebhook(process.env.N8N_WEBHOOK_ALBUM_CREATE_REQUEST, {
      userId: user.id,
      requestId: albumRequest.id,
      description,
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      requestId: albumRequest.id,
      webhookTriggered: webhookResult.success,
    })
  } catch (error) {
    console.error("[v0] Album create request webhook error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
