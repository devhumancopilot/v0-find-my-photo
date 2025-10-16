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
    const { sourceType, connectionData } = body

    // Create photo source record
    const { data: photoSource, error: sourceError } = await supabase
      .from("photo_sources")
      .insert({
        user_id: user.id,
        source_type: sourceType,
        is_connected: true,
        connection_data: connectionData || {},
      })
      .select()
      .single()

    if (sourceError) {
      console.error("[v0] Photo source creation failed:", sourceError)
      return NextResponse.json({ error: "Failed to create photo source" }, { status: 500 })
    }

    // Trigger n8n webhook
    const webhookResult = await triggerWebhook(process.env.N8N_WEBHOOK_PHOTO_SOURCE_CONNECTED, {
      userId: user.id,
      sourceType,
      sourceId: photoSource.id,
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      sourceId: photoSource.id,
      webhookTriggered: webhookResult.success,
    })
  } catch (error) {
    console.error("[v0] Photo source connected webhook error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
