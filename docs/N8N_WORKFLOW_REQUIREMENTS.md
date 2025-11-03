# n8n Workflow Requirements - Create Album Feature

## 🎯 Quick Reference

You need to build **2 n8n workflows** for the Create Album feature:

1. **Workflow 1:** `N8N_WEBHOOK_FIND_PHOTOS` - Semantic photo search
2. **Workflow 2:** `N8N_WEBHOOK_ALBUM_FINALIZED` - Post-processing after album creation

---

## 📌 Workflow 1: Find Photos (Semantic Search)

### Trigger Configuration

**Webhook URL:** Set in `.env.local` as `N8N_WEBHOOK_FIND_PHOTOS`

**Method:** POST

**Authentication:** None (handle security in n8n if needed)

---

### Input Payload Structure

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

**Field Descriptions:**
- `user.id` - UUID of the logged-in user (use this to filter photos)
- `user.email` - User's email (for notifications)
- `albumTitle` - Album title entered by user (can be null/empty)
- `query` - Natural language search query describing desired photos
- `requestId` - ID of the album record in database (use to update status)
- `timestamp` - When request was created

---

### Workflow Logic

#### **Node 1: Webhook Trigger**
\`\`\`
Name: "Album Create Request"
Type: Webhook
Method: POST
Path: /webhook/find-photos
\`\`\`

---

#### **Node 2: Semantic Photo Search**

You have 3 implementation options:

##### **Option A: Vector Embeddings (Recommended for Production)**

\`\`\`
Name: "Vector Search Photos"
Type: Supabase Query / Function

SQL Query:
SELECT
  id,
  name,
  file_url,
  caption,
  type,
  size,
  1 - (embedding <=> $query_embedding) AS similarity_score
FROM photos
WHERE
  user_id = $userId
  AND embedding IS NOT NULL
ORDER BY embedding <=> $query_embedding
LIMIT 50;

Parameters:
  - $userId: {{ $json.user.id }}
  - $query_embedding: Generate using OpenAI/Anthropic embeddings

Steps:
1. Generate embedding for query text
2. Compare with photo embeddings using cosine similarity
3. Return top 50 matches ordered by relevance
\`\`\`

---

##### **Option B: AI-Powered Search (Good for MVP)**

\`\`\`
Name: "AI Search Photos"
Type: Code Node (JavaScript/Python)

Process:
1. Fetch all user's photos from database
2. Send query + photo metadata to OpenAI/Claude
3. Ask AI to rank photos by relevance
4. Return top matches

Example with OpenAI:
const photos = await fetchUserPhotos(userId)
const prompt = `
User query: "${query}"

Photos available:
${photos.map(p => `ID: ${p.id}, Name: ${p.name}, Caption: ${p.caption}`).join('\n')}

Return the IDs of photos that best match the query, ranked by relevance.
Format: [123, 456, 789, ...]
`

const response = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [{ role: "user", content: prompt }]
})

return matchedPhotos
\`\`\`

---

##### **Option C: Simple Keyword Matching (Quick MVP)**

\`\`\`
Name: "Keyword Search Photos"
Type: Supabase Query

SQL Query:
SELECT
  id,
  name,
  file_url,
  caption,
  type,
  size
FROM photos
WHERE
  user_id = $userId
  AND (
    name ILIKE '%' || $keyword1 || '%'
    OR caption ILIKE '%' || $keyword1 || '%'
    OR name ILIKE '%' || $keyword2 || '%'
    OR caption ILIKE '%' || $keyword2 || '%'
  )
LIMIT 50;

Parameters:
  - $userId: {{ $json.user.id }}
  - $keyword1, $keyword2: Extract from query (beach, sunset, palm, vacation)
\`\`\`

---

#### **Node 3: Format Results**

\`\`\`
Name: "Format Photo Results"
Type: Code Node

Input: Array of photos from search
Output: Clean array with required fields

Code:
return $input.all().map(photo => ({
  id: photo.id,
  file_url: photo.file_url,
  name: photo.name,
  caption: photo.caption || '',
  type: photo.type,
  size: photo.size
}))
\`\`\`

---

#### **Node 4: Store Results in Database**

##### **Option A: Update albums.photos array**

\`\`\`
Name: "Update Album with Results"
Type: Supabase Update

Table: albums
Filter: id = {{ $json.requestId }}

Update:
{
  "photos": {{ JSON.stringify($node["Format Photo Results"].json.map(p => p.file_url)) }},
  "processing_status": "completed"
}
\`\`\`

##### **Option B: Create separate results table**

\`\`\`
Name: "Store Search Results"
Type: Supabase Insert

Table: album_search_results

Insert:
{
  "request_id": {{ $json.requestId }},
  "results": {{ JSON.stringify($node["Format Photo Results"].json) }},
  "created_at": {{ new Date().toISOString() }}
}

Then update album status:
UPDATE albums
SET processing_status = 'completed'
WHERE id = {{ $json.requestId }};
\`\`\`

---

#### **Node 5: (Optional) Send Notification**

\`\`\`
Name: "Notify User"
Type: Email / Webhook

To: {{ $json.user.email }}
Subject: "Your album photos are ready!"
Body: "We found {{ $node["Format Photo Results"].json.length }} photos matching '{{ $json.query }}'"
\`\`\`

---

### Expected Output

The workflow should:
1. ✅ Search user's photos based on query
2. ✅ Return 20-50 matching photos
3. ✅ Store results in database (albums.photos OR separate table)
4. ✅ Update album.processing_status to "completed"
5. ✅ (Optional) Send notification to user

---

### Testing the Workflow

**Test Payload:**
\`\`\`bash
curl -X POST https://your-n8n.com/webhook/find-photos \
  -H "Content-Type: application/json" \
  -d '{
    "user": {
      "id": "YOUR_TEST_USER_ID",
      "email": "test@example.com"
    },
    "albumTitle": "Test Album",
    "query": "beach sunset photos",
    "requestId": 1,
    "timestamp": "2025-01-15T14:22:00.000Z"
  }'
\`\`\`

**Expected Database Changes:**
\`\`\`sql
-- Check album was updated
SELECT id, processing_status, photos
FROM albums
WHERE id = 1;

-- Should return:
-- processing_status = 'completed'
-- photos = ['url1', 'url2', ...]
\`\`\`

---

## 📌 Workflow 2: Album Finalized (Post-Processing)

### Trigger Configuration

**Webhook URL:** Set in `.env.local` as `N8N_WEBHOOK_ALBUM_FINALIZED`

**Method:** POST

---

### Input Payload Structure

\`\`\`json
{
  "userId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "albumId": 43,
  "title": "Summer Beach Trip",
  "photoCount": 12,
  "timestamp": "2025-01-15T14:30:00.000Z"
}
\`\`\`

**Field Descriptions:**
- `userId` - UUID of user who created album
- `albumId` - ID of the newly created album
- `title` - Final album title
- `photoCount` - Number of photos in album
- `timestamp` - When album was finalized

---

### Workflow Logic

#### **Node 1: Webhook Trigger**
\`\`\`
Name: "Album Finalized"
Type: Webhook
Method: POST
Path: /webhook/album-finalized
\`\`\`

---

#### **Node 2: Fetch Album Photos**

\`\`\`
Name: "Get Album Photos"
Type: Supabase Query

SQL Query:
SELECT
  id,
  file_url,
  name,
  type,
  size
FROM photos
WHERE album_id = $albumId
ORDER BY position ASC;

Parameters:
  - $albumId: {{ $json.albumId }}
\`\`\`

---

#### **Node 3: Generate Thumbnails (Optional)**

\`\`\`
Name: "Generate Thumbnails"
Type: Code Node / HTTP Request

For each photo:
1. Fetch original image from file_url
2. Resize to thumbnail (e.g., 300x300)
3. Upload to storage
4. Update thumbnail_url in database

Example using Sharp (Node.js):
const sharp = require('sharp')

for (const photo of photos) {
  const imageBuffer = await fetch(photo.file_url).then(r => r.arrayBuffer())

  const thumbnail = await sharp(imageBuffer)
    .resize(300, 300, { fit: 'cover' })
    .toBuffer()

  // Upload thumbnail to Supabase Storage
  const { data } = await supabase.storage
    .from('photos')
    .upload(`thumbnails/${photo.id}.jpg`, thumbnail)

  const thumbnailUrl = supabase.storage
    .from('photos')
    .getPublicUrl(`thumbnails/${photo.id}.jpg`).publicUrl

  // Update database
  await supabase
    .from('photos')
    .update({ thumbnail_url: thumbnailUrl })
    .eq('id', photo.id)
}
\`\`\`

---

#### **Node 4: Extract Metadata with AI (Optional)**

\`\`\`
Name: "Analyze Photos with AI"
Type: HTTP Request / Code

For each photo:
1. Send to OpenAI Vision API / Claude Vision
2. Extract:
   - Objects detected (beach, sunset, people, etc.)
   - Colors (warm, cool, vibrant)
   - Scene type (outdoor, landscape, portrait)
   - Suggested tags

Example:
const response = await openai.chat.completions.create({
  model: "gpt-4-vision-preview",
  messages: [{
    role: "user",
    content: [
      {
        type: "image_url",
        image_url: { url: photo.file_url }
      },
      {
        type: "text",
        text: "Analyze this photo and return: objects, colors, scene_type, tags"
      }
    ]
  }]
})

// Store in metadata column
await supabase
  .from('photos')
  .update({
    metadata: {
      ...photo.metadata,
      ai_analysis: response.choices[0].message.content
    }
  })
  .eq('id', photo.id)
\`\`\`

---

#### **Node 5: Send Success Notification (Optional)**

\`\`\`
Name: "Send Email Notification"
Type: Email / SendGrid / Resend

To: {{ $json.userId }} (lookup email from profiles table)
Subject: "Your album '{{ $json.title }}' is ready! 🎉"
Body:
  Hi there!

  Your album "{{ $json.title }}" with {{ $json.photoCount }} photos
  is now ready to view.

  [View Album Button] → /albums/{{ $json.albumId }}

  Happy organizing!
  - FindMyPhoto Team
\`\`\`

---

#### **Node 6: Update Analytics (Optional)**

\`\`\`
Name: "Track Album Creation"
Type: Supabase Insert / Analytics Service

Table: analytics_events

Insert:
{
  "event_type": "album_created",
  "user_id": {{ $json.userId }},
  "album_id": {{ $json.albumId }},
  "photo_count": {{ $json.photoCount }},
  "timestamp": {{ $json.timestamp }}
}
\`\`\`

---

### Expected Output

The workflow should:
1. ✅ Receive album finalized webhook
2. ✅ (Optional) Generate thumbnails for all photos
3. ✅ (Optional) Extract AI metadata from photos
4. ✅ (Optional) Send success email to user
5. ✅ (Optional) Log analytics event

---

### Testing the Workflow

**Test Payload:**
\`\`\`bash
curl -X POST https://your-n8n.com/webhook/album-finalized \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "YOUR_TEST_USER_ID",
    "albumId": 1,
    "title": "Test Album",
    "photoCount": 5,
    "timestamp": "2025-01-15T14:30:00.000Z"
  }'
\`\`\`

**Expected Results:**
- ✅ Thumbnails created for all photos in album
- ✅ Metadata updated with AI analysis
- ✅ Email sent to user
- ✅ Analytics event logged

---

## 🎯 Minimum Viable Implementation

### Start Simple, Enhance Later

**Phase 1: Basic Implementation (1-2 hours)**

**Workflow 1 (Find Photos):**
1. ✅ Webhook trigger
2. ✅ Simple keyword search on photos.name and photos.caption
3. ✅ Update albums.photos array with results
4. ✅ Set processing_status = 'completed'

**Workflow 2 (Album Finalized):**
1. ✅ Webhook trigger
2. ✅ Log event to console/database
3. ✅ (Optional) Send simple email

---

**Phase 2: Enhanced Search (Add Later)**
- Vector embeddings for semantic search
- AI-powered photo ranking
- Relevance scoring

---

**Phase 3: Advanced Features (Future)**
- Thumbnail generation
- AI metadata extraction
- Smart suggestions
- Duplicate detection
- Face recognition

---

## 🔧 Environment Variables

Add these to your n8n environment or workflow settings:

\`\`\`bash
# Supabase Connection
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

# AI Services (Optional)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Email Service (Optional)
SENDGRID_API_KEY=SG.xxx
RESEND_API_KEY=re_xxx
\`\`\`

---

## 📊 Database Queries Reference

### Fetch User's Photos
\`\`\`sql
SELECT id, name, file_url, caption, type, size, embedding
FROM photos
WHERE user_id = $1
ORDER BY created_at DESC;
\`\`\`

### Update Album with Results
\`\`\`sql
UPDATE albums
SET
  photos = $1,  -- Array of file URLs
  processing_status = 'completed'
WHERE id = $2;
\`\`\`

### Fetch Album Photos
\`\`\`sql
SELECT id, file_url, name, caption
FROM photos
WHERE album_id = $1
ORDER BY position ASC;
\`\`\`

### Update Photo Thumbnail
\`\`\`sql
UPDATE photos
SET thumbnail_url = $1
WHERE id = $2;
\`\`\`

---

## ✅ Testing Checklist

### Workflow 1: Find Photos
- [ ] Webhook receives correct payload
- [ ] User photos are queried successfully
- [ ] Search returns relevant results
- [ ] Results stored in database
- [ ] processing_status updated to 'completed'
- [ ] Workflow completes without errors

### Workflow 2: Album Finalized
- [ ] Webhook receives correct payload
- [ ] Album photos fetched successfully
- [ ] (Optional) Thumbnails generated
- [ ] (Optional) AI analysis completed
- [ ] (Optional) Email sent successfully
- [ ] Workflow completes without errors

---

## 🐛 Troubleshooting

### Workflow 1 Issues

**Problem: No photos returned**
- Check if user has photos in database
- Verify user_id matches
- Check search query keywords

**Problem: processing_status not updated**
- Check Supabase credentials
- Verify requestId is correct
- Check RLS policies allow updates

---

### Workflow 2 Issues

**Problem: Photos not found**
- Check if album_id exists
- Verify photos.album_id is set correctly
- Check RLS policies

**Problem: Thumbnails fail to generate**
- Check image URLs are accessible
- Verify storage bucket permissions
- Check Sharp library is installed

---

## 📞 Need Help?

Common issues:
1. **Vector search not working** → Start with keyword search first
2. **RLS blocking queries** → Use service role key in n8n
3. **Webhook not receiving data** → Check URL in .env.local
4. **AI analysis too slow** → Process async or in batches

---

## 🚀 Quick Start Commands

### Test Workflow 1
\`\`\`bash
# Replace with your actual values
curl -X POST https://your-n8n.com/webhook/find-photos \
  -H "Content-Type: application/json" \
  -d '{
    "user": {"id": "YOUR_USER_ID", "email": "test@example.com"},
    "query": "beach photos",
    "requestId": 1
  }'
\`\`\`

### Test Workflow 2
\`\`\`bash
curl -X POST https://your-n8n.com/webhook/album-finalized \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "YOUR_USER_ID",
    "albumId": 1,
    "title": "Test Album",
    "photoCount": 5
  }'
\`\`\`

---

**Ready to build? Start with Phase 1 (Basic Implementation) and enhance from there!**
