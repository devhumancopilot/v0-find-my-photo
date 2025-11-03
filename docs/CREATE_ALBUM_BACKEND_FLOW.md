# Create Album Backend Flow - Complete Guide

## 🎯 Overview

The "Create Album" feature is a **3-step wizard** that uses AI to find and organize photos based on user descriptions. Here's what happens at each step and what you need to develop in n8n.

---

## 📊 High-Level Architecture

\`\`\`
┌─────────────────────────────────────────────────────────────────────┐
│                         CREATE ALBUM FLOW                           │
└─────────────────────────────────────────────────────────────────────┘

STEP 1: Describe Album
┌──────────────┐    POST     ┌──────────────────────┐   Webhook   ┌─────────┐
│   Frontend   │ ────────>   │ album-create-request │ ──────────> │   n8n   │
│  (User Input)│             │      API Route        │             │         │
└──────────────┘             └──────────────────────┘             └─────────┘
                                      │                                  │
                                      ▼                                  ▼
                             Create album record              1. Perform semantic search
                             in database with                 2. Find matching photos
                             status: "pending"                3. Store results somewhere
                                                              4. (Optional) Update album status

STEP 2: Review AI Suggestions
┌──────────────┐                                              ┌─────────┐
│   Frontend   │ ◄─ Fetch AI results (YOUR IMPLEMENTATION) ── │   n8n   │
│ (Photo Grid) │                                              │         │
└──────────────┘                                              └─────────┘
       │
       ▼
User selects/deselects photos


STEP 3: Finalize Album
┌──────────────┐    POST     ┌──────────────────────┐   Webhook   ┌─────────┐
│   Frontend   │ ────────>   │  album-finalized     │ ──────────> │   n8n   │
│ (Selected    │             │      API Route        │             │         │
│  Photos)     │             └──────────────────────┘             └─────────┘
└──────────────┘                      │                                  │
                                      ▼                                  ▼
                             1. Create final album           (Optional) Post-processing
                             2. Create photo records         - Generate thumbnails
                             3. Link photos to album         - Extract metadata
                                                             - Send notifications
\`\`\`

---

## 🔍 STEP 1: "Find Photos" Button Click

### Frontend Action (app/create-album/page.tsx:41-79)

**What the User Does:**
1. Enters **album title** (optional): `"Summer Beach Trip"`
2. Enters **album description** (required): `"Photos from my beach vacation with palm trees and sunset"`
3. Clicks **"Find Photos"** button

**What the Frontend Sends:**
\`\`\`javascript
POST /api/webhooks/album-create-request

Headers: {
  "Content-Type": "application/json"
}

Body: {
  "query": "Photos from my beach vacation with palm trees and sunset",
  "albumTitle": "Summer Beach Trip"
}
\`\`\`

---

### Backend Processing (app/api/webhooks/album-create-request/route.ts)

**Line-by-Line Explanation:**

\`\`\`typescript
// 1. AUTHENTICATION (Lines 9-17)
const { data: { user }, error: authError } = await supabase.auth.getUser()

if (authError || !user) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}
\`\`\`
✅ Verifies user is logged in
✅ Gets user ID and email from JWT token

---

\`\`\`typescript
// 2. EXTRACT REQUEST DATA (Lines 19-20)
const body = await request.json()
const { query, image, albumTitle } = body
\`\`\`
✅ Extracts the search query and album title from request

---

\`\`\`typescript
// 3. VALIDATE INPUT (Lines 22-28)
if (!query && !image) {
  return NextResponse.json(
    { error: "Either 'query' (text) or 'image' (base64) must be provided" },
    { status: 400 }
  )
}
\`\`\`
✅ Ensures user provided either text query OR image for search

---

\`\`\`typescript
// 4. CREATE ALBUM RECORD IN DATABASE (Lines 30-42)
const { data: albumRequest, error: requestError } = await supabase
  .from("albums")
  .insert({
    user_id: user.id,                              // UUID of logged-in user
    description: query || "Image-based search",    // User's search query
    album_title: albumTitle || null,               // Album title (can be null)
    processing_status: "pending",                  // n8n hasn't processed yet
    status: "pending",                             // Album not finalized yet
    photo_count: 0,                                // No photos selected yet
  })
  .select()
  .single()
\`\`\`

**Database Record Created:**
\`\`\`json
{
  "id": 42,
  "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "album_title": "Summer Beach Trip",
  "description": "Photos from my beach vacation with palm trees and sunset",
  "photos": null,
  "cover_image_url": null,
  "photo_count": 0,
  "status": "pending",
  "processing_status": "pending",
  "created_at": "2025-01-15T14:22:00.000Z",
  "updated_at": "2025-01-15T14:22:00.000Z"
}
\`\`\`

**Why Create This Record?**
- ✅ Tracks the album creation request
- ✅ Links to specific user
- ✅ Stores original query for reference
- ✅ Allows n8n to update status later
- ✅ Provides `requestId` for tracking

---

\`\`\`typescript
// 5. PREPARE N8N WEBHOOK PAYLOAD (Lines 46-73)
const n8nPayload = {
  user: {
    id: user.id,                    // "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
    email: user.email,              // "user@example.com"
  },
  albumTitle: albumTitle,           // "Summer Beach Trip"
  query: query,                     // "Photos from my beach vacation..."
  requestId: albumRequest.id,       // 42 (database record ID)
  timestamp: new Date().toISOString(), // "2025-01-15T14:22:00.000Z"
}

// If user uploaded an image for search, include it
if (image) {
  n8nPayload.image = image  // base64 encoded image
}
\`\`\`

---

\`\`\`typescript
// 6. TRIGGER N8N WEBHOOK (Line 77)
const webhookResult = await triggerWebhook(
  process.env.N8N_WEBHOOK_FIND_PHOTOS,  // Your n8n webhook URL
  n8nPayload
)
\`\`\`

**Complete Webhook Payload Sent to n8n:**
\`\`\`json
{
  "user": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "email": "user@example.com"
  },
  "albumTitle": "Summer Beach Trip",
  "query": "Photos from my beach vacation with palm trees and sunset",
  "requestId": 42,
  "timestamp": "2025-01-15T14:22:00.000Z"
}
\`\`\`

---

\`\`\`typescript
// 7. RETURN RESPONSE TO FRONTEND (Lines 79-84)
return NextResponse.json({
  success: true,
  requestId: albumRequest.id,       // 42
  webhookTriggered: webhookResult.success,  // true/false
  searchType: query ? "text" : "image",     // "text"
})
\`\`\`

**Frontend Receives:**
\`\`\`json
{
  "success": true,
  "requestId": 42,
  "webhookTriggered": true,
  "searchType": "text"
}
\`\`\`

---

### 🤖 What Your n8n Workflow Should Do (Step 1)

**Webhook URL:** `N8N_WEBHOOK_FIND_PHOTOS`

**Workflow Steps:**

#### 1. **Receive Webhook Trigger**
\`\`\`
Webhook Node: "Album Create Request Received"
  - Method: POST
  - Receives payload with user, albumTitle, query, requestId
\`\`\`

#### 2. **Perform Semantic Search**
\`\`\`
Code/Function Node: "Search Photos by Query"

Input:
  - user.id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  - query: "Photos from my beach vacation with palm trees and sunset"

Process:
  1. Query your photos table where user_id = user.id
  2. Use vector similarity search on 'embedding' column
  3. Match against the query description
  4. Rank by relevance score
  5. Return top 20-50 matching photos

Output:
  [
    {
      "id": 123,
      "file_url": "https://storage.../photo1.jpg",
      "name": "Beach sunset.jpg",
      "caption": "Beautiful sunset at the beach",
      "relevance_score": 0.92
    },
    {
      "id": 456,
      "file_url": "https://storage.../photo2.jpg",
      "name": "Palm trees.jpg",
      "caption": "Palm trees on the shore",
      "relevance_score": 0.87
    },
    ...
  ]
\`\`\`

**💡 Options for Semantic Search:**

**Option A: Using Vector Embeddings (Recommended)**
\`\`\`sql
-- If you have embeddings stored
SELECT
  id,
  file_url,
  name,
  caption,
  1 - (embedding <=> query_embedding) AS relevance_score
FROM photos
WHERE user_id = $1
ORDER BY embedding <=> query_embedding
LIMIT 50;
\`\`\`

**Option B: Using AI/LLM for Search**
- Send query to OpenAI/Claude
- Get embeddings or have AI analyze photos
- Return matching results

**Option C: Simple Keyword Matching (Basic)**
\`\`\`sql
-- Simple text search on caption and name
SELECT id, file_url, name, caption
FROM photos
WHERE user_id = $1
  AND (
    name ILIKE '%beach%'
    OR caption ILIKE '%beach%'
    OR name ILIKE '%sunset%'
  )
LIMIT 50;
\`\`\`

#### 3. **Store Results for Frontend to Fetch**

You have several options:

**Option A: Update the album record**
\`\`\`sql
UPDATE albums
SET
  photos = ARRAY['https://storage.../photo1.jpg', 'https://storage.../photo2.jpg'],
  processing_status = 'completed'
WHERE id = $requestId;
\`\`\`

**Option B: Create a separate results table**
\`\`\`sql
CREATE TABLE album_search_results (
  request_id bigint PRIMARY KEY REFERENCES albums(id),
  results jsonb,  -- Store the array of matching photos
  created_at timestamp DEFAULT now()
);

INSERT INTO album_search_results (request_id, results)
VALUES ($requestId, $resultsJSON);
\`\`\`

**Option C: Return results via webhook callback**
- Trigger a callback to your app with results
- Frontend polls for results
- Use websockets for real-time updates

#### 4. **Update Album Status**
\`\`\`sql
UPDATE albums
SET processing_status = 'completed'
WHERE id = $requestId;
\`\`\`

#### 5. **(Optional) Send Notification**
\`\`\`
Email/Notification Node: "Notify User"
  - Subject: "Your album photos are ready!"
  - Body: "We found 24 photos matching your description"
\`\`\`

---

## 🔍 STEP 2: Review AI Suggestions

### Current Implementation (Frontend Only)

**File:** `app/create-album/page.tsx:212-303`

**Current Behavior:**
- ❌ Shows **MOCK DATA** (hardcoded photos)
- ❌ Does NOT fetch real results from n8n
- ✅ Allows user to select/deselect photos
- ✅ Shows count of selected photos

**Mock Data (Lines 18-28):**
\`\`\`javascript
const suggestedPhotos = [
  { id: 1, url: "/beach-sunset-golden-hour.jpg", selected: true },
  { id: 2, url: "/family-beach-playing.jpg", selected: true },
  // ... hardcoded mock photos
]
\`\`\`

---

### 🚧 What YOU Need to Implement

**You need to:**

1. **Fetch Real Results from n8n/Database**

Replace the mock data with actual API call:

\`\`\`typescript
// In create-album/page.tsx, after Step 1 completes:

const [suggestedPhotos, setSuggestedPhotos] = useState([])
const [requestId, setRequestId] = useState(null)

// After Step 1 webhook succeeds:
const data = await response.json()
setRequestId(data.requestId)  // Store the requestId

// Fetch results (poll or use callback)
const fetchResults = async () => {
  const resultsResponse = await fetch(`/api/albums/${requestId}/results`)
  const { photos } = await resultsResponse.json()

  setSuggestedPhotos(photos.map(p => ({
    id: p.id,
    url: p.file_url,
    name: p.name,
    caption: p.caption,
    selected: true  // Auto-select all initially
  })))
}

// Poll every 2 seconds until results are ready
useEffect(() => {
  if (requestId && currentStep === 2) {
    const interval = setInterval(fetchResults, 2000)
    return () => clearInterval(interval)
  }
}, [requestId, currentStep])
\`\`\`

2. **Create API Endpoint to Fetch Results**

Create: `app/api/albums/[requestId]/results/route.ts`

\`\`\`typescript
export async function GET(
  request: Request,
  { params }: { params: { requestId: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Fetch album to get results
  const { data: album } = await supabase
    .from("albums")
    .select("photos, processing_status")
    .eq("id", params.requestId)
    .eq("user_id", user.id)
    .single()

  if (album.processing_status !== "completed") {
    return NextResponse.json({ status: "pending", photos: [] })
  }

  // Fetch photo details
  const { data: photos } = await supabase
    .from("photos")
    .select("id, file_url, name, caption")
    .in("file_url", album.photos || [])

  return NextResponse.json({ status: "completed", photos })
}
\`\`\`

**OR**

3. **Use Real-time Updates (Better UX)**

Use Supabase Realtime to subscribe to album changes:

\`\`\`typescript
useEffect(() => {
  if (!requestId) return

  const channel = supabase
    .channel(`album:${requestId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'albums',
        filter: `id=eq.${requestId}`
      },
      (payload) => {
        if (payload.new.processing_status === 'completed') {
          // Fetch and display photos
          fetchResults()
        }
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}, [requestId])
\`\`\`

---

## 🔍 STEP 3: "Create Album" Button Click

### Frontend Action (app/create-album/page.tsx:75-78)

**Current Implementation Issue:**
\`\`\`typescript
} else {
  // Create album
  window.location.href = "/dashboard"  // ❌ Just redirects, doesn't save!
}
\`\`\`

**❌ PROBLEM:** Step 3 currently does NOT call any API to save the album!

---

### 🚧 What YOU Need to Implement

**You need to call the `album-finalized` endpoint:**

\`\`\`typescript
// In create-album/page.tsx, replace Step 3 logic:

} else if (currentStep === 3) {
  // Finalize album
  setIsProcessing(true)
  try {
    const response = await fetch("/api/webhooks/album-finalized", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: albumTitle,
        description: albumDescription,
        selectedPhotos: suggestedPhotos
          .filter(p => selectedPhotos.includes(p.id))
          .map(p => ({
            url: p.url,
            name: p.name,
            caption: p.caption
          })),
        coverImageUrl: suggestedPhotos.find(p => selectedPhotos.includes(p.id))?.url
      }),
    })

    if (!response.ok) {
      throw new Error("Failed to create album")
    }

    const data = await response.json()
    console.log("[v0] Album created:", data)

    // Redirect to dashboard
    window.location.href = "/dashboard"
  } catch (error) {
    console.error("[v0] Album creation error:", error)
    alert("Failed to create album. Please try again.")
    setIsProcessing(false)
  }
}
\`\`\`

---

### Backend Processing (app/api/webhooks/album-finalized/route.ts)

**What Happens:**

#### 1. **Authentication** (Lines 9-17)
\`\`\`typescript
const { data: { user } } = await supabase.auth.getUser()
\`\`\`
✅ Verifies user is logged in

#### 2. **Extract Request Data** (Lines 19-20)
\`\`\`typescript
const { title, description, selectedPhotos, coverImageUrl } = body
\`\`\`

**Expected Input:**
\`\`\`json
{
  "title": "Summer Beach Trip",
  "description": "Photos from my beach vacation...",
  "selectedPhotos": [
    {
      "url": "https://storage.../photo1.jpg",
      "name": "Beach sunset.jpg",
      "caption": "Beautiful sunset"
    },
    {
      "url": "https://storage.../photo2.jpg",
      "name": "Palm trees.jpg",
      "caption": null
    }
  ],
  "coverImageUrl": "https://storage.../photo1.jpg"
}
\`\`\`

#### 3. **Create Final Album Record** (Lines 22-35)
\`\`\`typescript
const { data: album } = await supabase
  .from("albums")
  .insert({
    user_id: user.id,
    album_title: title,
    description,
    cover_image_url: coverImageUrl,
    photo_count: selectedPhotos.length,
    status: "active",                    // Album is now active
    processing_status: "completed",      // Processing complete
  })
  .select()
  .single()
\`\`\`

**Database Record:**
\`\`\`json
{
  "id": 43,
  "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "album_title": "Summer Beach Trip",
  "description": "Photos from my beach vacation...",
  "cover_image_url": "https://storage.../photo1.jpg",
  "photo_count": 12,
  "status": "active",
  "processing_status": "completed",
  "created_at": "2025-01-15T14:30:00.000Z"
}
\`\`\`

#### 4. **Create Photo Records** (Lines 42-52)
\`\`\`typescript
const photoRecords = selectedPhotos.map((photo, index) => ({
  album_id: album.id,              // 43 (links to album)
  user_id: user.id,
  name: photo.name || `Photo ${index + 1}`,
  file_url: photo.url,
  caption: photo.caption || null,
  position: index,                 // Order in album: 0, 1, 2...
}))

await supabase.from("photos").insert(photoRecords)
\`\`\`

**Database Records (in photos table):**
\`\`\`json
[
  {
    "id": 789,
    "album_id": 43,
    "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "name": "Beach sunset.jpg",
    "file_url": "https://storage.../photo1.jpg",
    "caption": "Beautiful sunset",
    "position": 0,
    "created_at": "2025-01-15T14:30:00.000Z"
  },
  {
    "id": 790,
    "album_id": 43,
    "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "name": "Palm trees.jpg",
    "file_url": "https://storage.../photo2.jpg",
    "caption": null,
    "position": 1,
    "created_at": "2025-01-15T14:30:00.000Z"
  }
]
\`\`\`

#### 5. **Trigger n8n Webhook** (Lines 58-64)
\`\`\`typescript
const webhookResult = await triggerWebhook(
  process.env.N8N_WEBHOOK_ALBUM_FINALIZED,
  {
    userId: user.id,
    albumId: album.id,
    title,
    photoCount: selectedPhotos.length,
    timestamp: new Date().toISOString(),
  }
)
\`\`\`

**Webhook Payload to n8n:**
\`\`\`json
{
  "userId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "albumId": 43,
  "title": "Summer Beach Trip",
  "photoCount": 12,
  "timestamp": "2025-01-15T14:30:00.000Z"
}
\`\`\`

#### 6. **Return Response** (Lines 66-70)
\`\`\`typescript
return NextResponse.json({
  success: true,
  albumId: album.id,
  webhookTriggered: webhookResult.success,
})
\`\`\`

---

### 🤖 What Your n8n Workflow Should Do (Step 3)

**Webhook URL:** `N8N_WEBHOOK_ALBUM_FINALIZED`

**Workflow Steps:**

#### 1. **Receive Webhook**
\`\`\`
Webhook Node: "Album Finalized"
  - Receives: userId, albumId, title, photoCount
\`\`\`

#### 2. **Post-Processing (Optional)**

**Option A: Generate Thumbnails**
\`\`\`
Code Node: "Generate Thumbnails"
  - Fetch all photos for album
  - Create thumbnail versions
  - Update thumbnail_url in photos table
\`\`\`

**Option B: Extract Metadata**
\`\`\`
Code Node: "Extract Photo Metadata"
  - Analyze photos with AI
  - Extract objects, faces, locations
  - Update metadata in photos table
\`\`\`

**Option C: Create Sharing Link**
\`\`\`
Code Node: "Generate Share Link"
  - Create public share token
  - Store in database
  - Return share URL
\`\`\`

#### 3. **Send Notification**
\`\`\`
Email Node: "Send Album Created Email"
  - To: user email
  - Subject: "Your album 'Summer Beach Trip' is ready!"
  - Include: Link to view album, photo count
\`\`\`

#### 4. **Update Analytics**
\`\`\`
Database Node: "Track Album Creation"
  - Log event: album_created
  - Track: user_id, album_id, photo_count
\`\`\`

---

## 📊 Complete Data Flow Summary

### Step 1: Find Photos

\`\`\`
User Input:
  - albumTitle: "Summer Beach Trip"
  - query: "Photos from my beach vacation with palm trees and sunset"

Backend Creates:
  albums table record:
    - id: 42
    - user_id: user UUID
    - album_title: "Summer Beach Trip"
    - description: "Photos from my beach vacation..."
    - status: "pending"
    - processing_status: "pending"

n8n Receives:
  {
    user: { id, email },
    albumTitle: "Summer Beach Trip",
    query: "Photos from...",
    requestId: 42
  }

n8n Should:
  1. Search photos table using embeddings/AI
  2. Find 20-50 matching photos
  3. Store results in albums.photos array OR separate table
  4. Update processing_status to "completed"
\`\`\`

### Step 2: Review Results

\`\`\`
Frontend Should:
  - Fetch results from database (albums.photos)
  - OR poll API endpoint for results
  - Display photos in grid
  - Allow selection/deselection

Current Issue:
  ❌ Uses mock data
  ✅ Selection logic works

You Need To:
  ✅ Fetch real results from Step 1
  ✅ Display actual photos from user's collection
\`\`\`

### Step 3: Create Album

\`\`\`
User Action:
  - Reviews and selects 12 photos
  - Clicks "Create Album"

Frontend Should Send:
  {
    title: "Summer Beach Trip",
    description: "Photos from...",
    selectedPhotos: [
      { url: "...", name: "...", caption: "..." },
      ...
    ],
    coverImageUrl: "..."
  }

Backend Creates:
  albums table record:
    - id: 43 (new record, or update requestId 42)
    - status: "active"
    - processing_status: "completed"
    - photo_count: 12

  photos table records:
    - 12 records with album_id: 43
    - Each with position for ordering

n8n Receives:
  {
    userId: user UUID,
    albumId: 43,
    title: "Summer Beach Trip",
    photoCount: 12
  }

n8n Should:
  1. (Optional) Generate thumbnails
  2. (Optional) Extract metadata
  3. Send success notification
\`\`\`

---

## 🛠️ Implementation Checklist

### Step 1 - Already Working ✅
- [x] Frontend sends query and albumTitle
- [x] Backend creates album record
- [x] Backend sends webhook to n8n
- [x] n8n receives correct payload

### Step 1 - Your n8n TODO ⏳
- [ ] Implement semantic search logic
- [ ] Store results in database
- [ ] Update processing_status to "completed"

### Step 2 - Need to Implement 🚧
- [ ] Create API endpoint to fetch results
- [ ] Replace mock data with real API call
- [ ] Add loading state while fetching
- [ ] Handle empty results gracefully

### Step 3 - Need to Implement 🚧
- [ ] Replace redirect with API call to album-finalized
- [ ] Send selected photos to backend
- [ ] Handle success/error states
- [ ] Show success message before redirect

### Step 3 - Your n8n TODO ⏳
- [ ] Receive album-finalized webhook
- [ ] (Optional) Generate thumbnails
- [ ] (Optional) Send email notification
- [ ] (Optional) Update analytics

---

## 🎯 Next Steps

1. **Implement Step 1 n8n Workflow**
   - Start with basic keyword search
   - Later upgrade to vector embeddings

2. **Fix Step 2 Frontend**
   - Fetch real results from database
   - Remove mock data

3. **Fix Step 3 Frontend**
   - Call album-finalized API
   - Handle response properly

4. **Implement Step 3 n8n Workflow**
   - Receive finalized webhook
   - Add post-processing

---

## 💡 Quick Wins

**Minimum Viable Implementation:**

1. **Step 1 n8n:** Simple SQL query on photos.name and photos.caption
2. **Step 2 Frontend:** Fetch from albums.photos array
3. **Step 3 Frontend:** Call existing API endpoint
4. **Step 3 n8n:** Just log the event

**Later Enhancements:**

- Vector embeddings for semantic search
- AI-powered photo analysis
- Thumbnail generation
- Email notifications
- Share links
- Smart album suggestions

---

Need help implementing any specific part? Let me know!
