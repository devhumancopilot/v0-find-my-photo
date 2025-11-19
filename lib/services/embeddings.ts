/**
 * Unified Embedding Service
 *
 * Provides a unified interface for generating embeddings using different providers:
 * - OpenAI: text-embedding-3-small (1536 dimensions)
 * - Hugging Face CLIP: openai/clip-vit-base-patch32 (512 dimensions)
 *
 * Switch between providers using EMBEDDING_PROVIDER env variable
 */

import {
  generateTextEmbedding as openaiTextEmbedding,
  generateImageEmbedding as openaiImageEmbedding,
  generateImageCaption as openaiImageCaption,
} from "./openai"
import {
  generateCLIPTextEmbedding,
  generateCLIPImageEmbedding,
} from "./huggingface"

export type EmbeddingProvider = "openai" | "huggingface"

export interface EmbeddingConfig {
  provider: EmbeddingProvider
  dimensions: number
  supportsMultimodal: boolean
}

/**
 * Get the configured embedding provider
 */
export function getEmbeddingProvider(): EmbeddingProvider {
  const provider = process.env.EMBEDDING_PROVIDER?.toLowerCase()

  if (provider === "huggingface" || provider === "hf" || provider === "clip") {
    return "huggingface"
  }

  // Default to OpenAI
  return "openai"
}

/**
 * Get embedding configuration for the current provider
 */
export function getEmbeddingConfig(): EmbeddingConfig {
  const provider = getEmbeddingProvider()

  if (provider === "huggingface") {
    return {
      provider: "huggingface",
      dimensions: 512,
      supportsMultimodal: true, // CLIP natively supports images and text
    }
  }

  return {
    provider: "openai",
    dimensions: 1536,
    supportsMultimodal: false, // Uses caption-based approach
  }
}

/**
 * Generate text embedding using the configured provider
 */
export async function generateTextEmbedding(text: string): Promise<number[]> {
  const provider = getEmbeddingProvider()
  const config = getEmbeddingConfig()

  console.log(`[Embeddings][${provider.toUpperCase()}] Generating text embedding (${config.dimensions}D)`)
  console.log(`[Embeddings][${provider.toUpperCase()}] Text preview: "${text.substring(0, 50)}..."`)

  if (provider === "huggingface") {
    console.log(`[Embeddings][CLIP] Using CLIP multimodal text encoder`)
    return await generateCLIPTextEmbedding(text)
  }

  console.log(`[Embeddings][OPENAI] Using OpenAI text-embedding-3-small`)
  return await openaiTextEmbedding(text)
}

/**
 * Generate image embedding using the configured provider
 */
export async function generateImageEmbedding(base64: string, mimeType: string): Promise<number[]> {
  const provider = getEmbeddingProvider()
  const config = getEmbeddingConfig()

  console.log(`[Embeddings][${provider.toUpperCase()}] Generating image embedding (${config.dimensions}D)`)
  console.log(`[Embeddings][${provider.toUpperCase()}] Image type: ${mimeType}`)

  if (provider === "huggingface") {
    // CLIP approach: Direct image embedding
    console.log(`[Embeddings][CLIP] Using CLIP direct image embedding`)
    console.log(`[Embeddings][CLIP] Generating 512D CLIP image embedding`)

    const embedding = await generateCLIPImageEmbedding(base64, mimeType)

    console.log(`[Embeddings][CLIP] ✅ Image embedding generated: ${embedding.length}D`)
    return embedding
  }

  // OpenAI approach: caption -> embedding
  console.log(`[Embeddings][OPENAI] Using OpenAI vision API (caption-based approach)`)
  return await openaiImageEmbedding(base64, mimeType)
}

/**
 * Generate image caption using OpenAI GPT-4 Vision
 * Always uses OpenAI regardless of embedding provider
 */
export async function generateImageCaption(
  base64: string,
  mimeType: string
): Promise<string | null> {
  console.log("[Embeddings] Generating caption using OpenAI GPT-4 Vision")
  return await openaiImageCaption(base64, mimeType)
}

/**
 * Pad a vector to target dimensions with zeros
 * Used for backward compatibility when switching providers
 */
export function padVector(vector: number[], targetDimensions: number): number[] {
  if (vector.length === targetDimensions) {
    return vector
  }

  if (vector.length > targetDimensions) {
    console.warn(
      `[Embeddings] Vector has ${vector.length} dimensions but target is ${targetDimensions}. Truncating.`
    )
    return vector.slice(0, targetDimensions)
  }

  // Pad with zeros
  const padded = [...vector]
  while (padded.length < targetDimensions) {
    padded.push(0)
  }

  console.warn(
    `[Embeddings] Padded vector from ${vector.length} to ${targetDimensions} dimensions with zeros`
  )

  return padded
}

/**
 * Get the expected embedding dimensions for database storage
 * This should match your database schema
 */
export function getStorageDimensions(): number {
  // Check if database supports variable dimensions
  const variableDimensions = process.env.VARIABLE_EMBEDDING_DIMENSIONS === "true"

  if (variableDimensions) {
    // Use provider-specific dimensions
    return getEmbeddingConfig().dimensions
  }

  // Default to 1536 for backward compatibility
  // (existing database schema)
  return 1536
}

/**
 * Prepare embedding for storage
 * Handles dimension compatibility between provider and database
 */
export function prepareEmbeddingForStorage(embedding: number[]): number[] {
  const config = getEmbeddingConfig()
  const storageDimensions = getStorageDimensions()

  if (config.dimensions === storageDimensions) {
    // Perfect match, no conversion needed
    return embedding
  }

  // Need to adjust dimensions
  console.log(
    `[Embeddings] Converting embedding from ${config.dimensions} to ${storageDimensions} dimensions`
  )

  return padVector(embedding, storageDimensions)
}

/**
 * Get vector column type for database queries
 */
export function getVectorColumnType(): string {
  const dimensions = getStorageDimensions()
  return `vector(${dimensions})`
}
