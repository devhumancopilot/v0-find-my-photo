# Chunked Upload Scheduler System

## Problem Statement

When uploading 600+ images, only ~100 successfully upload because:
- **Vercel timeout limits**: 10s (Hobby), 60s (Pro), 300s (Enterprise)
- **Large photo batches**: Even with client-side Vercel Blob uploads, database save operations timeout
- **No recovery mechanism**: Failed uploads cannot be resumed

## Solution: Chunked Upload with Session Management

The scheduler system breaks large uploads into manageable chunks with automatic retry and resume capabilities.

---

## Architecture Overview

\`\`\`
┌────────────────────────────────────────────────────────────┐
│                    User Uploads 600 Photos                  │
└───────────────────────────┬────────────────────────────────┘
                            │
                            ▼
                  ┌─────────────────────┐
                  │  Upload Session     │
                  │  ID: uuid()         │
                  │  Chunks: 40 (15ea)  │
                  └─────────┬───────────┘
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
          ▼                 ▼                 ▼
    ┌─────────┐       ┌─────────┐       ┌─────────┐
    │ Chunk 1 │       │ Chunk 2 │  ...  │Chunk 40 │
    │ 15 photos│       │ 15 photos│       │ 15 photos│
    └────┬────┘       └────┬────┘       └────┬────┘
         │                 │                  │
         ▼                 ▼                  ▼
    Upload to Blob    Upload to Blob    Upload to Blob
    (Client-side)     (Client-side)     (Client-side)
         │                 │                  │
         ▼                 ▼                  ▼
    Save 15 URLs      Save 15 URLs      Save 15 URLs
    to DB (~1s)       to DB (~1s)       to DB (~1s)
         │                 │                  │
         ▼                 ▼                  ▼
       ✅ Done          ✅ Done            ✅ Done
\`\`\`

---

## Key Components

### 1. Upload Session Management (`useUploadSession` hook)

**Purpose**: Track upload progress across page reloads and failures

**State Structure**:
\`\`\`typescript
{
  sessionId: "uuid",
  totalPhotos: 600,
  uploadedCount: 240,
  failedCount: 10,
  status: 'in_progress' | 'completed' | 'failed' | 'paused',
  chunks: [
    {
      index: 0,
      status: 'completed',
      photoIds: ['photo1', 'photo2', ...],
      blobUrls: ['https://...', ...],
      dbPhotoIds: [123, 124, ...],
      retryCount: 0
    },
    {
      index: 1,
      status: 'failed',
      error: 'Network timeout',
      retryCount: 2
    },
    // ... 38 more chunks
  ]
}
\`\`\`

**Features**:
- ✅ localStorage persistence (survives page refresh)
- ✅ Database backup (survives browser close)
- ✅ Automatic session recovery on page load
- ✅ Per-chunk status tracking

### 2. Chunked Upload Handler (`chunked-upload-handler.ts`)

**Purpose**: Upload photos in small batches with intelligent retry

**Chunk Size**: 15 photos per chunk
- Small enough to avoid timeout (~1-2s per chunk)
- Large enough to be efficient (40 chunks for 600 photos)

**Retry Strategy**:
\`\`\`typescript
Attempt 1: Immediate
Attempt 2: Wait 1s
Attempt 3: Wait 3s
Attempt 4: Wait 10s (final)
Max retries: 3
\`\`\`

**Error Categorization**:
- **Network errors**: Retry immediately
- **Rate limits (429)**: Exponential backoff
- **Server errors (500)**: Retry with backoff
- **Client errors (400)**: Don't retry, mark as failed
- **Auth errors (401)**: Stop entire upload
- **Quota exceeded**: Stop entire upload

### 3. ChunkedUploader Component

**Purpose**: UI for tracking and controlling large uploads

**Features**:
- ✅ Real-time progress visualization
- ✅ Pause/Resume controls
- ✅ Automatic recovery prompt on page load
- ✅ Retry failed chunks button
- ✅ Per-chunk status display (dev mode)

**User Experience**:
\`\`\`
Upload Progress
Chunk 25 of 40 • 375 photos uploaded

Overall Progress: [███████████░░░░░] 62%

Current Chunk (Photo 5 of 15): [███░░░░░░░░░░░░] 33%

Status: ⏫ Uploading...

[⏸️ Pause]
\`\`\`

### 4. Session Recovery API (`/api/upload/session`)

**Purpose**: Persist session state to database for multi-device recovery

**Endpoints**:
- `POST /api/upload/session` - Create/update session
- `GET /api/upload/session?session_id=xxx` - Retrieve session
- `GET /api/upload/session` - List all in-progress sessions
- `DELETE /api/upload/session?session_id=xxx` - Cancel session

**Database Schema**: See `upload_sessions` table

---

## How It Solves the Timeout Problem

### Before (Fails at ~100 photos):
\`\`\`
Upload 600 photos → Batch 1 (10) → Upload → Save DB ✅
                  → Batch 2 (10) → Upload → Save DB ✅
                  → ...
                  → Batch 10 (10) → Upload → Save DB ✅
                  → Batch 11 (10) → Upload → ⏱️ TIMEOUT ❌
                  → Remaining 500 photos never processed ❌
\`\`\`

**Problem**: Cumulative time exceeds Vercel's 60s limit

### After (Handles 600+ photos):
\`\`\`
Upload 600 photos → Chunk 1 (15) → Client Upload (3s) → Save DB (1s) ✅
                  → Chunk 2 (15) → Client Upload (3s) → Save DB (1s) ✅
                  → ...
                  → Chunk 40 (15) → Client Upload (3s) → Save DB (1s) ✅
\`\`\`

**Why it works**:
- ✅ Each API call is independent (~1-2s, well under 60s limit)
- ✅ Client-side upload doesn't count toward function timeout
- ✅ If chunk 25 fails, chunks 1-24 are already saved
- ✅ Automatic retry recovers from transient errors
- ✅ User can resume if browser closes

---

## Usage Guide

### Automatic Mode (Recommended)

When you upload **>50 photos** with Vercel Blob enabled, the system automatically uses chunked upload:

\`\`\`typescript
// In upload page:
if (useVercelBlob && allFiles.length > 50) {
  setUseChunkedUpload(true) // Activates ChunkedUploader component
}
\`\`\`

**User sees**:
1. "Large Upload Detected" toast notification
2. ChunkedUploader UI with detailed progress
3. Pause/Resume controls
4. Automatic checkpoint saves

### Manual Resume

If upload is interrupted:

1. **User returns to upload page**
2. **System detects incomplete session** (from localStorage)
3. **Prompt appears**: "Resume Previous Upload? 240 of 600 photos uploaded."
4. **User clicks Resume**
5. **Upload continues from chunk 17** (where it stopped)

### Recovery Scenarios

| Scenario | Recovery Method |
|----------|----------------|
| Network drops mid-chunk | Automatic retry (max 3 attempts) |
| Browser tab closes | Resume prompt on page reload |
| Computer sleeps | Resume from localStorage on wake |
| Vercel timeout on chunk | Automatic retry with backoff |
| User navigates away | Session persists, resumable |

---

## Configuration

### Environment Variables

\`\`\`env
# Enable Vercel Blob (required for chunked upload)
NEXT_PUBLIC_ENABLE_VERCEL_BLOB=true

# Optional: Adjust chunk size (default: 15)
# Smaller = more resilient, more API calls
# Larger = faster, higher timeout risk
UPLOAD_CHUNK_SIZE=15
\`\`\`

### Tuning Parameters

**File**: `lib/hooks/useUploadSession.ts`
\`\`\`typescript
const CHUNK_SIZE = 15; // Photos per chunk
\`\`\`

**File**: `lib/utils/chunked-upload-handler.ts`
\`\`\`typescript
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 3000, 10000]; // ms
\`\`\`

---

## Testing the System

### Test Case 1: Normal Upload (600 photos)

1. Select 600 photos
2. Click "Upload All Photos"
3. **Expected**: ChunkedUploader UI appears
4. **Expected**: Progress shows 40 chunks
5. **Expected**: All 600 photos upload successfully

### Test Case 2: Network Interruption

1. Start uploading 600 photos
2. After 10 chunks, disconnect network
3. **Expected**: Chunk fails, automatic retry
4. Reconnect network
5. **Expected**: Retry succeeds, upload continues

### Test Case 3: Browser Close & Resume

1. Start uploading 600 photos
2. After 15 chunks (225 photos), close browser
3. Reopen browser, navigate to upload page
4. **Expected**: "Resume Previous Upload? 225 of 600 photos uploaded."
5. Click Resume
6. **Expected**: Upload continues from chunk 16

### Test Case 4: Timeout Simulation

Add artificial delay in API to simulate timeout:
\`\`\`typescript
// In /api/photos/save-blob
await new Promise(resolve => setTimeout(resolve, 65000)); // 65s delay
\`\`\`
**Expected**: Chunk fails, retries with backoff, eventually succeeds or marks as failed

### Test Case 5: Failed Chunk Retry

1. Upload 600 photos
2. Manually fail some chunks (disconnect network during specific chunks)
3. **Expected**: Failed chunks marked with ❌
4. Click "Retry Failed (3)" button
5. **Expected**: Only failed chunks reprocess

---

## Performance Metrics

### Upload Times (Estimated)

| Photos | Chunks | Upload Time | API Calls |
|--------|--------|-------------|-----------|
| 50 | 4 | ~20s | 4 |
| 100 | 7 | ~35s | 7 |
| 300 | 20 | ~1.5min | 20 |
| 600 | 40 | ~3min | 40 |
| 1000 | 67 | ~5min | 67 |

**Factors**:
- Client upload speed: ~2-3s per chunk (network dependent)
- Database save: ~1s per chunk
- Retry delays: Add 1-10s per failed chunk

### Vercel Function Limits

| Plan | Timeout | Max Photos (Without Chunking) | Max Photos (With Chunking) |
|------|---------|-------------------------------|---------------------------|
| Hobby | 10s | ~20 | **Unlimited** ✅ |
| Pro | 60s | ~100 | **Unlimited** ✅ |
| Enterprise | 300s | ~500 | **Unlimited** ✅ |

---

## Troubleshooting

### Issue: Chunks keep failing

**Symptoms**: Multiple chunks fail after 3 retries

**Possible Causes**:
1. Network is unstable
2. Vercel Blob quota exceeded
3. Invalid `BLOB_READ_WRITE_TOKEN`
4. Database connection issues

**Solution**:
1. Check network connection
2. Verify Vercel Blob storage limits
3. Check browser console for specific errors
4. Review Vercel function logs

### Issue: Session not resuming

**Symptoms**: Page reloads but no resume prompt

**Possible Causes**:
1. localStorage was cleared
2. Different browser/device
3. Session expired (>24 hours old)

**Solution**:
1. Check localStorage for `upload_session_state` key
2. Query database for in-progress sessions: `GET /api/upload/session`
3. Manual recovery via session ID

### Issue: Progress stuck

**Symptoms**: Upload appears frozen

**Possible Causes**:
1. JavaScript error in console
2. Awaiting retry delay
3. Browser tab backgrounded (throttled)

**Solution**:
1. Check browser console for errors
2. Wait for retry delay to expire
3. Keep tab active/focused
4. Use Pause/Resume to reset

---

## Database Schema

\`\`\`sql
CREATE TABLE public.upload_sessions (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID UNIQUE DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  total_photos INTEGER NOT NULL DEFAULT 0,
  uploaded_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'in_progress',
  chunks JSONB NOT NULL DEFAULT '[]'::jsonb,
  errors JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
\`\`\`

**Indexes**:
- `idx_upload_sessions_user_id` - User queries
- `idx_upload_sessions_session_id` - Session lookups
- `idx_upload_sessions_status` - Status filtering
- `idx_upload_sessions_last_activity` - Stale session detection

---

## Future Enhancements

### Phase 2 (Optional):

1. **Parallel chunk uploads**: Upload 2-3 chunks concurrently
2. **Background processing**: Continue upload when tab is closed (Service Worker)
3. **Email notifications**: Notify when large upload completes
4. **Cron job cleanup**: Auto-retry stalled sessions every hour
5. **Progress API**: Real-time progress via SSE or WebSocket

### Phase 3 (Advanced):

1. **Multi-device sync**: Resume upload on different device
2. **Bandwidth optimization**: Adaptive chunk size based on connection
3. **Duplicate detection**: Skip photos already uploaded (by hash)
4. **Batch operations**: Delete/retry multiple sessions at once

---

## Summary

The chunked upload scheduler solves the 600-photo upload timeout problem by:

✅ **Breaking uploads into 15-photo chunks** (each takes ~1-2s, well under timeout)
✅ **Client-side Vercel Blob uploads** (no serverless function involvement for actual upload)
✅ **Automatic retry with exponential backoff** (recovers from transient failures)
✅ **localStorage + database persistence** (survives page refresh and browser close)
✅ **Resume capability** (pick up where you left off)
✅ **Pause/Resume controls** (user can manage upload)
✅ **Per-chunk status tracking** (know exactly what succeeded/failed)

**Result**: Upload **600, 1000, or even 10,000+ photos** without hitting Vercel timeout limits!

---

## Quick Start

1. **Enable Vercel Blob**:
   \`\`\`env
   NEXT_PUBLIC_ENABLE_VERCEL_BLOB=true
   \`\`\`

2. **Upload >50 photos**: Chunked uploader activates automatically

3. **Monitor progress**: Watch real-time chunk progress

4. **Resume if needed**: Close browser, reopen, click Resume

That's it! The system handles everything else automatically.
