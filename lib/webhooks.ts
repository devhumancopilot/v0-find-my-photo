/**
 * Utility functions for triggering n8n webhooks
 */

export async function triggerWebhook(webhookUrl: string | undefined, payload: Record<string, unknown>) {
  if (!webhookUrl) {
    console.warn("[v0] Webhook URL not configured, skipping webhook trigger")
    return { success: false, error: "Webhook URL not configured" }
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error(`Webhook failed with status ${response.status}`)
    }

    const data = await response.json()
    return { success: true, data }
  } catch (error) {
    console.error("[v0] Webhook trigger failed:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
