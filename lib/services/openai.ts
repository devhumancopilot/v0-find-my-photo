/**
 * OpenAI API Service
 * Handles image captioning and text embedding generation
 */

import OpenAI from "openai"

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * Generate image caption using GPT-4O Vision
 * Uses the exact prompt from N8N workflow
 */
export async function generateImageCaption(base64: string, mimeType: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Identify and describe what is shown in this image using short, factual tags. Focus on the main subject, scene type, and specific visual details such as objects, people, setting, activity, lighting, and environment. Each tag should be concise and concrete, avoiding abstract concepts, emotions, or artistic interpretation. Use clear, direct language — for example: 'red sports car, Ferrari, parked on street, daytime, city background, road markings, metal body, car logo visible, front view, sunny weather, motion blur'. Provide a minimum of 10 accurate and relevant tags that together give a complete, objective description of the image.'`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64}`,
                detail: "low",
              },
            },
          ],
        },
      ],
      max_tokens: 300,
    })

    const caption = response.choices[0]?.message?.content?.trim() || ""

    if (!caption) {
      throw new Error("No caption generated from OpenAI")
    }

    return caption
  } catch (error) {
    console.error("Error generating image caption:", error)
    throw new Error(`Failed to generate caption: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

/**
 * Generate text embedding using text-embedding-3-small
 * Returns 1536-dimensional vector
 */
export async function generateTextEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    })

    const embedding = response.data[0]?.embedding

    if (!embedding || embedding.length !== 1536) {
      throw new Error(`Invalid embedding dimensions: ${embedding?.length || 0}`)
    }

    return embedding
  } catch (error) {
    console.error("Error generating text embedding:", error)
    throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

/**
 * Generate embedding from image (caption-based approach)
 * First generates caption, then embeds the caption
 */
export async function generateImageEmbedding(base64: string, mimeType: string): Promise<number[]> {
  try {
    // First generate caption from image
    const caption = await generateImageCaption(base64, mimeType)

    // Then generate embedding from caption
    const embedding = await generateTextEmbedding(caption)

    return embedding
  } catch (error) {
    console.error("Error generating image embedding:", error)
    throw new Error(`Failed to generate image embedding: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}
