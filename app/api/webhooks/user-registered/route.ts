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
    const { email, displayName } = body

    // Create user profile
    const { error: profileError } = await supabase.from("profiles").insert({
      id: user.id,
      email,
      display_name: displayName,
    })

    if (profileError) {
      console.error("[v0] Profile creation failed:", profileError)
      return NextResponse.json({ error: "Failed to create profile" }, { status: 500 })
    }

    // Trigger n8n webhook
    const webhookResult = await triggerWebhook(process.env.N8N_WEBHOOK_USER_REGISTERED, {
      userId: user.id,
      email,
      displayName,
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      userId: user.id,
      webhookTriggered: webhookResult.success,
    })
  } catch (error) {
    console.error("[v0] User registration webhook error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
