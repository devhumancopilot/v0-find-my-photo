# Upload Timeout Fix - Frontend Stuck on 100+ Image Upload

## 🔍 Problem Summary

When uploading 100+ images in production (Render deployment), the frontend appears "stuck" on the uploading page even though the backend successfully completes processing.

**Symptom**: Progress bar stops updating, user sees "Uploading..." indefinitely

**Root Cause**: Missing timeout handling + no progress feedback during database save phase + Render's 512MB memory constraints

---

## 📊 What's Actually Happening

### Upload Flow Breakdown:

```
Phase 1: Upload to Supabase Storage (30-60 seconds)
├── ✅ Direct upload from client to Supabase
├── ✅ Chunked: 15 photos per chunk
├── ✅ Progress bar shows updates
└── ✅ Works correctly

Phase 2: Save metadata to database (140+ seconds) ❌ PROBLEM HERE
├── ❌ Each chunk calls /api/photos/save-storage
├── ❌ No progress feedback shown
├── ❌ No timeout on fetch calls
├── ❌ Backend slow due to 512MB RAM limit
├── ❌ Takes 10-30 seconds per chunk (should be 1-2s)
└── ❌ Appears frozen to user

100 photos = 7 chunks × 20 seconds avg = 140+ seconds of "freeze"
```

### Why It Appears Stuck:

1. **Missing Timeout**: Fetch call has no timeout, waits indefinitely
2. **No Progress UI**: User sees no updates during database save
3. **Memory Pressure**: Render Free tier (512MB) causes slow responses
4. **Sequential Processing**: Can't proceed until each chunk saves

---

## 🛠️ Solution: Three-Part Fix

### Fix #1: Add Fetch Timeout Wrapper

**File**: `lib/utils/supabase-chunked-upload.ts`

**Add helper function**:
```typescript
/**
 * Fetch with timeout
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = 60000
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}
```

**Update `saveChunkToDatabase()` function** (line 228):
```typescript
async function saveChunkToDatabase(
  photos: Array<{ photoId: string; storageUrl: string; filename: string; size: number; type: string }>
): Promise<{ success: boolean; photoIds: number[]; errors: string[] }> {
  try {
    // Add timeout (60 seconds for database save)
    const response = await fetchWithTimeout('/api/photos/save-storage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        photos: photos.map((p) => ({
          name: p.filename,
          url: p.storageUrl,
          size: p.size,
          type: p.type,
        })),
      }),
    }, 60000); // 60 second timeout

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Database save failed: ${errorText}`);
    }

    const result = await response.json();

    return {
      success: true,
      photoIds: result.photos?.map((p: any) => p.id) || [],
      errors: result.errors || [],
    };

  } catch (error) {
    console.error('[Save Chunk] Database error:', error);
    throw error;
  }
}
```

---

### Fix #2: Add Progress Feedback for Database Save

**File**: `lib/utils/supabase-chunked-upload.ts`

**Update `ChunkedUploadOptions` interface** (line 7):
```typescript
export interface ChunkedUploadOptions {
  onChunkStart?: (chunkIndex: number, totalChunks: number) => void;
  onChunkProgress?: (chunkIndex: number, photoIndex: number, totalInChunk: number) => void;
  onChunkComplete?: (chunkIndex: number, result: ChunkUploadResult) => void;
  onChunkError?: (chunkIndex: number, error: Error, willRetry: boolean) => void;
  onDatabaseSaveStart?: (chunkIndex: number) => void;  // NEW
  onDatabaseSaveComplete?: (chunkIndex: number) => void;  // NEW
}
```

**Update `uploadPhotoChunkToSupabase()` function** (line 76):
```typescript
// Before saving to database
console.log(`[Supabase Chunk ${chunkIndex}] Saving ${successfulUploads.length} photos to database`);
options?.onDatabaseSaveStart?.(chunkIndex);  // NEW: Notify UI

const dbResult = await saveChunkToDatabase(
  successfulUploads.map((r, idx) => ({
    photoId: r.photoId,
    storageUrl: r.storageUrl!,
    filename: files[uploadResults.indexOf(r)].name,
    size: files[uploadResults.indexOf(r)].size,
    type: files[uploadResults.indexOf(r)].type,
  }))
);

options?.onDatabaseSaveComplete?.(chunkIndex);  // NEW: Notify UI
```

---

### Fix #3: Update UI to Show Database Save Progress

**File**: `components/chunked-uploader.tsx`

**Add new state** (after line 34):
```typescript
const [currentChunkIndex, setCurrentChunkIndex] = useState<number | null>(null);
const [currentPhotoInChunk, setCurrentPhotoInChunk] = useState(0);
const [isSavingToDatabase, setIsSavingToDatabase] = useState(false);  // NEW
```

**Update `processChunks()` to use new callbacks** (line 116):
```typescript
const result: ChunkUploadResult = await uploadPhotoChunkToSupabase(chunkFiles, i, {
  onChunkProgress: (chunkIdx, photoIdx, totalInChunk) => {
    setCurrentPhotoInChunk(photoIdx);
    setIsSavingToDatabase(false);  // Still uploading
  },
  onDatabaseSaveStart: (chunkIdx) => {
    console.log(`[Chunked Uploader] Saving chunk ${chunkIdx} to database...`);
    setIsSavingToDatabase(true);  // Show database save state
  },
  onDatabaseSaveComplete: (chunkIdx) => {
    console.log(`[Chunked Uploader] Chunk ${chunkIdx} saved to database`);
    setIsSavingToDatabase(false);
  },
});
```

**Update progress UI** (line 246):
```typescript
{/* Current Chunk Progress */}
{currentChunkIndex !== null && isUploading && (
  <div>
    <div className="flex justify-between text-sm mb-2">
      <span>
        {isSavingToDatabase
          ? `Saving Chunk ${currentChunkIndex + 1} to Database...`  // NEW
          : `Current Chunk (Photo ${currentPhotoInChunk} of ${Math.min(chunkSize, files.length - currentChunkIndex * chunkSize)})`
        }
      </span>
      <span className="text-blue-600">
        {isSavingToDatabase ? 'Saving...' : 'Uploading...'}
      </span>
    </div>
    <Progress value={(currentPhotoInChunk / chunkSize) * 100} className="h-2" />
  </div>
)}
```

---

## 🚀 Additional Optimizations (Optional)

### Option A: Increase Backend Memory (Recommended)

**Cost**: $7/month for Render Starter plan

**Benefits**:
- 2GB RAM instead of 512MB
- Database saves take 1-2 seconds instead of 10-30 seconds
- No timeout issues
- Better overall performance

**How to upgrade**:
1. Render Dashboard → Backend Service
2. Settings → Instance Type → Change to "Starter"
3. Redeploy

### Option B: Optimize Chunk Size

**File**: `lib/hooks/useUploadSession.ts:29`

**Current**:
```typescript
const CHUNK_SIZE = 15; // Upload 15 photos per chunk
```

**Optimized for Render Free**:
```typescript
const CHUNK_SIZE = 10; // Reduce to 10 photos per chunk
```

**Effect**: More chunks, but each database save is faster (less memory pressure)

### Option C: Add Retry Logic

**File**: `lib/utils/supabase-chunked-upload.ts`

**Update `saveChunkToDatabase()` with retry**:
```typescript
async function saveChunkToDatabase(
  photos: Array<{ photoId: string; storageUrl: string; filename: string; size: number; type: string }>,
  retryCount: number = 0,
  maxRetries: number = 3
): Promise<{ success: boolean; photoIds: number[]; errors: string[] }> {
  try {
    const response = await fetchWithTimeout('/api/photos/save-storage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        photos: photos.map((p) => ({
          name: p.filename,
          url: p.storageUrl,
          size: p.size,
          type: p.type,
        })),
      }),
    }, 60000);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Database save failed: ${errorText}`);
    }

    const result = await response.json();

    return {
      success: true,
      photoIds: result.photos?.map((p: any) => p.id) || [],
      errors: result.errors || [],
    };

  } catch (error) {
    console.error(`[Save Chunk] Database error (attempt ${retryCount + 1}/${maxRetries + 1}):`, error);

    // Retry on timeout or network errors
    if (retryCount < maxRetries) {
      const isRetryableError =
        error instanceof Error &&
        (error.message.includes('timeout') ||
         error.message.includes('network') ||
         error.message.includes('fetch'));

      if (isRetryableError) {
        console.log(`[Save Chunk] Retrying in 2 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return saveChunkToDatabase(photos, retryCount + 1, maxRetries);
      }
    }

    throw error;
  }
}
```

---

## ✅ Testing Plan

### Test 1: Small Upload (10 photos)
- Should complete without timeout
- Progress shows "Saving Chunk X to Database..."
- Completes in <30 seconds

### Test 2: Medium Upload (50 photos)
- Should complete without timeout
- Shows database save progress for each chunk
- Completes in <2 minutes

### Test 3: Large Upload (100 photos)
- Should complete without timeout errors
- Shows clear progress through all phases
- Completes in <5 minutes
- No "frozen" appearance

### Test 4: Timeout Scenario
- Simulate slow backend (add delay in backend code)
- Should timeout after 60 seconds
- Should show clear error message
- Should allow retry

---

## 📋 Implementation Checklist

- [ ] Add `fetchWithTimeout()` helper function
- [ ] Update `saveChunkToDatabase()` to use timeout
- [ ] Add new callbacks to `ChunkedUploadOptions`
- [ ] Update `uploadPhotoChunkToSupabase()` to call new callbacks
- [ ] Add `isSavingToDatabase` state to UI component
- [ ] Update progress UI to show database save state
- [ ] Test with 10, 50, and 100 photos
- [ ] Optional: Add retry logic
- [ ] Optional: Reduce chunk size to 10
- [ ] Optional: Upgrade backend to Starter plan

---

## 🐛 Troubleshooting

### Issue: Still timing out after 60 seconds

**Solution**:
- Increase timeout to 90 seconds
- OR reduce chunk size to 10
- OR upgrade backend RAM

### Issue: Database save still slow

**Solution**:
- Check Render backend metrics
- Verify backend memory usage
- Consider upgrading to Starter plan ($7/mo)

### Issue: Progress shows but still appears stuck

**Solution**:
- Check browser console for errors
- Verify all callbacks are firing
- Check backend logs for slow queries

---

## 📊 Expected Performance After Fix

| Upload Size | Before Fix | After Fix |
|------------|------------|-----------|
| 10 photos | Works fine | Works fine + better feedback |
| 50 photos | Appears stuck | Clear progress, completes ~2 min |
| 100 photos | Appears stuck | Clear progress, completes ~4 min |
| 200 photos | Appears stuck | Clear progress, completes ~8 min |

**With Backend Upgrade to Starter**:
- 100 photos: ~90 seconds (2x faster)
- 200 photos: ~3 minutes (2x faster)

---

## 💰 Cost-Benefit Analysis

### Option 1: Implement Fixes Only (Free)
- ✅ Better user experience
- ✅ Clear progress feedback
- ✅ Timeout protection
- ⚠️ Still slow on large uploads

### Option 2: Fixes + Backend Upgrade ($7/month)
- ✅ All benefits of Option 1
- ✅ 2-3x faster uploads
- ✅ No timeout issues
- ✅ Better overall performance
- 💰 $7/month cost

**Recommendation**: Start with free fixes, upgrade if users frequently upload 100+ photos.

---

## 🎯 Priority

**Critical**: Fixes #1 and #2 (timeout + progress feedback)
**High**: Fix #3 (UI updates)
**Medium**: Option C (retry logic)
**Low**: Option B (chunk size optimization)
**Optional**: Option A (backend upgrade)

---

**Status**: Ready to implement
**Estimated Time**: 1-2 hours for all fixes
**Impact**: Resolves "frontend stuck" issue completely
