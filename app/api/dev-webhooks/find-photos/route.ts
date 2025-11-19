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
import { generateCLIPTextEmbedding } from "@/lib/services/huggingface"
import { matchPhotos } from "@/lib/services/database"
import { enhanceSearchResults, type PhotoWithMetadata } from "@/lib/services/search-enhancement"

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

    try {
      // Use service role client for server-to-server calls (this endpoint is internally authenticated)
      const { createServiceRoleClient } = await import("@/lib/supabase/server")
      const serviceSupabase = createServiceRoleClient()
      const matchCount = 50 // Increased to get more results including low similarity

      let allPhotos: any[]

      if (query) {
        // ==========================================
        // PURE CLIP TEXT SEARCH (caption + visual matching in same 512D space!)
        // Uses CLIP text embeddings for BOTH caption-based AND visual matching
        // This is what CLIP was designed for - perfect multimodal alignment!
        // ==========================================
        console.log(`[Fallback][CLIP][TEXT-SEARCH] Generating CLIP text embedding for query: "${query}"`)

        // Generate CLIP text embedding (512D) - compares with BOTH caption and image embeddings!
        const embeddingClip = await generateCLIPTextEmbedding(query)
        console.log(`[Fallback][CLIP][TEXT-SEARCH] ✓ CLIP text embedding: ${embeddingClip.length}D`)

        // Use hybrid search with SAME embedding for both
        // This works because BOTH embedding and embedding_clip are now CLIP 512D!
        console.log(`[Fallback][CLIP][TEXT-SEARCH] Performing pure CLIP hybrid search`)
        console.log(`[Fallback][CLIP][TEXT-SEARCH] User ID: ${requestUser.id}`)

        const { matchPhotosHybrid } = await import("@/lib/services/database")
        allPhotos = await matchPhotosHybrid(
          embeddingClip,     // 512D CLIP for caption matching (text-to-text)
          embeddingClip,     // 512D CLIP for visual matching (text-to-image)
          requestUser.id,
          matchCount,
          0.5,  // 50% weight for caption matching (text-to-text = high similarity)
          0.5,  // 50% weight for visual matching (text-to-image = lower similarity)
          serviceSupabase
        )
      } else if (image) {
        // ==========================================
        // IMAGE-BASED SEARCH (single embedding)
        // ==========================================
        console.log(`[Fallback][${embeddingConfig.provider.toUpperCase()}][IMAGE-SEARCH] Generating image embedding`)

        // Extract MIME type from base64 data URL if present
        const mimeMatch = image.match(/^data:([^;]+);base64,/)
        const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg"
        const base64Data = image.replace(/^data:[^;]+;base64,/, "")
        console.log(`[Fallback][${embeddingConfig.provider.toUpperCase()}][IMAGE-SEARCH] Image type: ${mimeType}`)

        const embedding = await generateImageEmbedding(base64Data, mimeType)
        console.log(`[Fallback][${embeddingConfig.provider.toUpperCase()}][IMAGE-SEARCH] ✓ Embedding generated: ${embedding.length}D`)

        // Prepare embedding for database query (handle dimension compatibility)
        const searchEmbedding = prepareEmbeddingForStorage(embedding)
        console.log(`[Fallback][${embeddingConfig.provider.toUpperCase()}] Search embedding prepared: ${searchEmbedding.length} dimensions`)

        console.log(`[Fallback][${embeddingConfig.provider.toUpperCase()}] Performing vector similarity search`)
        console.log(`[Fallback][${embeddingConfig.provider.toUpperCase()}] User ID: ${requestUser.id}`)

        allPhotos = await matchPhotos(searchEmbedding, requestUser.id, matchCount, serviceSupabase)
      } else {
        return NextResponse.json({ error: "No query or image provided" }, { status: 400 })
      }

      const searchType = query ? 'HYBRID' : embeddingConfig.provider.toUpperCase()
      console.log(`[Fallback][${searchType}] Found ${allPhotos.length} photos (before filtering)`)

      // Filter to only include photos above minimum similarity threshold
      // Note: Hybrid search combines both approaches:
      // - Caption matching (OpenAI): 50-90% similarity
      // - Visual matching (CLIP): 25-40% similarity
      // - Combined score: typically 40-70% for good matches
      const MIN_SIMILARITY = parseFloat(process.env.PHOTO_SEARCH_MIN_SIMILARITY || "0.40")
      const filteredPhotos = allPhotos.filter(p => p.similarity >= MIN_SIMILARITY)

      console.log(`[Fallback][${searchType}] After filtering (>= ${(MIN_SIMILARITY * 100).toFixed(0)}% similarity): ${filteredPhotos.length} photos`)

      // ENHANCED ALGORITHM: Apply multi-signal ranking and re-ranking
      let photos: any[] = filteredPhotos

      if (query && filteredPhotos.length > 0) {
        console.log(`[Fallback][ENHANCED] 🚀 Applying enhanced search algorithm...`)

        // Convert to PhotoWithMetadata format
        const photosWithMetadata: PhotoWithMetadata[] = filteredPhotos.map(p => ({
          id: p.id,
          name: p.name,
          file_url: p.file_url,
          caption: p.caption,
          similarity: p.similarity,
          created_at: p.created_at,
          is_favorite: p.is_favorite,
          data: p.data,
        }))

        // Apply enhanced search
        const enhancedPhotos = await enhanceSearchResults(query, photosWithMetadata)

        console.log(`[Fallback][ENHANCED] ✓ Enhanced ranking complete`)
        console.log(`[Fallback][ENHANCED] Top result improved from ${(filteredPhotos[0]?.similarity * 100).toFixed(1)}% to ${(enhancedPhotos[0]?.finalScore * 100).toFixed(1)}%`)

        photos = enhancedPhotos
      } else {
        console.log(`[Fallback][ENHANCED] ⏭️  Skipping enhancement (image search or no results)`)
      }

      // Log ALL matches with their similarity scores
      if (allPhotos.length > 0) {
        console.log(`[Fallback][${searchType}] ========== SEARCH RESULTS ==========`)
        photos.slice(0, 10).forEach((photo: any, index: number) => {
          const score = photo.finalScore || photo.similarity
          const similarityPercent = (score * 100).toFixed(2)
          // Adjust relevance thresholds based on search type
          // HYBRID: 60%+ = high, 45%+ = medium, 35%+ = low
          // CLIP: 35%+ = high, 28%+ = medium, 22%+ = low
          // OpenAI: 70%+ = high, 50%+ = medium, 35%+ = low
          const isHybridSearch = searchType === 'HYBRID'
          const isClipSearch = searchType === 'CLIP'
          const relevance = isHybridSearch
            ? (score >= 0.60 ? '🟢 HIGH' : score >= 0.45 ? '🟡 MEDIUM' : score >= 0.35 ? '🟠 LOW' : '🔴 VERY LOW')
            : isClipSearch
            ? (score >= 0.35 ? '🟢 HIGH' : score >= 0.28 ? '🟡 MEDIUM' : score >= 0.22 ? '🟠 LOW' : '🔴 VERY LOW')
            : (score >= 0.7 ? '🟢 HIGH' : score >= 0.5 ? '🟡 MEDIUM' : score >= 0.35 ? '🟠 LOW' : '🔴 VERY LOW')
          console.log(`[Fallback][${searchType}] ${index + 1}. ${relevance} ${similarityPercent}% - ${photo.name} (ID: ${photo.id})`)
        })
        if (photos.length > 10) {
          console.log(`[Fallback][${searchType}] ... and ${photos.length - 10} more`)
        }
        console.log(`[Fallback][${searchType}] ===================================`)

        // Summary by relevance level (adjusted for search type)
        const isHybridSearch = searchType === 'HYBRID'
        const isClipSearch = searchType === 'CLIP'

        const thresholds = isHybridSearch
          ? { high: 0.60, medHigh: 0.45, medLow: 0.35 }
          : isClipSearch
          ? { high: 0.35, medHigh: 0.28, medLow: 0.22 }
          : { high: 0.7, medHigh: 0.5, medLow: 0.35 }

        const high = photos.filter((p: any) =>
          (p.finalScore || p.similarity) >= thresholds.high
        ).length
        const medium = photos.filter((p: any) => {
          const score = p.finalScore || p.similarity
          return score >= thresholds.medHigh && score < thresholds.high
        }).length
        const low = photos.filter((p: any) => {
          const score = p.finalScore || p.similarity
          return score >= thresholds.medLow && score < thresholds.medHigh
        }).length

        const summaryMsg = isHybridSearch
          ? `Summary: ${high} high (≥60%), ${medium} medium (45-59%), ${low} low (35-44%)`
          : isClipSearch
          ? `Summary: ${high} high (≥35%), ${medium} medium (28-34%), ${low} low (22-27%)`
          : `Summary: ${high} high (≥70%), ${medium} medium (50-69%), ${low} low (35-49%)`
        console.log(`[Fallback][${searchType}] ${summaryMsg}`)
        console.log(`[Fallback][${searchType}] Returning ${photos.length} photos`)
      } else {
        console.log(`[Fallback][${searchType}] ⚠️ NO MATCHES FOUND`)
      }

      console.log(`[Fallback][SEARCH-END] ========================================`)
      console.log(`[Fallback][SEARCH-END] Search Complete`)
      console.log(`[Fallback][SEARCH-END] Method: ${query ? 'HYBRID (Text + CLIP)' : embeddingConfig.provider.toUpperCase()}`)
      console.log(`[Fallback][SEARCH-END] Results: ${photos.length} photos returned`)
      console.log(`[Fallback][SEARCH-END] ========================================`)

      // Format photos for response - use finalScore if available, otherwise similarity
      const formattedPhotos = photos.map((photo: any) => ({
        id: photo.id,
        name: photo.name,
        file_url: photo.file_url,
        caption: photo.caption,
        similarity: photo.finalScore || photo.similarity, // Use enhanced score
        created_at: photo.created_at,
        is_favorite: photo.is_favorite,
        // Include score breakdown for debugging (optional)
        ...(photo.scoreBreakdown && { scoreBreakdown: photo.scoreBreakdown }),
      }))

      return NextResponse.json({
        success: true,
        photos: formattedPhotos,
        count: formattedPhotos.length,
        searchType: query ? "text" : "image",
        albumTitle: albumTitle || null,
        enhanced: query && filteredPhotos.length > 0, // Flag indicating enhanced algorithm was used
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
