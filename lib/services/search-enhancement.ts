/**
 * Search Enhancement Service
 * Improves photo search with query enhancement, multi-signal ranking, and smart re-ranking
 */

import { openai } from "./openai"

export interface EnhancedQuery {
  originalQuery: string
  enhancedQuery: string
  keywords: string[]
  temporalHints: {
    season?: string
    timeOfDay?: string
    timeRange?: string
  }
  contextualHints: {
    people?: string[]
    locations?: string[]
    activities?: string[]
    objects?: string[]
    emotions?: string[]
  }
  searchIntent: "broad" | "specific" | "temporal" | "categorical"
}

export interface PhotoWithMetadata {
  id: number
  name: string
  file_url: string
  caption: string | null
  similarity: number
  created_at: string
  is_favorite?: boolean
  data?: any
}

export interface RankedPhoto extends PhotoWithMetadata {
  finalScore: number
  scoreBreakdown: {
    embeddingSimilarity: number
    recencyBoost: number
    favoriteBoost: number
    diversityPenalty: number
  }
}

/**
 * Enhance user query using GPT to extract intent and context
 */
export async function enhanceSearchQuery(userQuery: string): Promise<EnhancedQuery> {
  console.log(`[Search Enhancement] Analyzing query: "${userQuery}"`)

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a photo search query analyzer. Extract search intent, keywords, and context from user queries.
Respond ONLY with valid JSON, no markdown, no explanation.

Example query: "beach photos from last summer with my dog"
Response:
{
  "enhancedQuery": "sunny beach vacation photographs featuring dog playing in sand and water during summer season",
  "keywords": ["beach", "summer", "dog", "vacation", "sand", "water", "outdoor"],
  "temporalHints": {
    "season": "summer",
    "timeRange": "last year"
  },
  "contextualHints": {
    "people": [],
    "locations": ["beach", "ocean"],
    "activities": ["vacation", "playing"],
    "objects": ["dog"],
    "emotions": ["happy", "fun"]
  },
  "searchIntent": "temporal"
}`,
        },
        {
          role: "user",
          content: `Analyze this photo search query and respond with JSON only: "${userQuery}"`,
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
    })

    const content = response.choices[0]?.message?.content?.trim()
    if (!content) {
      throw new Error("Empty response from GPT")
    }

    // Parse the JSON response
    const analysis = JSON.parse(content)

    const enhancedQuery: EnhancedQuery = {
      originalQuery: userQuery,
      enhancedQuery: analysis.enhancedQuery || userQuery,
      keywords: analysis.keywords || [],
      temporalHints: analysis.temporalHints || {},
      contextualHints: analysis.contextualHints || {},
      searchIntent: analysis.searchIntent || "broad",
    }

    console.log(`[Search Enhancement] Enhanced query:`, {
      original: userQuery,
      enhanced: enhancedQuery.enhancedQuery,
      keywords: enhancedQuery.keywords.length,
      intent: enhancedQuery.searchIntent,
    })

    return enhancedQuery
  } catch (error) {
    console.error("[Search Enhancement] Failed to enhance query:", error)

    // Fallback: return original query with basic analysis
    return {
      originalQuery: userQuery,
      enhancedQuery: userQuery,
      keywords: userQuery.toLowerCase().split(/\s+/).filter(w => w.length > 2),
      temporalHints: {},
      contextualHints: {},
      searchIntent: "broad",
    }
  }
}

/**
 * Calculate multi-signal ranking score for photos
 */
export function calculateMultiSignalScore(
  photo: PhotoWithMetadata,
  enhancedQuery: EnhancedQuery,
  allPhotos: PhotoWithMetadata[]
): RankedPhoto {
  const now = new Date()
  const photoDate = new Date(photo.created_at)
  const daysSincePhoto = (now.getTime() - photoDate.getTime()) / (1000 * 60 * 60 * 24)

  // 1. Base similarity score (0-1)
  let embeddingSimilarity = photo.similarity

  // 2. Recency boost - favor recent photos slightly
  // Linear decay: 100% boost for today, 0% boost after 365 days
  let recencyBoost = 0
  if (enhancedQuery.searchIntent !== "temporal") {
    const recencyFactor = Math.max(0, 1 - daysSincePhoto / 365)
    recencyBoost = recencyFactor * 0.1 // Max 10% boost
  }

  // 3. Favorite boost - significant boost for favorites
  const favoriteBoost = photo.is_favorite ? 0.15 : 0 // 15% boost for favorites

  // 4. Diversity penalty (will be calculated in re-ranking)
  const diversityPenalty = 0

  // Calculate final score
  const finalScore = Math.min(
    1.0,
    embeddingSimilarity + recencyBoost + favoriteBoost - diversityPenalty
  )

  return {
    ...photo,
    finalScore,
    scoreBreakdown: {
      embeddingSimilarity,
      recencyBoost,
      favoriteBoost,
      diversityPenalty,
    },
  }
}

/**
 * Re-rank photos with diversity penalty to avoid too many similar photos
 */
export function reRankWithDiversity(
  rankedPhotos: RankedPhoto[],
  diversityWindow: number = 3
): RankedPhoto[] {
  const result: RankedPhoto[] = []
  const recentPhotoNames = new Set<string>()

  for (const photo of rankedPhotos) {
    let diversityPenalty = 0

    // Check if similar photo names exist in recent results
    const photoBaseName = photo.name
      .toLowerCase()
      .replace(/\d+/g, "") // Remove numbers
      .replace(/[_-]/g, " ") // Replace separators
      .trim()

    if (recentPhotoNames.has(photoBaseName)) {
      diversityPenalty = 0.05 // 5% penalty for similar names
    }

    // Apply diversity penalty
    const adjustedPhoto = {
      ...photo,
      finalScore: Math.max(0, photo.finalScore - diversityPenalty),
      scoreBreakdown: {
        ...photo.scoreBreakdown,
        diversityPenalty,
      },
    }

    result.push(adjustedPhoto)

    // Maintain sliding window of recent photo names
    recentPhotoNames.add(photoBaseName)
    if (recentPhotoNames.size > diversityWindow) {
      const firstEntry = Array.from(recentPhotoNames)[0]
      recentPhotoNames.delete(firstEntry)
    }
  }

  // Sort by adjusted final score
  return result.sort((a, b) => b.finalScore - a.finalScore)
}

/**
 * Calculate temporal relevance score
 */
export function calculateTemporalRelevance(
  photoDate: Date,
  temporalHints: EnhancedQuery["temporalHints"]
): number {
  if (!temporalHints.season && !temporalHints.timeRange) {
    return 0
  }

  let relevance = 0
  const photoMonth = photoDate.getMonth()

  // Season matching
  if (temporalHints.season) {
    const seasonMonths = {
      spring: [2, 3, 4], // Mar, Apr, May
      summer: [5, 6, 7], // Jun, Jul, Aug
      fall: [8, 9, 10], // Sep, Oct, Nov
      autumn: [8, 9, 10],
      winter: [11, 0, 1], // Dec, Jan, Feb
    }

    const months = seasonMonths[temporalHints.season.toLowerCase() as keyof typeof seasonMonths]
    if (months && months.includes(photoMonth)) {
      relevance += 0.2 // 20% boost for season match
    }
  }

  // Time range matching (simplified)
  if (temporalHints.timeRange) {
    const now = new Date()
    const yearsDiff = now.getFullYear() - photoDate.getFullYear()

    if (temporalHints.timeRange.includes("recent") || temporalHints.timeRange.includes("this year")) {
      if (yearsDiff === 0) relevance += 0.2
    } else if (temporalHints.timeRange.includes("last year")) {
      if (yearsDiff === 1) relevance += 0.2
    }
  }

  return relevance
}

/**
 * Main enhanced search pipeline
 */
export async function enhanceSearchResults(
  userQuery: string,
  rawPhotos: PhotoWithMetadata[]
): Promise<RankedPhoto[]> {
  console.log(`[Search Enhancement] Processing ${rawPhotos.length} photos for query: "${userQuery}"`)

  // Step 1: Enhance the query
  const enhancedQuery = await enhanceSearchQuery(userQuery)

  // Step 2: Calculate multi-signal scores
  const scoredPhotos = rawPhotos.map(photo => {
    const baseScore = calculateMultiSignalScore(photo, enhancedQuery, rawPhotos)

    // Add temporal relevance if applicable
    if (enhancedQuery.searchIntent === "temporal" || Object.keys(enhancedQuery.temporalHints).length > 0) {
      const photoDate = new Date(photo.created_at)
      const temporalRelevance = calculateTemporalRelevance(photoDate, enhancedQuery.temporalHints)

      return {
        ...baseScore,
        finalScore: Math.min(1.0, baseScore.finalScore + temporalRelevance),
        scoreBreakdown: {
          ...baseScore.scoreBreakdown,
          temporalRelevance,
        } as any,
      }
    }

    return baseScore
  })

  // Step 3: Re-rank with diversity
  const reRankedPhotos = reRankWithDiversity(scoredPhotos)

  console.log(`[Search Enhancement] Top 5 results:`)
  reRankedPhotos.slice(0, 5).forEach((photo, i) => {
    console.log(`  ${i + 1}. Score: ${(photo.finalScore * 100).toFixed(1)}% - ${photo.name}`)
    console.log(`     Breakdown: Embedding=${(photo.scoreBreakdown.embeddingSimilarity * 100).toFixed(1)}%, ` +
      `Recency=${(photo.scoreBreakdown.recencyBoost * 100).toFixed(1)}%, ` +
      `Favorite=${(photo.scoreBreakdown.favoriteBoost * 100).toFixed(1)}%`)
  })

  return reRankedPhotos
}
