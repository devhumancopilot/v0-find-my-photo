/**
 * Hugging Face CLIP Service
 * Handles CLIP-based multimodal embeddings for images and text
 *
 * CLIP (Contrastive Language-Image Pre-training) creates embeddings in the same
 * vector space for both images and text, enabling direct comparison without
 * needing to generate captions first.
 *
 * Model: openai/clip-vit-base-patch32
 * Embedding dimensions: 512
 *
 * IMPORTANT: This now uses a custom CLIP service deployed on Hugging Face Spaces
 * Set CLIP_SERVICE_URL environment variable to your HF Space URL
 * Example: https://your-username-clip-inference-api.hf.space
 */

interface HuggingFaceEmbeddingResponse {
  embeddings?: number[][]
  error?: string
}

/**
 * Generate image embedding using CLIP model via HF Spaces
 * Returns 512-dimensional vector
 */
export async function generateCLIPImageEmbedding(base64: string, mimeType: string): Promise<number[]> {
  const clipServiceUrl = process.env.CLIP_SERVICE_URL

  if (!clipServiceUrl) {
    throw new Error("CLIP_SERVICE_URL not configured. Please deploy CLIP service to HF Spaces and set the URL.")
  }

  try {
    console.log("[HuggingFace][CLIP] ========================================")
    console.log("[HuggingFace][CLIP] Generating CLIP image embedding")
    console.log("[HuggingFace][CLIP] Service: HF Spaces")
    console.log("[HuggingFace][CLIP] Model: openai/clip-vit-base-patch32")
    console.log("[HuggingFace][CLIP] Expected dimensions: 512")
    console.log("[HuggingFace][CLIP] Image size: ~", Math.round(base64.length / 1024), "KB base64")
    console.log("[HuggingFace][CLIP] ========================================")

    const response = await fetch(`${clipServiceUrl}/embed/image`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image: base64,
        mime_type: mimeType
      }),
      // Increase timeout for cold starts (HF Spaces can take 60s to wake up)
      signal: AbortSignal.timeout(90000) // 90 seconds
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[HuggingFace][CLIP] ❌ API error:", response.status)
      console.error("[HuggingFace][CLIP] ❌ Response body:", errorText)
      console.error("[HuggingFace][CLIP] ❌ Endpoint used:", `${clipServiceUrl}/embed/image`)

      // Check if service is unavailable (cold start or down)
      if (response.status === 503) {
        throw new Error("CLIP service is unavailable. It may be waking up from cold start. Please try again in 60 seconds.")
      }

      throw new Error(`HF Spaces API error (${response.status}): ${errorText}`)
    }

    const result = await response.json()

    // Validate response
    if (!result.embedding || !Array.isArray(result.embedding)) {
      console.error("[HuggingFace][CLIP] ❌ Invalid response format:", result)
      throw new Error("Invalid response format from CLIP service")
    }

    if (result.embedding.length !== 512) {
      console.error("[HuggingFace][CLIP] ❌ Invalid embedding dimensions:", result.embedding.length)
      throw new Error(`Invalid CLIP embedding dimensions: ${result.embedding.length}, expected 512`)
    }

    console.log("[HuggingFace][CLIP] ✅ SUCCESS - Generated 512-dimensional CLIP image embedding")
    return result.embedding
  } catch (error) {
    console.error("[HuggingFace][CLIP] ❌ Error generating CLIP image embedding:", error)

    // Provide helpful error messages
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error("CLIP service request timed out (90s). The service may be experiencing cold start. Please try again.")
    }

    throw new Error(`Failed to generate CLIP image embedding: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

/**
 * Generate text embedding using CLIP model via HF Spaces
 * Returns 512-dimensional vector in the same space as image embeddings
 */
export async function generateCLIPTextEmbedding(text: string): Promise<number[]> {
  const clipServiceUrl = process.env.CLIP_SERVICE_URL

  if (!clipServiceUrl) {
    throw new Error("CLIP_SERVICE_URL not configured. Please deploy CLIP service to HF Spaces and set the URL.")
  }

  try {
    console.log("[HuggingFace][CLIP] ========================================")
    console.log("[HuggingFace][CLIP] Generating CLIP text embedding")
    console.log("[HuggingFace][CLIP] Service: HF Spaces")
    console.log("[HuggingFace][CLIP] Model: openai/clip-vit-base-patch32")
    console.log("[HuggingFace][CLIP] Expected dimensions: 512")
    console.log("[HuggingFace][CLIP] Text preview:", text.substring(0, 100))
    console.log("[HuggingFace][CLIP] Text length:", text.length, "characters")
    console.log("[HuggingFace][CLIP] ========================================")

    const response = await fetch(`${clipServiceUrl}/embed/text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
      // Increase timeout for cold starts
      signal: AbortSignal.timeout(90000) // 90 seconds
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[HuggingFace][CLIP] ❌ API error:", response.status)
      console.error("[HuggingFace][CLIP] ❌ Response body:", errorText)
      console.error("[HuggingFace][CLIP] ❌ Endpoint used:", `${clipServiceUrl}/embed/text`)

      // Check if service is unavailable
      if (response.status === 503) {
        throw new Error("CLIP service is unavailable. It may be waking up from cold start. Please try again in 60 seconds.")
      }

      throw new Error(`HF Spaces API error (${response.status}): ${errorText}`)
    }

    const result = await response.json()

    // Validate response
    if (!result.embedding || !Array.isArray(result.embedding)) {
      console.error("[HuggingFace][CLIP] ❌ Invalid response format:", result)
      throw new Error("Invalid response format from CLIP service")
    }

    if (result.embedding.length !== 512) {
      console.error("[HuggingFace][CLIP] ❌ Invalid embedding dimensions:", result.embedding.length)
      throw new Error(`Invalid CLIP embedding dimensions: ${result.embedding.length}, expected 512`)
    }

    console.log("[HuggingFace][CLIP] ✅ SUCCESS - Generated 512-dimensional CLIP text embedding")
    return result.embedding
  } catch (error) {
    console.error("[HuggingFace][CLIP] ❌ Error generating CLIP text embedding:", error)

    // Provide helpful error messages
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error("CLIP service request timed out (90s). The service may be experiencing cold start. Please try again.")
    }

    throw new Error(`Failed to generate CLIP text embedding: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

/**
 * Normalize vector to unit length
 * Required for cosine similarity comparison
 */
export function normalizeVector(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0))
  return vector.map(val => val / magnitude)
}

/**
 * Calculate cosine similarity between two vectors
 * Returns value between -1 and 1, where 1 means identical
 */
export function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error("Vectors must have same dimensions")
  }

  const dotProduct = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0)
  const magnitude1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0))
  const magnitude2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0))

  return dotProduct / (magnitude1 * magnitude2)
}
