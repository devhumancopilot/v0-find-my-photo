# Enhanced Photo Search Algorithm

## Overview

The enhanced photo search algorithm combines **semantic vector search** with **multi-signal ranking** and **smart re-ranking** to deliver highly relevant, diverse photo results.

## Architecture

\`\`\`
User Query
    ↓
1. Query Enhancement (GPT-4)
    ↓
2. Generate Embedding (CLIP/OpenAI)
    ↓
3. Vector Similarity Search (Supabase)
    ↓
4. Multi-Signal Ranking
    ↓
5. Diversity Re-Ranking
    ↓
Enhanced Results
\`\`\`

## Components

### 1. Query Enhancement (`search-enhancement.ts`)

**Purpose**: Extract intent and context from natural language queries

**Process**:
- Uses GPT-4 Mini to analyze user queries
- Extracts keywords, temporal hints, and contextual information
- Enhances query with richer semantic meaning

**Example**:
\`\`\`typescript
Input: "beach photos from last summer with my dog"

Output: {
  enhancedQuery: "sunny beach vacation photographs featuring dog playing in sand...",
  keywords: ["beach", "summer", "dog", "vacation", "sand", "water"],
  temporalHints: { season: "summer", timeRange: "last year" },
  contextualHints: {
    locations: ["beach", "ocean"],
    activities: ["vacation", "playing"],
    objects: ["dog"]
  },
  searchIntent: "temporal"
}
\`\`\`

### 2. Multi-Signal Ranking

Combines multiple signals to calculate relevance score:

#### Signals & Weights:

| Signal | Weight | Description |
|--------|--------|-------------|
| **Embedding Similarity** | Base (0-1.0) | Core semantic similarity from CLIP/OpenAI |
| **Recency Boost** | +0-10% | Favors recent photos (linear decay over 365 days) |
| **Favorite Boost** | +15% | Significant boost for favorited photos |
| **Caption Match** | +0-10% | Keywords found in photo captions |
| **Temporal Relevance** | +0-20% | Season/time range matching |
| **Diversity Penalty** | -0-5% | Reduces similar photos in results |

#### Final Score Calculation:
\`\`\`
finalScore = min(1.0,
  embeddingSimilarity +
  recencyBoost +
  favoriteBoost +
  captionMatch +
  temporalRelevance -
  diversityPenalty
)
\`\`\`

### 3. Smart Re-Ranking with Diversity

**Purpose**: Prevent result clustering of similar photos

**Algorithm**:
- Maintains sliding window of recent results (default: 3 photos)
- Detects similar photo names (fuzzy matching)
- Applies 5% penalty to similar photos
- Re-sorts by adjusted final score

**Example**:
\`\`\`
Before:
1. beach_sunset_1.jpg (85%)
2. beach_sunset_2.jpg (84%)
3. beach_sunset_3.jpg (83%)
4. mountain_hike.jpg (75%)

After Re-Ranking:
1. beach_sunset_1.jpg (85%)
2. mountain_hike.jpg (75%)
3. beach_sunset_2.jpg (79% - penalty applied)
4. beach_sunset_3.jpg (78% - penalty applied)
\`\`\`

### 4. Temporal Relevance

**Season Matching**:
- Spring: March, April, May
- Summer: June, July, August
- Fall/Autumn: September, October, November
- Winter: December, January, February
- **Boost**: +20% for season match

**Time Range Matching**:
- "recent" / "this year" → Photos from current year: +20%
- "last year" → Photos from previous year: +20%

## Configuration

### Environment Variables

\`\`\`env
# Minimum similarity threshold (0.0 - 1.0)
PHOTO_SEARCH_MIN_SIMILARITY=0.35

# Use local webhooks instead of n8n
USE_LOCAL_WEBHOOKS=true

# Enable/disable webhook fallback
ENABLE_WEBHOOK_FALLBACK=true
\`\`\`

### Tuning Parameters

In `search-enhancement.ts`:

\`\`\`typescript
// Recency boost weight (0.1 = 10% max boost)
const recencyFactor = Math.max(0, 1 - daysSincePhoto / 365)
const recencyBoost = recencyFactor * 0.1

// Favorite boost (0.15 = 15% boost)
const favoriteBoost = photo.is_favorite ? 0.15 : 0

// Caption match weight (0.1 = 10% max boost)
const captionMatch = (matchedKeywords / totalKeywords) * 0.1

// Diversity penalty (0.05 = 5% penalty)
const diversityPenalty = 0.05

// Diversity sliding window size
const diversityWindow = 3
\`\`\`

## Usage

### Enable Enhanced Search

Set environment variable:
\`\`\`env
USE_LOCAL_WEBHOOKS=true
\`\`\`

### API Endpoint

\`\`\`
POST /api/dev-webhooks/find-photos
\`\`\`

**Request**:
\`\`\`json
{
  "user": { "id": "user-id", "email": "user@example.com" },
  "query": "beach photos from summer with my dog",
  "albumTitle": "Summer Vacation"
}
\`\`\`

**Response**:
\`\`\`json
{
  "success": true,
  "photos": [
    {
      "id": 123,
      "name": "beach_dog_1.jpg",
      "file_url": "https://...",
      "caption": "Golden retriever playing at the beach",
      "similarity": 0.87,
      "scoreBreakdown": {
        "embeddingSimilarity": 0.75,
        "recencyBoost": 0.05,
        "favoriteBoost": 0.15,
        "captionMatch": 0.08,
        "diversityPenalty": 0.0
      }
    }
  ],
  "count": 15,
  "searchType": "text",
  "enhanced": true
}
\`\`\`

## Performance

### Typical Response Times:
- Query Enhancement: ~500-800ms (GPT-4 Mini)
- Vector Search: ~100-300ms (Supabase)
- Multi-Signal Ranking: ~10-50ms
- Re-Ranking: ~5-20ms
- **Total**: ~600-1,200ms

### Optimization Tips:
1. Cache query enhancements for common phrases
2. Batch GPT requests if processing multiple queries
3. Adjust `matchCount` based on collection size
4. Use lower `MIN_SIMILARITY` threshold for small collections

## Search Intent Types

| Intent | Description | Optimizations |
|--------|-------------|---------------|
| `broad` | General search | Standard ranking |
| `specific` | Specific objects/scenes | Higher caption match weight |
| `temporal` | Time-based search | Temporal relevance boosting |
| `categorical` | Category-based | Keyword matching priority |

## Score Interpretation

| Score Range | Quality | Expected Results |
|-------------|---------|------------------|
| 70-100% | 🟢 HIGH | Very relevant matches |
| 50-69% | 🟡 MEDIUM | Good matches with some variance |
| 35-49% | 🟠 LOW | Loose matches, may be relevant |
| 0-34% | 🔴 VERY LOW | Filtered out by default |

## Example Queries

### Temporal Search
\`\`\`
"photos from last Christmas"
→ Boosts: winter season + last year timeframe
\`\`\`

### Categorical Search
\`\`\`
"pictures of my cat playing"
→ Boosts: caption keywords (cat, playing)
\`\`\`

### Location-Based Search
\`\`\`
"beach sunset photos"
→ Boosts: location keywords + activity context
\`\`\`

### People Search
\`\`\`
"family gathering at grandma's house"
→ Boosts: people context + location hints
\`\`\`

## Debugging

Enable detailed logging by checking console output:

\`\`\`
[Fallback][ENHANCED] 🚀 Applying enhanced search algorithm...
[Search Enhancement] Enhanced query: "..."
[Search Enhancement] Top 5 results:
  1. Score: 87.5% - beach_sunset_1.jpg
     Breakdown: Embedding=75%, Recency=5%, Favorite=15%, Caption=8%
\`\`\`

## Future Enhancements

Potential improvements:
1. ✅ Query enhancement with GPT
2. ✅ Multi-signal ranking
3. ✅ Diversity re-ranking
4. 🔜 Face recognition integration
5. 🔜 Object detection boosting
6. 🔜 Geolocation-based filtering
7. 🔜 Color/style preferences
8. 🔜 Machine learning re-ranker
9. 🔜 User preference learning
10. 🔜 Collaborative filtering

## Troubleshooting

### Issue: Low similarity scores
**Solution**: Lower `PHOTO_SEARCH_MIN_SIMILARITY` threshold

### Issue: Too many similar photos
**Solution**: Increase `diversityWindow` or `diversityPenalty`

### Issue: Favorites not showing up
**Solution**: Increase `favoriteBoost` weight

### Issue: Old photos dominating results
**Solution**: Increase `recencyBoost` weight or adjust decay rate

---

**Created**: 2025-01-18
**Last Updated**: 2025-01-18
**Version**: 1.0
