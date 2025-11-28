import { createClient } from '@/lib/supabase/client';
import type { ChunkProgress } from '@/lib/hooks/useUploadSession';
import { getBackendAPIURL, getAuthHeaders } from '@/lib/config';

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 3000, 10000]; // 1s, 3s, 10s exponential backoff

export interface ChunkedUploadOptions {
  onChunkStart?: (chunkIndex: number, totalChunks: number) => void;
  onChunkProgress?: (chunkIndex: number, photoIndex: number, totalInChunk: number) => void;
  onChunkComplete?: (chunkIndex: number, result: ChunkUploadResult) => void;
  onChunkError?: (chunkIndex: number, error: Error, willRetry: boolean) => void;
}

export interface ChunkUploadResult {
  success: boolean;
  chunkIndex: number;
  photoIds: string[];
  storageUrls: string[];
  dbPhotoIds?: number[];
  errors: string[];
  retryCount: number;
}

interface PhotoUploadResult {
  photoId: string;
  storageUrl?: string;
  filePath?: string;
  error?: string;
}

/**
 * Upload a chunk of photos directly to Supabase Storage (client-side)
 * Uses the same path pattern as your existing implementation: {userId}/{timestamp}-{random}.{ext}
 */
export async function uploadPhotoChunkToSupabase(
  files: File[],
  chunkIndex: number,
  options?: ChunkedUploadOptions
): Promise<ChunkUploadResult> {
  console.log(`[Supabase Chunk ${chunkIndex}] Starting upload of ${files.length} photos`);

  options?.onChunkStart?.(chunkIndex, -1);

  const result: ChunkUploadResult = {
    success: false,
    chunkIndex,
    photoIds: [],
    storageUrls: [],
    errors: [],
    retryCount: 0,
  };

  let attempt = 0;
  let lastError: Error | null = null;

  // Retry logic with exponential backoff
  while (attempt <= MAX_RETRIES) {
    try {
      // Upload photos to Supabase Storage
      const uploadResults = await uploadPhotosToSupabaseStorage(files, chunkIndex, options);

      // Extract successful uploads
      const successfulUploads = uploadResults.filter((r) => r.storageUrl);
      const failedUploads = uploadResults.filter((r) => r.error);

      result.photoIds = uploadResults.map((r) => r.photoId);
      result.storageUrls = successfulUploads.map((r) => r.storageUrl!);
      result.errors = failedUploads.map((r) => `${r.photoId}: ${r.error}`);
      result.retryCount = attempt;

      if (successfulUploads.length === 0) {
        throw new Error('All photos in chunk failed to upload');
      }

      // Save successful uploads to database
      console.log(`[Supabase Chunk ${chunkIndex}] Saving ${successfulUploads.length} photos to database`);

      const dbResult = await saveChunkToDatabase(
        successfulUploads.map((r, idx) => ({
          photoId: r.photoId,
          storageUrl: r.storageUrl!,
          filename: files[uploadResults.indexOf(r)].name,
          size: files[uploadResults.indexOf(r)].size,
          type: files[uploadResults.indexOf(r)].type,
        }))
      );

      result.dbPhotoIds = dbResult.photoIds;
      result.success = true;

      console.log(`[Supabase Chunk ${chunkIndex}] ✅ Success: ${successfulUploads.length}/${files.length} uploaded`);

      options?.onChunkComplete?.(chunkIndex, result);

      return result;

    } catch (error) {
      lastError = error as Error;
      attempt++;

      const willRetry = attempt <= MAX_RETRIES;
      console.error(`[Supabase Chunk ${chunkIndex}] ❌ Attempt ${attempt} failed:`, error);

      options?.onChunkError?.(chunkIndex, lastError, willRetry);

      if (willRetry) {
        const delay = RETRY_DELAYS[attempt - 1] || 10000;
        console.log(`[Supabase Chunk ${chunkIndex}] Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  // All retries exhausted
  result.success = false;
  result.errors.push(`Failed after ${MAX_RETRIES} retries: ${lastError?.message}`);
  result.retryCount = MAX_RETRIES;

  console.error(`[Supabase Chunk ${chunkIndex}] ❌ Failed after ${MAX_RETRIES} retries`);

  return result;
}

/**
 * Upload multiple photos directly to Supabase Storage (client-side)
 * This bypasses the serverless function and avoids timeout issues
 */
async function uploadPhotosToSupabaseStorage(
  files: File[],
  chunkIndex: number,
  options?: ChunkedUploadOptions
): Promise<PhotoUploadResult[]> {
  const supabase = createClient();
  const results: PhotoUploadResult[] = [];

  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('User not authenticated');
  }

  const userId = user.id;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const photoId = generatePhotoId(file);

    try {
      options?.onChunkProgress?.(chunkIndex, i + 1, files.length);

      console.log(`[Supabase Chunk ${chunkIndex}] Uploading photo ${i + 1}/${files.length}: ${file.name}`);

      // Validate file type
      if (!file.type.startsWith('image/')) {
        throw new Error('Not an image file');
      }

      // Validate file size (50MB max, same as your existing implementation)
      const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
      if (file.size > MAX_FILE_SIZE) {
        throw new Error('File too large (max 50MB)');
      }

      // Generate unique file path - SAME PATTERN as your existing implementation
      const cleanFileName = getBaseName(file.name);
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(7);
      const fileExt = cleanFileName.split('.').pop() || 'jpg';
      const fileName = `${timestamp}-${randomString}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      // Upload directly to Supabase Storage (CLIENT-SIDE)
      // This bypasses the serverless function completely!
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('photos')
        .upload(filePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('photos')
        .getPublicUrl(filePath);

      const storageUrl = urlData.publicUrl;

      results.push({
        photoId,
        storageUrl,
        filePath,
      });

      console.log(`[Supabase Chunk ${chunkIndex}] ✅ Uploaded: ${file.name} → ${storageUrl}`);

    } catch (error) {
      console.error(`[Supabase Chunk ${chunkIndex}] ❌ Failed to upload ${file.name}:`, error);

      results.push({
        photoId,
        error: error instanceof Error ? error.message : 'Upload failed',
      });

      // Categorize error and decide if we should continue or fail the chunk
      const errorCategory = categorizeError(error);

      if (errorCategory === 'auth' || errorCategory === 'quota') {
        // Fatal errors - stop the entire chunk
        throw error;
      }

      // For other errors, continue with remaining photos
    }
  }

  return results;
}

/**
 * Save uploaded photos to database
 * Uses the same API as Vercel Blob, but stores Supabase Storage URLs
 */
async function saveChunkToDatabase(
  photos: Array<{ photoId: string; storageUrl: string; filename: string; size: number; type: string }>
): Promise<{ success: boolean; photoIds: number[]; errors: string[] }> {
  try {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(getBackendAPIURL('/api/photos/save-storage'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({
        photos: photos.map((p) => ({
          name: p.filename,
          url: p.storageUrl,
          size: p.size,
          type: p.type,
        })),
      }),
    });

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

/**
 * Categorize errors for smart retry logic
 */
function categorizeError(error: unknown): 'network' | 'rate_limit' | 'server' | 'client' | 'auth' | 'quota' | 'unknown' {
  if (!error) return 'unknown';

  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  if (message.includes('network') || message.includes('timeout') || message.includes('fetch')) {
    return 'network';
  }
  if (message.includes('429') || message.includes('rate limit')) {
    return 'rate_limit';
  }
  if (message.includes('500') || message.includes('502') || message.includes('503')) {
    return 'server';
  }
  if (message.includes('400') || message.includes('invalid')) {
    return 'client';
  }
  if (message.includes('401') || message.includes('403') || message.includes('unauthorized')) {
    return 'auth';
  }
  if (message.includes('quota') || message.includes('storage full') || message.includes('exceeds')) {
    return 'quota';
  }

  return 'unknown';
}

/**
 * Generate a unique ID for a photo based on file properties
 */
function generatePhotoId(file: File): string {
  return `${file.name}_${file.size}_${file.lastModified}`;
}

/**
 * Extract filename without folder path (same as your existing implementation)
 */
function getBaseName(filename: string): string {
  return filename.split(/[/\\]/).pop() || filename;
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Upload all chunks sequentially with session tracking
 */
export async function uploadAllChunksToSupabase(
  allFiles: File[],
  chunkSize: number,
  onChunkUpdate: (chunkIndex: number, result: ChunkUploadResult) => void,
  options?: ChunkedUploadOptions
): Promise<{ totalUploaded: number; totalFailed: number }> {
  const numChunks = Math.ceil(allFiles.length / chunkSize);
  let totalUploaded = 0;
  let totalFailed = 0;

  console.log(`[Supabase Upload All] Starting upload of ${allFiles.length} photos in ${numChunks} chunks`);

  for (let chunkIndex = 0; chunkIndex < numChunks; chunkIndex++) {
    const start = chunkIndex * chunkSize;
    const end = Math.min(start + chunkSize, allFiles.length);
    const chunkFiles = allFiles.slice(start, end);

    console.log(`[Supabase Upload All] Processing chunk ${chunkIndex + 1}/${numChunks} (photos ${start + 1}-${end})`);

    const result = await uploadPhotoChunkToSupabase(chunkFiles, chunkIndex, options);

    onChunkUpdate(chunkIndex, result);

    if (result.success) {
      totalUploaded += result.storageUrls.length;
      totalFailed += result.errors.length;
    } else {
      totalFailed += chunkFiles.length;
    }
  }

  console.log(`[Supabase Upload All] ✅ Complete: ${totalUploaded} uploaded, ${totalFailed} failed`);

  return { totalUploaded, totalFailed };
}
