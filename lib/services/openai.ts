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

/**
 * Vision Reasoning Result Interface
 * Used in Layer 4 re-ranking to validate semantic match
 */
export interface VisionReasoningResult {
  matches: boolean
  confidence: number // 0-100
  reasoning: string
  concerns: string[]
}

/**
 * Layer 4: GPT Vision Semantic Validation
 *
 * Evaluates if an image truly matches the user's query description.
 * This catches false positives from CLIP's semantic limitations.
 *
 * Examples of CLIP failures this catches:
 * - "bear" query → filters out panda images
 * - "beach" query → filters out desert images
 * - "dog" query → filters out wolf/fox images
 *
 * Uses GPT-4o Vision with low detail for cost optimization.
 * Applies to ALL search results, not just top N.
 */
export async function evaluateImageMatch(
  base64: string,
  mimeType: string,
  userQuery: string
): Promise<VisionReasoningResult> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert image analyst validating photo search results for album creation.

Your task: Determine if this image TRULY matches the user's description with high precision.

IMPORTANT: Be strict about semantic accuracy. Examples:
- "bear" does NOT match panda images (different animals)
- "beach" does NOT match desert/sand dunes (different environments)
- "dog" does NOT match wolves or foxes (different species)
- "sunset" does NOT match sunrise (different times)

Consider:
- Exact semantic match (is this what the user described?)
- Visual content (objects, people, scenes, activities)
- Context and setting (location, environment)
- Specific details mentioned in the query

Respond ONLY with valid JSON (no markdown, no code blocks):
{
  "matches": boolean,
  "confidence": number (0-100),
  "reasoning": "Brief explanation of your assessment",
  "concerns": ["list of mismatches or issues"] or []
}

Set "matches: false" if there's any semantic mismatch, even if visually similar.`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Does this image match the following description?\n\nUser Description: "${userQuery}"\n\nValidate semantic accuracy and respond with JSON only.`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64}`,
                detail: "low", // Low detail for cost optimization (~$0.01/image)
              },
            },
          ],
        },
      ],
      max_tokens: 300,
      temperature: 0.2, // Low temperature for consistent reasoning
    })

    const content = response.choices[0]?.message?.content?.trim()
    if (!content) {
      throw new Error("Empty response from GPT Vision")
    }

    // Remove markdown code blocks if present
    const cleanedContent = content
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim()

    // Parse JSON response
    const result = JSON.parse(cleanedContent) as VisionReasoningResult

    // Validate result structure
    if (typeof result.matches !== "boolean" ||
        typeof result.confidence !== "number" ||
        typeof result.reasoning !== "string") {
      throw new Error("Invalid response structure from GPT Vision")
    }

    // Normalize confidence to 0-100 range
    result.confidence = Math.max(0, Math.min(100, result.confidence))

    // Ensure concerns is an array
    if (!Array.isArray(result.concerns)) {
      result.concerns = []
    }

    return result
  } catch (error) {
    console.error("[Vision Reasoning] Error evaluating image match:", error)

    // On error: keep the image but log the issue
    // Better to include a potentially good image than filter it out due to API error
    return {
      matches: true,
      confidence: 50, // Neutral score (don't boost or penalize)
      reasoning: "Vision evaluation failed - keeping image with original score",
      concerns: [`API Error: ${error instanceof Error ? error.message : "Unknown error"}`],
    }
  }
}
