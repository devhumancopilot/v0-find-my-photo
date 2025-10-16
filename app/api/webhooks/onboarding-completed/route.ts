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
    const { selectedSources } = body

    // Update user profile with onboarding completion
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)

    if (updateError) {
      console.error("[v0] Profile update failed:", updateError)
    }

    // Trigger n8n webhook
    const webhookResult = await triggerWebhook(process.env.N8N_WEBHOOK_ONBOARDING_COMPLETED, {
      userId: user.id,
      selectedSources,
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      userId: user.id,
      webhookTriggered: webhookResult.success,
    })
  } catch (error) {
    console.error("[v0] Onboarding completed webhook error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
