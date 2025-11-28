/**
 * Streaming endpoint for album photo search with real-time progress
 * Uses Server-Sent Events (SSE) to stream progress updates
 * This prevents Vercel timeout and provides interactive user experience
 */

import { createClient } from "@/lib/supabase/server"
import { NextRequest } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300 // 5 minutes for AI vision processing

// Helper to send SSE events
function sendSSE(controller: ReadableStreamDefaultController, event: string, data: any) {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  controller.enqueue(new TextEncoder().encode(message))
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  // Verify authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  const body = await request.json()
  const { query, image, albumTitle } = body

  // Validate input
  if (!query && !image) {
    return new Response(
      JSON.stringify({ error: "Either 'query' (text) or 'image' (base64) must be provided" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    )
  }

  // Create streaming response
  const stream = new ReadableStream({
    async start(controller) {
      // Setup heartbeat to keep connection alive (especially important on Render)
      const heartbeat = setInterval(() => {
        try {
          sendSSE(controller, "ping", { timestamp: Date.now() })
        } catch (error) {
          clearInterval(heartbeat)
        }
      }, 20000) // Every 20 seconds

      try {
        // Send initial event
        sendSSE(controller, "start", {
          message: "Let's find your perfect photos!",
          userId: user.id,
          searchType: query ? "text" : "image",
        })

        // Import services
        const {
          generateTextEmbedding,
          generateImageEmbedding,
          prepareEmbeddingForStorage,
          getEmbeddingConfig,
        } = await import("@/lib/services/embeddings")
        const { generateCLIPTextEmbedding } = await import("@/lib/services/huggingface")
        const { matchPhotosHybridReranked } = await import("@/lib/services/database")
        const { enhanceSearchResults, reRankWithVisionReasoning } = await import("@/lib/services/search-enhancement")
        const { createServiceRoleClient } = await import("@/lib/supabase/server")

        const serviceSupabase = createServiceRoleClient()
        const embeddingConfig = getEmbeddingConfig()

        sendSSE(controller, "progress", {
          stage: "embedding",
          message: "Understanding what you're looking for...",
          educational: "Converting your search into AI language",
        })

        let allPhotos: any[]

        if (query) {
          // CLIP text-to-image search
          const embeddingClip = await generateCLIPTextEmbedding(query)

          sendSSE(controller, "progress", {
            stage: "search",
            message: "Scanning through your photo collection...",
            educational: "Using AI to match visual content with your description",
          })

          const MIN_CLIP_SCORE = parseFloat(process.env.CLIP_MIN_SCORE || "0.20")
          const REFERENCE_WEIGHT = parseFloat(process.env.CLIP_REFERENCE_WEIGHT || "0.5")
          const NUM_REFERENCES = parseInt(process.env.CLIP_NUM_REFERENCES || "3", 10)

          allPhotos = await matchPhotosHybridReranked(
            embeddingClip,
            embeddingClip,
            user.id,
            50,
            MIN_CLIP_SCORE,
            REFERENCE_WEIGHT,
            NUM_REFERENCES,
            serviceSupabase
          )
        } else if (image) {
          // Image-based search
          const mimeMatch = image.match(/^data:([^;]+);base64,/)
          const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg"
          const base64Data = image.replace(/^data:[^;]+;base64,/, "")

          const embedding = await generateImageEmbedding(base64Data, mimeType)
          const searchEmbedding = prepareEmbeddingForStorage(embedding)

          const { matchPhotos } = await import("@/lib/services/database")
          allPhotos = await matchPhotos(searchEmbedding, user.id, 50, serviceSupabase)
        } else {
          throw new Error("No query or image provided")
        }

        sendSSE(controller, "progress", {
          stage: "filtering",
          message: `Great! Found ${allPhotos.length} matching photo${allPhotos.length === 1 ? '' : 's'}`,
          educational: "Filtering the best matches for you",
        })

        // Filter by minimum similarity
        const MIN_SIMILARITY = parseFloat(process.env.PHOTO_SEARCH_MIN_SIMILARITY || "0.40")
        const filteredPhotos = allPhotos.filter(p => p.similarity >= MIN_SIMILARITY)

        sendSSE(controller, "progress", {
          stage: "enhancing",
          message: `Ranking your top ${filteredPhotos.length} photo${filteredPhotos.length === 1 ? '' : 's'}...`,
          educational: "Organizing by relevance, recency, and your favorites",
        })

        let photos: any[] = filteredPhotos

        if (query && filteredPhotos.length > 0) {
          // Convert to format expected by enhanceSearchResults
          const photosWithMetadata = filteredPhotos.map((p: any) => ({
            id: p.id,
            name: p.name,
            file_url: p.file_url,
            caption: p.caption,
            similarity: p.similarity,
            created_at: p.created_at,
            is_favorite: p.is_favorite,
            data: p.data,
          }))

          // Apply Layers 2-3
          const enhancedPhotos = await enhanceSearchResults(query, photosWithMetadata)

          // Layer 4: Vision reasoning with progress streaming
          const enableVisionReasoning = process.env.ENABLE_VISION_RERANKING !== "false"

          if (enableVisionReasoning) {
            // Vision reasoning is FINAL AUTHORITY - process ALL photos from previous layers
            // Each photo must be explicitly approved by GPT-4 Vision to be included in results
            if (enhancedPhotos.length > 0) {
              sendSSE(controller, "progress", {
                stage: "vision_start",
                message: `Almost there! Checking all ${enhancedPhotos.length} photo${enhancedPhotos.length === 1 ? '' : 's'} with AI vision...`,
                educational: "Using advanced AI to ensure the best matches",
              })

              // Apply vision reasoning to ALL photos with progress callback
              const visionFilteredPhotos = await reRankWithVisionReasoning(
                enhancedPhotos,
                query,
                (event) => {
                  // Stream vision progress events
                  sendSSE(controller, "vision_progress", {
                    type: event.type,
                    current: event.current,
                    total: event.total,
                    message: event.message,
                    educational: event.educational,
                  })
                }
              )

              // Only return vision-validated photos (vision is final authority)
              photos = visionFilteredPhotos

              console.log(`[Vision] Validated ${visionFilteredPhotos.length}/${enhancedPhotos.length} photos (excluded ${enhancedPhotos.length - visionFilteredPhotos.length} mismatches)`)
            } else {
              photos = enhancedPhotos
            }
          } else {
            photos = enhancedPhotos
          }
        }

        // Verify photo ownership (security)
        sendSSE(controller, "progress", {
          stage: "verification",
          message: "Just finishing up...",
        })

        const photoIds = photos.map((p: any) => p.id).filter(Boolean)

        if (photoIds.length > 0) {
          const { data: verifiedPhotos } = await supabase
            .from("photos")
            .select("id")
            .in("id", photoIds)
            .eq("user_id", user.id)

          const verifiedPhotoIds = new Set(verifiedPhotos?.map(p => p.id) || [])
          photos = photos.filter((p: any) => verifiedPhotoIds.has(p.id))
        }

        // Send final results
        sendSSE(controller, "complete", {
          success: true,
          searchType: query ? "text" : "image",
          photos: photos,
          count: photos.length,
        })

        // Clear heartbeat
        clearInterval(heartbeat)

        // Wait 100ms before closing to ensure complete event is fully transmitted
        // This prevents race condition where stream closes before final event reaches client
        await new Promise(resolve => setTimeout(resolve, 100))
        controller.close()
      } catch (error) {
        console.error("[Stream] Error:", error)
        sendSSE(controller, "error", {
          error: "Internal server error",
          details: error instanceof Error ? error.message : "Unknown error",
        })
        clearInterval(heartbeat)

        // Wait 100ms before closing to ensure error event is fully transmitted
        await new Promise(resolve => setTimeout(resolve, 100))
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  })
}
