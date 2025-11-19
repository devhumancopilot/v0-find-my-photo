/**
 * OpenAI API Service
 * Handles image captioning and text embedding generation
 */

import OpenAI from "openai"

// Initialize OpenAI client
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * Clean caption by removing conversational text and formatting issues
 */
function cleanCaption(caption: string): string {
  // List of conversational phrases to remove (case-insensitive)
  const phrasesToRemove = [
    /^sure[!,.]?\s*/i,
    /^here\s+(is|are)\s+/i,
    /^here'?s\s+/i,
    /^this\s+image\s+(shows?|depicts?|contains?|features?)\s*/i,
    /^the\s+image\s+(shows?|depicts?|contains?|features?)\s*/i,
    /^in\s+this\s+image[,:]?\s*/i,
    /^i\s+can\s+see\s*/i,
    /^i\s+would\s+describe\s+this\s+as\s*/i,
    /^based\s+on\s+the\s+image[,:]?\s*/i,
    /^looking\s+at\s+this\s+image[,:]?\s*/i,
    /^the\s+tags?\s+(are|would\s+be)[:\s]*/i,
    /^tags?[:\s]+/i,
    /^description[:\s]+/i,
  ]

  let cleaned = caption

  // Remove conversational phrases from the beginning
  for (const phrase of phrasesToRemove) {
    cleaned = cleaned.replace(phrase, "")
  }

  // Remove quotes if the entire caption is wrapped in them
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) ||
      (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1)
  }

  // Remove any leading/trailing punctuation except commas and periods within tags
  cleaned = cleaned.trim()

  // Remove multiple spaces
  cleaned = cleaned.replace(/\s+/g, " ")

  // Ensure first character is not a comma or colon
  cleaned = cleaned.replace(/^[,:\s]+/, "")

  return cleaned.trim()
}

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
          role: "system",
          content: "You generate short, clear, one-sentence captions that describe what you see in images.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Describe this image in one short sentence that captures everything important about what you see.",
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
      temperature: 0.3,
    })

    let caption = response.choices[0]?.message?.content?.trim() || ""

    if (!caption) {
      throw new Error("No caption generated from OpenAI")
    }

    // Clean up any conversational text that might have slipped through
    caption = cleanCaption(caption)

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
