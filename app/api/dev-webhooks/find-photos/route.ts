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
import { matchPhotos, matchPhotosHybridReranked } from "@/lib/services/database"
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
        // CLIP ZERO-SHOT RE-RANKED SEARCH
        // Phase 1: Initial hybrid search with minimum CLIP threshold
        // Phase 2: Re-rank using reference image similarity
        //
        // This filters out images that match text but not visually,
        // then re-ranks remaining images by their visual similarity to the best match.
        // ==========================================
        console.log(`[Fallback][CLIP][RERANKED] Generating CLIP text embedding for query: "${query}"`)

        // Generate CLIP text embedding (512D) - compares with BOTH caption and image embeddings!
        const embeddingClip = await generateCLIPTextEmbedding(query)
        console.log(`[Fallback][CLIP][RERANKED] ✓ CLIP text embedding: ${embeddingClip.length}D`)

        // Use re-ranked hybrid search with CLIP zero-shot verification
        console.log(`[Fallback][CLIP][RERANKED] Performing CLIP zero-shot re-ranked search`)
        console.log(`[Fallback][CLIP][RERANKED] User ID: ${requestUser.id}`)

        // Configuration for re-ranking
        const MIN_CLIP_SCORE = parseFloat(process.env.CLIP_MIN_SCORE || "0.20") // 20% minimum CLIP similarity
        const REFERENCE_WEIGHT = parseFloat(process.env.CLIP_REFERENCE_WEIGHT || "0.5") // 50% weight for reference similarity
        const NUM_REFERENCES = parseInt(process.env.CLIP_NUM_REFERENCES || "3", 10) // Number of top results to use as references

        console.log(`[Fallback][CLIP][RERANKED] Min CLIP score: ${(MIN_CLIP_SCORE * 100).toFixed(0)}%`)
        console.log(`[Fallback][CLIP][RERANKED] Reference weight: ${(REFERENCE_WEIGHT * 100).toFixed(0)}%`)
        console.log(`[Fallback][CLIP][RERANKED] Num references: ${NUM_REFERENCES}`)

        allPhotos = await matchPhotosHybridReranked(
          embeddingClip,     // 512D CLIP for caption matching (text-to-text)
          embeddingClip,     // 512D CLIP for visual matching (text-to-image)
          requestUser.id,
          matchCount,
          MIN_CLIP_SCORE,    // Minimum CLIP score to include
          REFERENCE_WEIGHT,  // How much reference similarity affects ranking
          NUM_REFERENCES,    // Number of top results to use as references
          serviceSupabase
        )

        // Log reference images info if available
        const referencePhotos = allPhotos.filter((p: any) => p.is_reference)
        if (referencePhotos.length > 0) {
          console.log(`[Fallback][CLIP][RERANKED] Reference images selected (${referencePhotos.length}):`)
          referencePhotos.forEach((ref: any, idx: number) => {
            console.log(`[Fallback][CLIP][RERANKED]   ${idx + 1}. ${ref.name} - Text: ${(ref.similarity_text * 100).toFixed(2)}%, CLIP: ${(ref.similarity_clip * 100).toFixed(2)}%`)
          })
        }
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

      const searchType = query ? 'RERANKED' : embeddingConfig.provider.toUpperCase()
      console.log(`[Fallback][${searchType}] Found ${allPhotos.length} photos (after CLIP threshold filtering)`)

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
          // RERANKED: 80%+ = high, 60%+ = medium, 40%+ = low (scores are higher due to reference boost)
          // CLIP: 35%+ = high, 28%+ = medium, 22%+ = low
          // OpenAI: 70%+ = high, 50%+ = medium, 35%+ = low
          const isRerankedSearch = searchType === 'RERANKED'
          const isClipSearch = searchType === 'CLIP'
          const relevance = isRerankedSearch
            ? (score >= 0.80 ? '🟢 HIGH' : score >= 0.60 ? '🟡 MEDIUM' : score >= 0.40 ? '🟠 LOW' : '🔴 VERY LOW')
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
        const isRerankedSearch = searchType === 'RERANKED'
        const isClipSearch = searchType === 'CLIP'

        const thresholds = isRerankedSearch
          ? { high: 0.80, medHigh: 0.60, medLow: 0.40 }
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

        const summaryMsg = isRerankedSearch
          ? `Summary: ${high} high (≥80%), ${medium} medium (60-79%), ${low} low (40-59%)`
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
      console.log(`[Fallback][SEARCH-END] Method: ${query ? 'CLIP Zero-Shot Re-ranked' : embeddingConfig.provider.toUpperCase()}`)
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
        // Include re-ranking info if available
        ...(photo.reference_similarity !== undefined && {
          reference_similarity: photo.reference_similarity,
          is_reference: photo.is_reference,
          similarity_text: photo.similarity_text,
          similarity_clip: photo.similarity_clip,
        }),
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
