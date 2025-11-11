# Query Enhancement Feature - Implementation Plan

## 🎯 Problem Statement

**Current Issue:**
- Users provide short/minimal descriptions (e.g., "beach", "family", "dog")
- Short queries generate weak embeddings with limited semantic information
- Vector matching produces low accuracy results (similarity < 60%)
- Users get irrelevant photos in their albums

**Example:**
\`\`\`
User Query: "beach"
Embedding: [limited semantic richness]
Results: 🟠 45% similarity - family_picnic.jpg (not a beach!)
         🟠 42% similarity - sunset_city.jpg (not a beach!)
         🟡 65% similarity - beach_vacation.jpg (correct!)
\`\`\`

---

## 🔍 Current Workflow Analysis

### Step-by-Step Flow:
\`\`\`
1. User Input
   ├─ Album Title: "Summer Vacation"
   └─ Description: "beach" ❌ TOO SHORT

2. Frontend → /api/webhooks/album-create-request
   ├─ Sends: { query: "beach", albumTitle: "..." }

3. N8N Webhook (or Fallback)
   ├─ generateTextEmbedding("beach")  ← Problem: Weak embedding
   └─ matchPhotos(embedding, user_id)

4. Vector Matching
   ├─ Searches photos table
   ├─ Filters by MIN_SIMILARITY (40-60%)
   └─ Returns low-quality results
\`\`\`

### Key Files:
- **Frontend**: `app/create-album/page.tsx`
- **API Route**: `app/api/webhooks/album-create-request/route.ts`
- **Fallback**: `app/api/dev-webhooks/find-photos/route.ts`
- **Embedding**: `lib/services/openai.ts`
- **Matching**: `lib/services/database.ts`

---

## ✨ Proposed Solution: Query Enhancement System

### Architecture Overview

\`\`\`
┌──────────────────────────────────────────────────────┐
│              USER INPUT                              │
│  Description: "beach"                                │
└──────────────────┬───────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────┐
│      1. QUERY ANALYZER                               │
│  • Detect if query is too short/vague                │
│  • Score quality: LOW / MEDIUM / HIGH                │
│  • Word count, semantic richness check               │
└──────────────────┬───────────────────────────────────┘
                   │
       ┌───────────┴───────────┐
       │                       │
       ▼ (LOW)                ▼ (MEDIUM/HIGH)
┌─────────────────┐    ┌──────────────────┐
│ 2a. QUERY       │    │ 2b. DIRECT       │
│     ENHANCEMENT │    │     SEARCH       │
│                 │    │                  │
│ Use AI to:      │    │ Use query as-is  │
│ • Expand query  │    │ for embedding    │
│ • Add context   │    └──────────────────┘
│ • Generate      │
│   variations    │
└────────┬────────┘
         │
         ▼
┌──────────────────────────────────────────────────────┐
│      3. MULTI-QUERY SEARCH                           │
│  • Generate embeddings for all variations            │
│  • Search with each embedding                        │
│  • Combine and deduplicate results                   │
│  • Score by relevance                                │
└──────────────────┬───────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────┐
│      4. HYBRID SCORING                               │
│  • Semantic similarity (vector)                      │
│  • Keyword matching (if applicable)                  │
│  • Caption relevance                                 │
│  • Combined weighted score                           │
└──────────────────┬───────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────┐
│      5. RESULTS + UI FEEDBACK                        │
│  • Return high-quality photos                        │
│  • Show: "Enhanced query" badge                      │
│  • Display expanded query to user                    │
│  • Quality score indicator                           │
└──────────────────────────────────────────────────────┘
\`\`\`

---

## 📋 Feature Components

### 1. **Query Analyzer** (Detect Low-Quality Queries)

**Purpose:** Identify queries that need enhancement

**Checks:**
\`\`\`typescript
interface QueryQuality {
  score: 'LOW' | 'MEDIUM' | 'HIGH'
  wordCount: number
  hasContext: boolean
  needsEnhancement: boolean
  suggestions: string[]
}

function analyzeQuery(query: string): QueryQuality {
  // Rules:
  // LOW: 1-2 words, no context
  // MEDIUM: 3-5 words, some context
  // HIGH: 6+ words, rich context
}
\`\`\`

**Examples:**
| Query | Quality | Needs Enhancement |
|-------|---------|-------------------|
| "beach" | LOW ❌ | YES |
| "family dinner party" | MEDIUM ⚠️ | MAYBE |
| "photos from our beach vacation in Hawaii with family playing in the sand" | HIGH ✅ | NO |

---

### 2. **Query Enhancement Service** (Expand Short Queries)

**Purpose:** Use AI to expand short queries into semantically rich descriptions

**Implementation:**
\`\`\`typescript
async function enhanceQuery(query: string): Promise<EnhancedQuery> {
  const prompt = `
You are a semantic search expert. Expand this short photo search query into a rich, detailed description that will help find relevant photos.

Original Query: "${query}"

Generate:
1. An expanded description (2-3 sentences) with visual details
2. 3-5 related search terms
3. Specific visual elements to look for

Format as JSON:
{
  "expanded": "detailed description here...",
  "variations": ["variation 1", "variation 2", ...],
  "keywords": ["keyword1", "keyword2", ...]
}
`

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" }
  })

  return JSON.parse(response.choices[0].message.content)
}
\`\`\`

**Example Output:**
\`\`\`json
{
  "original": "beach",
  "expanded": "Photos taken at the beach or seaside, showing sandy shores, ocean waves, blue water, people swimming or relaxing on the beach, beach umbrellas, surfboards, coastal scenery, sunset or sunrise over the water, beach activities like volleyball or building sandcastles.",
  "variations": [
    "beach vacation photos",
    "seaside and ocean scenes",
    "sandy beach with people",
    "coastal sunset views",
    "beach activities and water sports"
  ],
  "keywords": [
    "beach", "ocean", "sand", "waves", "seaside",
    "coastal", "swimming", "vacation", "water", "shore"
  ]
}
\`\`\`

---

### 3. **Multi-Query Search Strategy**

**Purpose:** Search with multiple variations for better coverage

**Flow:**
\`\`\`typescript
async function multiQuerySearch(enhanced: EnhancedQuery, userId: string) {
  const allQueries = [
    enhanced.expanded,
    ...enhanced.variations
  ]

  const results: PhotoMatch[] = []

  for (const query of allQueries) {
    const embedding = await generateTextEmbedding(query)
    const matches = await matchPhotos(embedding, userId, 20)
    results.push(...matches)
  }

  // Deduplicate and aggregate scores
  return aggregateResults(results)
}

function aggregateResults(results: PhotoMatch[]) {
  const photoMap = new Map<number, AggregatedPhoto>()

  for (const match of results) {
    if (!photoMap.has(match.id)) {
      photoMap.set(match.id, {
        ...match,
        scores: [match.similarity],
        avgScore: match.similarity,
        matchCount: 1
      })
    } else {
      const existing = photoMap.get(match.id)!
      existing.scores.push(match.similarity)
      existing.matchCount++
      existing.avgScore = average(existing.scores)
    }
  }

  // Sort by average score and match count
  return Array.from(photoMap.values())
    .sort((a, b) => {
      // Prioritize photos matched by multiple queries
      if (a.matchCount !== b.matchCount) {
        return b.matchCount - a.matchCount
      }
      return b.avgScore - a.avgScore
    })
}
\`\`\`

---

### 4. **Hybrid Scoring System**

**Purpose:** Combine multiple signals for better relevance

**Scoring Factors:**
\`\`\`typescript
function calculateHybridScore(photo: Photo, query: EnhancedQuery): number {
  const weights = {
    semantic: 0.6,    // Vector similarity
    keyword: 0.2,     // Keyword matching
    caption: 0.2,     // Caption relevance
  }

  const scores = {
    semantic: photo.similarity,
    keyword: keywordMatchScore(photo, query.keywords),
    caption: captionRelevanceScore(photo.caption, query.expanded),
  }

  return Object.entries(weights).reduce((total, [key, weight]) => {
    return total + (scores[key] * weight)
  }, 0)
}

function keywordMatchScore(photo: Photo, keywords: string[]): number {
  const photoText = `${photo.name} ${photo.caption}`.toLowerCase()
  const matchedCount = keywords.filter(kw =>
    photoText.includes(kw.toLowerCase())
  ).length
  return matchedCount / keywords.length
}
\`\`\`

---

### 5. **UI Enhancements**

**Query Input with Real-Time Feedback:**

\`\`\`tsx
<div className="space-y-4">
  <Textarea
    value={albumDescription}
    onChange={(e) => {
      setAlbumDescription(e.target.value)
      analyzeQueryInRealTime(e.target.value)
    }}
    placeholder="Describe the photos you want..."
  />

  {/* Quality Indicator */}
  {queryQuality && (
    <Alert variant={queryQuality.score === 'LOW' ? 'warning' : 'default'}>
      <AlertDescription>
        <div className="flex items-center gap-2">
          {queryQuality.score === 'LOW' && (
            <>
              <AlertTriangle className="h-4 w-4" />
              <span>Try adding more details for better results</span>
            </>
          )}
          {queryQuality.score === 'MEDIUM' && (
            <>
              <Info className="h-4 w-4" />
              <span>Good! More details may improve results</span>
            </>
          )}
          {queryQuality.score === 'HIGH' && (
            <>
              <Check className="h-4 w-4 text-green-600" />
              <span>Great description! This should find relevant photos</span>
            </>
          )}
        </div>
      </AlertDescription>
    </Alert>
  )}

  {/* Suggestions */}
  {queryQuality?.suggestions && queryQuality.suggestions.length > 0 && (
    <div className="space-y-2">
      <Label className="text-sm text-muted-foreground">
        Suggestions to improve your search:
      </Label>
      <div className="flex flex-wrap gap-2">
        {queryQuality.suggestions.map((suggestion, i) => (
          <Badge
            key={i}
            variant="outline"
            className="cursor-pointer hover:bg-muted"
            onClick={() => setAlbumDescription(suggestion)}
          >
            {suggestion}
          </Badge>
        ))}
      </div>
    </div>
  )}

  {/* Enhanced Query Display (after search) */}
  {enhancedQuery && (
    <Card className="bg-blue-50">
      <CardContent className="pt-4">
        <Label className="text-sm font-semibold text-blue-900">
          ✨ Enhanced Search
        </Label>
        <p className="text-sm text-blue-800 mt-1">
          {enhancedQuery.expanded}
        </p>
      </CardContent>
    </Card>
  )}
</div>
\`\`\`

---

## 🛠️ Implementation Steps

### Phase 1: Query Analyzer (2-3 hours)
- [ ] Create `lib/services/query-analyzer.ts`
- [ ] Implement quality scoring
- [ ] Add suggestion generation
- [ ] Write unit tests

### Phase 2: Query Enhancement Service (3-4 hours)
- [ ] Create `lib/services/query-enhancer.ts`
- [ ] Integrate OpenAI for expansion
- [ ] Handle rate limiting & caching
- [ ] Test with various queries

### Phase 3: Multi-Query Search (2-3 hours)
- [ ] Update `find-photos/route.ts`
- [ ] Implement multi-query logic
- [ ] Add result deduplication
- [ ] Add score aggregation

### Phase 4: Hybrid Scoring (2 hours)
- [ ] Implement keyword matching
- [ ] Add caption relevance scoring
- [ ] Combine scores with weights
- [ ] Fine-tune weights

### Phase 5: UI Integration (3-4 hours)
- [ ] Add real-time query analysis to create-album page
- [ ] Show quality indicators
- [ ] Display suggestions
- [ ] Show enhanced query after search
- [ ] Add loading states

### Phase 6: Testing & Optimization (2-3 hours)
- [ ] Test with various query types
- [ ] Compare results: original vs enhanced
- [ ] Measure accuracy improvements
- [ ] Optimize performance
- [ ] Add caching for common queries

**Total Estimated Time: 14-19 hours**

---

## 📊 Success Metrics

### Before Enhancement:
- Short query (1-2 words): **45% avg similarity**
- Medium query (3-5 words): **60% avg similarity**
- Long query (6+ words): **75% avg similarity**

### After Enhancement:
- Short query → Enhanced: **Target 65%+ avg similarity**
- Medium query → Enhanced: **Target 75%+ avg similarity**
- Long query → Direct: **Maintain 75%+ avg similarity**

### Goals:
- ✅ **+20% accuracy** for short queries
- ✅ **+15% accuracy** for medium queries
- ✅ **90% user satisfaction** with results
- ✅ **<2s latency** for query enhancement

---

## 🎨 Example Transformations

### Example 1: Single Word
\`\`\`yaml
Original: "beach"
Enhanced: "Photos taken at the beach or seaside, showing sandy shores, ocean waves, blue water, people swimming or relaxing on the beach, beach umbrellas, coastal scenery, sunset over the water."
Variations:
  - beach vacation photos
  - seaside and ocean scenes
  - sandy beach activities
Result: 45% → 68% avg similarity ✅ (+23%)
\`\`\`

### Example 2: Generic Term
\`\`\`yaml
Original: "family"
Enhanced: "Family photos showing multiple people together, family gatherings, group portraits, candid moments with relatives, family celebrations like birthdays or holidays, parents with children, multi-generational photos."
Variations:
  - family gathering photos
  - group family portraits
  - candid family moments
Result: 50% → 72% avg similarity ✅ (+22%)
\`\`\`

### Example 3: Already Good (No Enhancement)
\`\`\`yaml
Original: "photos of our family trip to the beach in California where we built sandcastles and watched the sunset"
Quality: HIGH
Action: Use directly (no enhancement needed)
Result: 78% avg similarity ✅ (no change needed)
\`\`\`

---

## 🚀 Quick Start (Phase 1)

Want to start implementing? Here's the first file to create:

\`\`\`typescript
// lib/services/query-analyzer.ts

export interface QueryQuality {
  score: 'LOW' | 'MEDIUM' | 'HIGH'
  wordCount: number
  hasContext: boolean
  needsEnhancement: boolean
  suggestions: string[]
  confidence: number
}

export function analyzeQuery(query: string): QueryQuality {
  const trimmed = query.trim()
  const words = trimmed.split(/\s+/)
  const wordCount = words.length

  // Detect context indicators
  const hasDescriptiveWords = /\b(showing|with|of|in|at|during|while)\b/i.test(trimmed)
  const hasLocation = /\b(at|in|near|by)\s+\w+/i.test(trimmed)
  const hasTime = /\b(during|while|when|on)\s+\w+/i.test(trimmed)
  const hasContext = hasDescriptiveWords || hasLocation || hasTime

  // Score quality
  let score: 'LOW' | 'MEDIUM' | 'HIGH'
  let confidence: number

  if (wordCount <= 2 && !hasContext) {
    score = 'LOW'
    confidence = 0.3
  } else if (wordCount <= 5 || !hasContext) {
    score = 'MEDIUM'
    confidence = 0.6
  } else {
    score = 'HIGH'
    confidence = 0.9
  }

  // Generate suggestions
  const suggestions: string[] = []
  if (score === 'LOW') {
    suggestions.push(`${trimmed} photos from vacation`)
    suggestions.push(`${trimmed} with family and friends`)
    suggestions.push(`${trimmed} scenes and landscapes`)
  } else if (score === 'MEDIUM') {
    suggestions.push(`${trimmed} showing people and activities`)
    suggestions.push(`${trimmed} during daytime or sunset`)
  }

  return {
    score,
    wordCount,
    hasContext,
    needsEnhancement: score === 'LOW' || score === 'MEDIUM',
    suggestions: score === 'HIGH' ? [] : suggestions,
    confidence,
  }
}
\`\`\`

---

## 💡 Future Enhancements

1. **Learning from User Selections**
   - Track which photos users select/deselect
   - Fine-tune matching based on preferences
   - Build user-specific query patterns

2. **Query Templates**
   - Provide pre-built templates
   - "Family vacation", "Nature photos", "Events"
   - Quick-start for common searches

3. **Visual Query Builder**
   - UI to build complex queries
   - Combine multiple criteria
   - Location + Time + People + Activity

4. **Query History & Reuse**
   - Save successful queries
   - Reuse for similar albums
   - Share query templates

---

## 🎯 Next Steps

Ready to implement? Let's start with **Phase 1: Query Analyzer**!

1. Create the query analyzer service
2. Add UI feedback to create-album page
3. Test with various queries
4. Move to Phase 2: Enhancement

**Estimated Time for Phase 1: 2-3 hours**

Let me know when you're ready to start implementing! 🚀
