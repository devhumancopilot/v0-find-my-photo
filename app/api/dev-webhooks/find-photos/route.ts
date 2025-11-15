/**
 * Local Webhook Handler: Find Photos (Semantic Search)
 * Fallback for N8N semantic search workflow
 *
 * SECURITY NOTE: This endpoint does NOT perform authentication checks because:
 * - It's only called internally by /api/webhooks/album-create-request (which IS authenticated)
 * - The calling endpoint validates the user session before invoking this
 * - This is a server-to-server call, not a public API
 * - user_id is passed in the payload and validated by the caller
 *
 * DO NOT expose this endpoint directly to clients!
 */

import { NextRequest, NextResponse } from "next/server"
import {
  generateTextEmbedding,
  generateImageEmbedding,
  prepareEmbeddingForStorage,
  getEmbeddingConfig
} from "@/lib/services/embeddings"
import { matchPhotos } from "@/lib/services/database"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { user: requestUser, query, image, albumTitle, timestamp } = body

    // Validate payload
    if (!requestUser?.id) {
      return NextResponse.json({ error: "Invalid payload: user.id required" }, { status: 400 })
    }

    if (!query && !image) {
      return NextResponse.json({ error: "Either query (text) or image (base64) must be provided" }, { status: 400 })
    }

    const embeddingConfig = getEmbeddingConfig()
    console.log(`[Fallback][SEARCH-START] ========================================`)
    console.log(`[Fallback][SEARCH-START] Finding photos for user ${requestUser.id}`)
    console.log(`[Fallback][SEARCH-START] Search Type: ${query ? "TEXT" : "IMAGE"}`)
    console.log(`[Fallback][SEARCH-START] Provider: ${embeddingConfig.provider.toUpperCase()}`)
    console.log(`[Fallback][SEARCH-START] Dimensions: ${embeddingConfig.dimensions}D`)
    if (query) {
      console.log(`[Fallback][SEARCH-START] Query: "${query}"`)
    }
    console.log(`[Fallback][SEARCH-START] ========================================`)

    // First, check if user has any photos at all (diagnostic)
    try {
      const { createServiceRoleClient } = await import("@/lib/supabase/server")
      const supabase = createServiceRoleClient()

      // Use service role to bypass RLS for diagnostic
      const { count, error: countError } = await supabase
        .from("photos")
        .select("*", { count: "exact", head: true })
        .eq("user_id", requestUser.id)

      if (countError) {
        console.error(`[Fallback] Error checking photo count:`, countError)
      } else {
        console.log(`[Fallback] 📊 User has ${count || 0} total photos in database`)
        if (count === 0) {
          console.log(`[Fallback] ⚠️ WARNING: User has no photos! Upload photos first before searching.`)
        } else {
          // Get sample photo details
          const { data: samplePhoto } = await supabase
            .from("photos")
            .select("id, name, caption")
            .eq("user_id", requestUser.id)
            .limit(1)
            .single()

          if (samplePhoto) {
            console.log(`[Fallback] 📸 Sample photo: "${samplePhoto.name}" (ID: ${samplePhoto.id})`)
          }
        }
      }
    } catch (diagError) {
      console.error(`[Fallback] Diagnostic check failed:`, diagError)
    }

    let embedding: number[]

    try {
      if (query) {
        // Text-based search
        console.log(`[Fallback][${embeddingConfig.provider.toUpperCase()}][TEXT-SEARCH] Generating text embedding`)
        console.log(`[Fallback][${embeddingConfig.provider.toUpperCase()}][TEXT-SEARCH] Query: "${query}"`)
        embedding = await generateTextEmbedding(query)
        console.log(`[Fallback][${embeddingConfig.provider.toUpperCase()}][TEXT-SEARCH] ✓ Embedding generated: ${embedding.length}D`)
      } else if (image) {
        // Image-based search
        console.log(`[Fallback][${embeddingConfig.provider.toUpperCase()}][IMAGE-SEARCH] Generating image embedding`)
        // Extract MIME type from base64 data URL if present
        const mimeMatch = image.match(/^data:([^;]+);base64,/)
        const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg"
        const base64Data = image.replace(/^data:[^;]+;base64,/, "")
        console.log(`[Fallback][${embeddingConfig.provider.toUpperCase()}][IMAGE-SEARCH] Image type: ${mimeType}`)

        embedding = await generateImageEmbedding(base64Data, mimeType)
        console.log(`[Fallback][${embeddingConfig.provider.toUpperCase()}][IMAGE-SEARCH] ✓ Embedding generated: ${embedding.length}D`)
      } else {
        return NextResponse.json({ error: "No query or image provided" }, { status: 400 })
      }

      console.log(`[Fallback][${embeddingConfig.provider.toUpperCase()}] Raw embedding: ${embedding.length} dimensions`)

      // Prepare embedding for database query (handle dimension compatibility)
      const searchEmbedding = prepareEmbeddingForStorage(embedding)
      console.log(`[Fallback][${embeddingConfig.provider.toUpperCase()}] Search embedding prepared: ${searchEmbedding.length} dimensions`)

      // Use the prepared embedding for search
      embedding = searchEmbedding

      // Perform vector similarity search
      console.log(`[Fallback][${embeddingConfig.provider.toUpperCase()}] Performing vector similarity search`)
      console.log(`[Fallback][${embeddingConfig.provider.toUpperCase()}] User ID: ${requestUser.id}`)
      console.log(`[Fallback][${embeddingConfig.provider.toUpperCase()}] Embedding dimensions: ${embedding.length}`)

      const matchCount = 50 // Increased to get more results including low similarity
      const allPhotos = await matchPhotos(embedding, requestUser.id, matchCount)

      console.log(`[Fallback][${embeddingConfig.provider.toUpperCase()}] Found ${allPhotos.length} photos (before filtering)`)

      // Filter to only include photos above minimum similarity threshold
      const MIN_SIMILARITY = parseFloat(process.env.PHOTO_SEARCH_MIN_SIMILARITY || "0.4")
      const photos = allPhotos.filter(p => p.similarity >= MIN_SIMILARITY)

      console.log(`[Fallback][${embeddingConfig.provider.toUpperCase()}] After filtering (>= ${(MIN_SIMILARITY * 100).toFixed(0)}% similarity): ${photos.length} photos`)

      // Log ALL matches with their similarity scores
      if (allPhotos.length > 0) {
        console.log(`[Fallback][${embeddingConfig.provider.toUpperCase()}] ========== SEARCH RESULTS ==========`)
        allPhotos.forEach((photo, index) => {
          const similarityPercent = (photo.similarity * 100).toFixed(2)
          const relevance = photo.similarity >= 0.7 ? '🟢 HIGH' :
                           photo.similarity >= 0.5 ? '🟡 MEDIUM' :
                           photo.similarity >= 0.3 ? '🟠 LOW' :
                           '🔴 VERY LOW'
          console.log(`[Fallback][${embeddingConfig.provider.toUpperCase()}] ${index + 1}. ${relevance} ${similarityPercent}% - ${photo.name} (ID: ${photo.id})`)
        })
        console.log(`[Fallback][${embeddingConfig.provider.toUpperCase()}] ===================================`)

        // Summary by relevance level (from all photos)
        const high = allPhotos.filter(p => p.similarity >= 0.7).length
        const medium = allPhotos.filter(p => p.similarity >= 0.6 && p.similarity < 0.7).length
        const low = allPhotos.filter(p => p.similarity >= 0.3 && p.similarity < 0.6).length
        const veryLow = allPhotos.filter(p => p.similarity < 0.3).length

        console.log(`[Fallback][${embeddingConfig.provider.toUpperCase()}] Summary: ${high} high (≥70%), ${medium} medium (60-69%), ${low} low (30-59%), ${veryLow} very low (<30%)`)
        console.log(`[Fallback][${embeddingConfig.provider.toUpperCase()}] Returning ${photos.length} photos (≥${(MIN_SIMILARITY * 100).toFixed(0)}% similarity)`)
      } else {
        console.log(`[Fallback][${embeddingConfig.provider.toUpperCase()}] ⚠️ NO MATCHES FOUND`)
      }

      console.log(`[Fallback][SEARCH-END] ========================================`)
      console.log(`[Fallback][SEARCH-END] Search Complete`)
      console.log(`[Fallback][SEARCH-END] Provider: ${embeddingConfig.provider.toUpperCase()}`)
      console.log(`[Fallback][SEARCH-END] Results: ${photos.length} photos returned`)
      console.log(`[Fallback][SEARCH-END] ========================================`)

      return NextResponse.json({
        success: true,
        photos,
        count: photos.length,
        searchType: query ? "text" : "image",
        albumTitle: albumTitle || null,
      })
    } catch (searchError) {
      console.error("[Fallback] Search error:", searchError)
      return NextResponse.json(
        {
          error: "Search failed",
          details: searchError instanceof Error ? searchError.message : "Unknown error",
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error("[Fallback] Find photos handler error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
