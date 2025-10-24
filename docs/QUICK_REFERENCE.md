# Create Album - Quick Reference Guide

## 🎯 3-Step Workflow Overview

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  STEP 1: FIND PHOTOS (Semantic Search)                       ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

User Input:
  📝 Album Title: "Summer Beach Trip" (optional)
  📝 Description: "Photos from my beach vacation with palm trees and sunset"
  👆 Clicks "Find Photos"

Frontend → POST /api/webhooks/album-create-request
        ↓
Backend:
  1. Creates album record (status: "pending")
  2. Sends webhook to n8n

Database (albums table):
  {
    "id": 42,
    "user_id": "uuid",
    "album_title": "Summer Beach Trip",
    "description": "Photos from my beach vacation...",
    "status": "pending",
    "processing_status": "pending"
  }

n8n Webhook (N8N_WEBHOOK_FIND_PHOTOS):
  {
    "user": { "id": "uuid", "email": "user@example.com" },
    "albumTitle": "Summer Beach Trip",
    "query": "Photos from my beach vacation...",
    "requestId": 42
  }

🤖 n8n Should:
  ✅ Search photos table by query
  ✅ Find 20-50 matching photos
  ✅ Store results in albums.photos array
  ✅ Update processing_status to "completed"

─────────────────────────────────────────────────────────────────

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  STEP 2: REVIEW SUGGESTIONS (Photo Selection)                ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

Frontend:
  ❌ Currently shows MOCK DATA
  ✅ Need to fetch real results from Step 1

🚧 YOUR TODO:
  1. Fetch results from database (albums.photos)
  2. Display photos in grid
  3. Allow user to select/deselect

User Action:
  👆 Selects 12 out of 24 suggested photos
  👆 Clicks "Continue"

─────────────────────────────────────────────────────────────────

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  STEP 3: FINALIZE ALBUM (Create Final Album)                 ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

User Input:
  📝 Final album title (can edit)
  👆 Clicks "Create Album"

Frontend → POST /api/webhooks/album-finalized
        ↓
Backend:
  1. Creates final album record (status: "active")
  2. Creates 12 photo records (album_id: 43)
  3. Sends webhook to n8n

Database (albums table):
  {
    "id": 43,
    "album_title": "Summer Beach Trip",
    "status": "active",
    "processing_status": "completed",
    "photo_count": 12
  }

Database (photos table) - 12 records:
  {
    "id": 789,
    "album_id": 43,
    "user_id": "uuid",
    "name": "Beach sunset.jpg",
    "file_url": "https://storage.../photo1.jpg",
    "position": 0
  }

n8n Webhook (N8N_WEBHOOK_ALBUM_FINALIZED):
  {
    "userId": "uuid",
    "albumId": 43,
    "title": "Summer Beach Trip",
    "photoCount": 12
  }

🤖 n8n Should:
  ✅ (Optional) Generate thumbnails
  ✅ (Optional) Extract AI metadata
  ✅ (Optional) Send email notification
```

---

## 🔑 Key Database Tables

### albums
```sql
id                  bigint PRIMARY KEY
user_id            uuid (references auth.users)
album_title        text
description        text (user's original query)
photos             text[] (array of photo URLs)
cover_image_url    text
photo_count        integer
status             text (pending/active/archived)
processing_status  text (pending/processing/completed/failed)
created_at         timestamp
updated_at         timestamp
```

### photos
```sql
id              bigserial PRIMARY KEY
user_id         uuid (references auth.users)
album_id        bigint (references albums.id)
name            text
file_url        text
type            text
size            numeric
caption         text
position        integer (order in album)
embedding       vector (for semantic search)
metadata        jsonb
thumbnail_url   text
created_at      timestamp
updated_at      timestamp
```

---

## 📡 n8n Webhooks

### Webhook 1: Find Photos
```
URL: N8N_WEBHOOK_FIND_PHOTOS
Trigger: Step 1 "Find Photos" button

Receives:
{
  "user": { "id": "uuid", "email": "email" },
  "albumTitle": "Summer Beach Trip",
  "query": "beach vacation with palm trees",
  "requestId": 42,
  "timestamp": "2025-01-15T14:22:00.000Z"
}

Should Do:
1. Search photos table
2. Store results in albums.photos
3. Update processing_status = 'completed'
```

### Webhook 2: Album Finalized
```
URL: N8N_WEBHOOK_ALBUM_FINALIZED
Trigger: Step 3 "Create Album" button

Receives:
{
  "userId": "uuid",
  "albumId": 43,
  "title": "Summer Beach Trip",
  "photoCount": 12,
  "timestamp": "2025-01-15T14:30:00.000Z"
}

Should Do:
1. Generate thumbnails (optional)
2. Extract AI metadata (optional)
3. Send email notification (optional)
```

---

## 🐛 Current Issues

### ❌ Step 2: Not Fetching Real Data
**File:** `app/create-album/page.tsx` (line 18-28)
```javascript
const suggestedPhotos = [
  { id: 1, url: "/beach-sunset-golden-hour.jpg", selected: true },
  // ... hardcoded mock data
]
```

**Fix Needed:**
- Fetch from API endpoint
- Display real photos from Step 1

---

### ❌ Step 3: Not Calling API
**File:** `app/create-album/page.tsx` (line 76-78)
```javascript
} else {
  // Create album
  window.location.href = "/dashboard"  // Just redirects!
}
```

**Fix Needed:**
- Call `/api/webhooks/album-finalized`
- Send selected photos
- Handle response

---

## ✅ Implementation Checklist

### Phase 1: Minimum Viable Product
- [x] Step 1: Frontend sends data ✅
- [x] Step 1: Backend creates album ✅
- [x] Step 1: Webhook sent to n8n ✅
- [ ] Step 1: n8n searches photos ⏳
- [ ] Step 1: n8n stores results ⏳
- [ ] Step 2: Frontend fetches real data 🚧
- [ ] Step 3: Frontend calls API 🚧
- [ ] Step 3: Backend creates album ✅
- [ ] Step 3: Webhook sent to n8n ✅
- [ ] Step 3: n8n post-processing ⏳

### Phase 2: Enhanced Features
- [ ] Vector embeddings for semantic search
- [ ] AI-powered photo ranking
- [ ] Thumbnail generation
- [ ] Metadata extraction
- [ ] Email notifications
- [ ] Real-time updates (Supabase Realtime)

---

## 🚀 Quick Start: n8n Setup

### Workflow 1 (5 minutes)
```
1. Create webhook node → /webhook/find-photos
2. Add Supabase query node:
   SELECT id, name, file_url, caption
   FROM photos
   WHERE user_id = {{ $json.user.id }}
   LIMIT 50
3. Add Supabase update node:
   UPDATE albums
   SET photos = {{ $json.file_urls }},
       processing_status = 'completed'
   WHERE id = {{ $json.requestId }}
```

### Workflow 2 (2 minutes)
```
1. Create webhook node → /webhook/album-finalized
2. Add console log node (for testing)
3. (Optional) Add email node
```

---

## 📞 Environment Variables

```bash
# In .env.local
N8N_WEBHOOK_FIND_PHOTOS=https://your-n8n.com/webhook/find-photos
N8N_WEBHOOK_ALBUM_FINALIZED=https://your-n8n.com/webhook/album-finalized

# In n8n
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
OPENAI_API_KEY=sk-... (optional, for AI features)
```

---

## 🧪 Testing

### Test Step 1
```bash
curl -X POST http://localhost:3000/api/webhooks/album-create-request \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "query": "beach sunset photos",
    "albumTitle": "Test Album"
  }'
```

### Check Database
```sql
SELECT id, album_title, processing_status, photos
FROM albums
ORDER BY created_at DESC
LIMIT 1;
```

---

## 📚 Full Documentation

- **CREATE_ALBUM_BACKEND_FLOW.md** - Complete backend explanation
- **N8N_WORKFLOW_REQUIREMENTS.md** - Detailed n8n setup guide
- **MIGRATION_GUIDE.md** - Database schema setup
- **CODE_CLEANUP_SUMMARY.md** - Recent code changes

---

## 💡 Next Actions

1. **Setup n8n Workflow 1** (30 min)
   - Start with simple keyword search
   - Test with real data

2. **Fix Step 2 Frontend** (30 min)
   - Fetch results from database
   - Remove mock data

3. **Fix Step 3 Frontend** (20 min)
   - Call album-finalized API
   - Handle response

4. **Setup n8n Workflow 2** (15 min)
   - Basic logging
   - Optional: email notification

**Total Time: ~2 hours for MVP**

---

Need help? Check the detailed guides in the repo! 📖
