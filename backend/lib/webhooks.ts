/**
 * Utility functions for triggering n8n webhooks with fallback support
 */

/**
 * Map N8N webhook URLs to local fallback endpoints
 */
function mapToLocalWebhook(n8nUrl: string): string {
  const mapping: Record<string, string> = {
    [process.env.N8N_WEBHOOK_MANUAL_IMAGE_UPLOAD || ""]: "/api/dev-webhooks/photos-upload",
    [process.env.N8N_WEBHOOK_FIND_PHOTOS || ""]: "/api/dev-webhooks/find-photos",
    [process.env.N8N_WEBHOOK_ALBUM_FINALIZED || ""]: "/api/dev-webhooks/album-finalized",
  }

  const localPath = mapping[n8nUrl]
  if (!localPath) {
    throw new Error(`Unknown webhook URL: ${n8nUrl}`)
  }

  return localPath
}

/**
 * Trigger N8N webhook with automatic fallback to local handlers
 *
 * Flow:
 * 1. Try N8N webhook first (if configured)
 * 2. If N8N fails, automatically fallback to local webhook handlers
 * 3. If USE_LOCAL_WEBHOOKS=true, skip N8N and use local handlers directly
 */
export async function triggerWebhook(webhookUrl: string | undefined, payload: Record<string, unknown>) {
  const useLocalWebhooks = process.env.USE_LOCAL_WEBHOOKS === "true"
  const enableFallback = process.env.ENABLE_WEBHOOK_FALLBACK !== "false" // Default: true

  // If USE_LOCAL_WEBHOOKS is true, skip N8N entirely
  if (useLocalWebhooks) {
    console.log("[v0] USE_LOCAL_WEBHOOKS=true, using local webhook handlers")
    return await triggerLocalWebhook(webhookUrl || "", payload)
  }

  // If webhook URL not configured, try local fallback
  if (!webhookUrl) {
    console.warn("[v0] Webhook URL not configured")

    if (enableFallback) {
      console.log("[v0] Attempting fallback to local webhook handler")
      return await triggerLocalWebhook("", payload)
    }

    return { success: false, error: "Webhook URL not configured" }
  }

  // Try N8N webhook first
  try {
    console.log("[v0] Attempting N8N webhook:", webhookUrl)
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] N8N webhook failed with status", response.status)
      console.error("[v0] Response body:", errorText.substring(0, 500))
      throw new Error(`Webhook failed with status ${response.status}`)
    }

    // Try to parse JSON response, handle empty responses
    const responseText = await response.text()
    if (!responseText || responseText.trim() === "") {
      console.warn("[v0] N8N webhook returned empty response, treating as success")
      return { success: true, data: {} }
    }

    try {
      const data = JSON.parse(responseText)
      console.log("[v0] N8N webhook succeeded")
      return { success: true, data }
    } catch (jsonError) {
      console.error("[v0] Failed to parse N8N webhook response as JSON:", responseText.substring(0, 200))
      throw new Error(`Invalid JSON response from webhook: ${jsonError instanceof Error ? jsonError.message : "Unknown error"}`)
    }
  } catch (error) {
    console.error("[v0] N8N webhook failed:", error)

    // Attempt fallback if enabled
    if (enableFallback) {
      console.log("[v0] Attempting fallback to local webhook handler")
      try {
        return await triggerLocalWebhook(webhookUrl, payload)
      } catch (fallbackError) {
        console.error("[v0] Fallback also failed:", fallbackError)
        return {
          success: false,
          error: `N8N and fallback both failed. N8N: ${error instanceof Error ? error.message : "Unknown error"}. Fallback: ${fallbackError instanceof Error ? fallbackError.message : "Unknown error"}`,
        }
      }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Trigger local webhook handler (fallback)
 */
async function triggerLocalWebhook(n8nUrl: string, payload: Record<string, unknown>) {
  try {
    const localPath = mapToLocalWebhook(n8nUrl)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    const fullUrl = `${baseUrl}${localPath}`

    console.log("[v0] Calling local webhook:", fullUrl)

    const response = await fetch(fullUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] Local webhook failed with status", response.status)
      console.error("[v0] Error response:", errorText.substring(0, 1000))
      throw new Error(`Local webhook failed (${response.status}): ${errorText.substring(0, 200)}`)
    }

    // Parse response with better error handling
    const responseText = await response.text()

    if (!responseText || responseText.trim() === "") {
      console.warn("[v0] Local webhook returned empty response, treating as success")
      return { success: true, data: {} }
    }

    try {
      const data = JSON.parse(responseText)
      console.log("[v0] Local webhook succeeded")
      return { success: true, data }
    } catch (jsonError) {
      console.error("[v0] Failed to parse local webhook response as JSON:", responseText.substring(0, 200))
      throw new Error(`Invalid JSON from local webhook: ${jsonError instanceof Error ? jsonError.message : "Unknown error"}`)
    }
  } catch (error) {
    console.error("[v0] Local webhook error:", error)
    throw error
  }
}
