# Supabase Storage Chunked Upload System

## Overview

This implementation uses **Supabase Storage client-side direct upload** with chunking to bypass Vercel serverless function timeouts and handle large batches of photos (600+).

## Key Innovation

Instead of using Vercel Blob, we upload directly to **your existing Supabase Storage bucket** from the browser, using the same path pattern you were already using.

## How It Works

### Before (Timeout Issue):
\`\`\`
Browser → FormData → [4MB LIMIT] → Serverless Function → Supabase Storage
                           ❌ TIMEOUT (after ~100 photos)
\`\`\`

### After (No Timeout):
\`\`\`
Browser → [Direct Upload] → Supabase Storage ✅
         (Client-side SDK)    (No serverless function involved!)
\`\`\`

## Architecture

\`\`\`
Upload 600 photos (8MB each):

├─ Chunk 1 (15 photos)
│   ├─ Browser uploads directly to Supabase Storage (client-side)
│   │  Path: {userId}/1234567890-abc123.jpg
│   │  Using: supabase.storage.from('photos').upload()
│   │
│   └─ Save 15 URLs to database via /api/photos/save-storage (~1s)
│       Creates photo records + adds to processing queue
│
├─ Chunk 2 (15 photos)
│   ├─ Direct upload to Supabase Storage
│   └─ Save 15 URLs to database ✅
│
... (continues for all 40 chunks)

✅ Result: All 600 photos uploaded without timeout!
\`\`\`

## Implementation Details

### 1. Storage Path Pattern (Same as Before)

Your existing pattern is preserved:
\`\`\`typescript
const filePath = `${userId}/${timestamp}-${randomString}.${fileExt}`;
// Example: "abc-123-def-456/1234567890-xyz789.jpg"
\`\`\`

**Nothing changes** in your storage structure!

### 2. Client-Side Upload (New)

\`\`\`typescript
// Uploads directly from browser to Supabase Storage
const { data, error } = await supabase.storage
  .from('photos')
  .upload(filePath, file, {
    contentType: file.type,
    upsert: false,
  });

// Get public URL (same as before)
const { data: urlData } = supabase.storage
  .from('photos')
  .getPublicUrl(filePath);
\`\`\`

### 3. Database Save (Same API Pattern)

\`\`\`typescript
// Save URLs to database via API
POST /api/photos/save-storage
{
  "photos": [
    { "name": "photo1.jpg", "url": "https://...", "size": 8388608, "type": "image/jpeg" },
    { "name": "photo2.jpg", "url": "https://...", "size": 8388608, "type": "image/jpeg" },
    ...
  ]
}
\`\`\`

**This creates the same database records as before:**
- Photo record in `photos` table
- Entry in `photo_processing_queue` table
- Status: `uploaded` → `queued`

## Features

### ✅ Timeout Solution
- **600 photos × 8MB each = 4.8GB**: No problem!
- Each chunk: 15 photos uploaded client-side, then 1 fast API call
- No serverless function involved in file upload
- Each database save: ~1-2 seconds (well under 60s limit)

### ✅ Same Storage Pattern
- Uses your existing `photos` bucket
- Same path structure: `{userId}/{timestamp}-{random}.{ext}`
- Same public URLs
- Same permissions (RLS policies)
- **No migration needed** - new uploads work alongside existing photos

### ✅ Chunking & Retry
- 15 photos per chunk
- Exponential backoff retry (1s, 3s, 10s)
- Max 3 retries per chunk
- Smart error categorization (network, auth, quota, etc.)

### ✅ Session Management
- localStorage persistence (survives page refresh)
- Database backup (survives browser close)
- Resume capability
- Pause/Resume controls
- Per-chunk status tracking

### ✅ No Extra Services
- ❌ No Vercel Blob needed
- ❌ No additional costs
- ✅ Uses your existing Supabase subscription
- ✅ Same storage you're already paying for

## File Limits

| Limit Type | Value | Note |
|------------|-------|------|
| Per photo | 50MB | Same as your existing implementation |
| Per chunk | 15 photos | Optimal for timeout avoidance |
| Total batch | Unlimited | Chunking handles any size |
| Total size | Unlimited | Client-side upload, no limits |

## Performance

### Estimated Upload Times (600 photos × 8MB):

**Good Connection (50 Mbps):**
- Per photo: ~2-3s
- Per chunk (15 photos): ~30-45s
- **Total: ~20-30 minutes**

**Medium Connection (20 Mbps):**
- Per photo: ~4-5s
- Per chunk (15 photos): ~60-75s
- **Total: ~40-50 minutes**

**Slow Connection (5 Mbps):**
- Per photo: ~15-20s
- Per chunk (15 photos): ~225-300s
- **Total: ~2.5-3 hours**

### Why No Timeout?
- Upload happens in **browser** (not subject to Vercel timeout)
- Only database save goes through serverless function (~1s per chunk)
- Each API call is independent and fast

## Usage

### Automatic Activation

**For large batches (>50 photos):**
\`\`\`
1. User selects 600 photos
2. System detects large batch
3. ChunkedUploader UI activates
4. Progress shows: "Chunk 1/40... Chunk 2/40..."
5. All photos upload successfully! ✅
\`\`\`

**For small batches (≤50 photos):**
\`\`\`
1. User selects 20 photos
2. Simple chunked upload (hidden from user)
3. Completes quickly
\`\`\`

### Manual Controls

**Pause/Resume:**
- Click "Pause" during upload
- Close browser, reopen later
- Click "Resume" to continue

**Retry Failed:**
- If some chunks fail, click "Retry Failed (3)"
- Only failed chunks are retried

## Code Structure

### Key Files

**Chunked Upload Logic:**
- `lib/utils/supabase-chunked-upload.ts` - Core upload logic
- `lib/hooks/useUploadSession.ts` - Session state management
- `components/chunked-uploader.tsx` - UI component

**API Routes:**
- `app/api/photos/save-storage/route.ts` - Save storage URLs to database
- `app/api/upload/session/route.ts` - Session management

**Database:**
- `upload_sessions` table - Track progress across page reloads

### Upload Flow

\`\`\`typescript
// 1. Initialize session
const sessionId = initializeSession(files);

// 2. For each chunk...
for (const chunk of chunks) {
  // 3. Upload to Supabase Storage (client-side)
  const results = await uploadPhotosToSupabaseStorage(chunkFiles);

  // 4. Save URLs to database
  const dbResult = await saveChunkToDatabase(results);

  // 5. Update session
  updateChunkStatus(chunkIndex, { status: 'completed', ...results });
}

// 6. Complete
completeSession();
\`\`\`

## Testing Your Scenario

**Your specific case: 600 photos × 8MB**

1. Select 600 photos (8MB each)
2. Click "Upload All Photos"
3. **Expected:**
   - "Large Upload Detected" notification
   - ChunkedUploader UI appears
   - Shows: "Chunk 1/40... 15 photos"
   - Progress bar updates in real-time
   - ~30-60 minutes later (network dependent)
   - ✅ "Upload Complete! 600 photos uploaded"

4. **If interrupted:**
   - Close browser mid-upload (e.g., at chunk 20/40)
   - Reopen browser, return to upload page
   - **See**: "Resume Previous Upload? 300 of 600 photos uploaded"
   - Click "Resume"
   - Continues from chunk 21

## Comparison

| Feature | Old (FormData) | New (Chunked Supabase) |
|---------|---------------|----------------------|
| Upload method | Through serverless | Direct to storage |
| Max photos | ~100 (timeout) | **Unlimited** ✅ |
| Timeout risk | ❌ High | ✅ None |
| Resume capability | ❌ No | ✅ Yes |
| Retry logic | ❌ No | ✅ Yes |
| Progress tracking | Basic | Detailed (per-chunk) |
| Storage location | Supabase | Supabase (same!) |
| Extra services | None | None |

## Security

### Client-Side Upload Security

**How is it secure?**
1. ✅ User must be authenticated (checked by Supabase SDK)
2. ✅ RLS policies apply (user can only upload to their folder)
3. ✅ File type validation (client + server)
4. ✅ File size validation (50MB limit)
5. ✅ Path is generated (user can't specify arbitrary paths)

**RLS Policy (Already in place):**
\`\`\`sql
CREATE POLICY "Users can upload to their own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'photos' AND (storage.foldername(name))[1] = auth.uid()::text);
\`\`\`

This ensures users can only upload to `{their_user_id}/filename.jpg`

## Troubleshooting

### Issue: "User not authenticated"
**Cause:** Session expired
**Solution:** Refresh page and log in again

### Issue: Uploads slow/failing
**Cause:** Network issues
**Solution:**
- Check internet connection
- System will auto-retry (3 attempts per chunk)
- Use Pause/Resume to control upload

### Issue: Some chunks fail repeatedly
**Cause:** Possible Supabase Storage quota exceeded
**Solution:**
- Check Supabase dashboard for storage limits
- Upgrade plan if needed
- Failed chunks can be retried later

### Issue: Photos not appearing
**Cause:** Database save failed (URLs uploaded but not recorded)
**Solution:**
- Check `/api/photos/save-storage` logs in Vercel
- Check Supabase logs for database errors
- Retry failed chunks

## Environment Variables

**Required (already set):**
\`\`\`env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
\`\`\`

**Not needed:**
\`\`\`env
# These are NOT required for Supabase chunked upload:
# BLOB_READ_WRITE_TOKEN (Vercel Blob - not used)
# NEXT_PUBLIC_ENABLE_VERCEL_BLOB (Vercel Blob - not used)
\`\`\`

## Summary

### What Changed
- ✅ Upload method: Now client-side direct to Supabase Storage
- ✅ Chunking: Breaks large batches into 15-photo chunks
- ✅ Retry logic: Automatic retry with exponential backoff
- ✅ Session tracking: Resume capability across page reloads

### What Stayed the Same
- ✅ Storage location: Supabase Storage `photos` bucket
- ✅ Path pattern: `{userId}/{timestamp}-{random}.{ext}`
- ✅ Database schema: Same `photos` table structure
- ✅ Processing queue: Same queue system for AI features
- ✅ RLS policies: Same security rules

### The Result
**You can now upload 600 photos (8MB each) without timeout errors!**

The system:
- Uploads directly to your Supabase Storage
- Uses the same path pattern and bucket
- Bypasses the serverless function timeout
- Provides progress tracking and resume capability
- Requires no additional services or costs

**Your 600-photo problem is solved! 🎉**
