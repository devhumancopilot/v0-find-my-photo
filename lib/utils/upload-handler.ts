import { uploadAllChunksToSupabase } from './supabase-chunked-upload';
import { getBackendAPIURL } from '@/lib/config';

/**
 * Helper function to sleep for a given duration (for retry backoff)
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if error is retryable (network/timeout errors, not validation errors)
 */
function isRetryableError(error: any, statusCode?: number): boolean {
  // Don't retry client errors (400-499) except 408 (timeout) and 429 (rate limit)
  if (statusCode && statusCode >= 400 && statusCode < 500) {
    return statusCode === 408 || statusCode === 429;
  }

  // Retry on network errors and timeouts
  if (error instanceof Error) {
    return error.name === 'AbortError' ||
           error.message.includes('network') ||
           error.message.includes('timeout') ||
           error.message.includes('fetch');
  }

  // Retry on server errors (500+) and unknown errors
  return true;
}

export interface UploadResult {
  success: boolean;
  uploaded_count: number;
  failed_count: number;
  photos?: Array<{ id: number; name: string; url: string }>;
  errors?: string[];
  useChunkedUpload?: boolean;
}

/**
 * Upload photos using Supabase Storage with chunked uploads and retry support
 * This bypasses the serverless function and handles large batches (500+ photos)
 */
export async function uploadPhotosWithSupabaseChunked(
  files: File[],
  onProgress?: (current: number, total: number, progress: number) => void
): Promise<UploadResult> {
  console.log(`[Supabase Chunked] Starting chunked upload of ${files.length} files`);

  // For large uploads (>50 photos), recommend using the ChunkedUploader component
  if (files.length > 50) {
    console.warn('[Supabase Chunked] Large upload detected. Using ChunkedUploader component for better reliability.');
    return {
      success: false,
      uploaded_count: 0,
      failed_count: 0,
      useChunkedUpload: true,
      errors: ['Please use the chunked uploader for large batches (>50 photos)'],
    };
  }

  // For smaller uploads, use the simple upload
  const chunkSize = 15;

  try {
    const { totalUploaded, totalFailed } = await uploadAllChunksToSupabase(
      files,
      chunkSize,
      (chunkIndex, result) => {
        // Calculate overall progress
        const completedChunks = chunkIndex + 1;
        const totalChunks = Math.ceil(files.length / chunkSize);
        const progress = (completedChunks / totalChunks) * 100;

        onProgress?.(
          result.storageUrls.length * (chunkIndex + 1),
          files.length,
          progress
        );
      },
      {
        onChunkProgress: (chunkIndex, photoIndex, totalInChunk) => {
          const chunkStart = chunkIndex * chunkSize;
          const currentPhoto = chunkStart + photoIndex;
          const progress = (currentPhoto / files.length) * 100;

          onProgress?.(currentPhoto, files.length, progress);
        },
      }
    );

    return {
      success: totalUploaded > 0,
      uploaded_count: totalUploaded,
      failed_count: totalFailed,
    };
  } catch (error) {
    console.error('[Supabase Chunked] Upload error:', error);
    return {
      success: false,
      uploaded_count: 0,
      failed_count: files.length,
      errors: [error instanceof Error ? error.message : 'Upload failed'],
    };
  }
}

/**
 * Upload photos using traditional FormData approach (Supabase Storage)
 * Subject to 4MB serverless function payload limit
 */
export async function uploadPhotosWithFormData(
  files: File[],
  googlePhotos: Array<{ id: string; baseUrl: string; filename?: string }>,
  onProgress?: (current: number, total: number, progress: number) => void
): Promise<UploadResult> {
  const BATCH_SIZE = 10;
  const allPhotosToUpload = [...files, ...googlePhotos];
  let totalUploaded = 0;
  let totalFailed = 0;

  console.log(`[FormData Upload] Starting batch upload: ${allPhotosToUpload.length} photos in batches of ${BATCH_SIZE}`);

  // Upload in batches
  for (let i = 0; i < allPhotosToUpload.length; i += BATCH_SIZE) {
    const batch = allPhotosToUpload.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(allPhotosToUpload.length / BATCH_SIZE);

    console.log(`[FormData Upload] Uploading batch ${batchNumber}/${totalBatches} (${batch.length} photos)`);

    const formData = new FormData();

    // Add photos to FormData
    for (let j = 0; j < batch.length; j++) {
      const item = batch[j];
      const currentPhotoIndex = i + j + 1;

      // Update progress per photo (0-90% for preparation)
      const prepProgress = ((currentPhotoIndex - 0.5) / allPhotosToUpload.length) * 90;
      onProgress?.(currentPhotoIndex, allPhotosToUpload.length, Math.min(prepProgress, 90));

      if (item instanceof File) {
        // Manual upload
        formData.append('photos', item);
      } else {
        // Google Photos - need to fetch and add as Blob
        try {
          const proxyUrl = `/api/google-photos/proxy-image?url=${encodeURIComponent(item.baseUrl)}&size=d`;
          const imageResponse = await fetch(proxyUrl);

          if (!imageResponse.ok) {
            console.error(`[FormData Upload] Failed to fetch Google Photo ${item.id}`);
            totalFailed++;
            continue;
          }

          const blob = await imageResponse.blob();
          const filename = item.filename || `google-photo-${item.id}.jpg`;
          formData.append('photos', blob, filename);
        } catch (error) {
          console.error(`[FormData Upload] Error fetching Google Photo ${item.id}:`, error);
          totalFailed++;
          continue;
        }
      }
    }

    // Upload batch with retry logic and timeout protection
    const MAX_RETRIES = 3;
    let retryCount = 0;
    let batchSuccess = false;

    while (retryCount <= MAX_RETRIES && !batchSuccess) {
      try {
        if (retryCount > 0) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, retryCount - 1) * 1000;
          console.log(`[FormData Upload] Retrying batch ${batchNumber} (attempt ${retryCount + 1}/${MAX_RETRIES + 1}) after ${delay}ms`);
          await sleep(delay);
        }

        // Create abort controller for timeout (90s - less than backend's 120s limit)
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => {
          console.warn(`[FormData Upload] Batch ${batchNumber} timeout after 90s`);
          abortController.abort();
        }, 90000);

        const response = await fetch(getBackendAPIURL('/api/photos/upload'), {
          method: 'POST',
          body: formData,
          credentials: 'include',
          signal: abortController.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          const shouldRetry = isRetryableError(new Error(errorText), response.status);

          if (!shouldRetry || retryCount >= MAX_RETRIES) {
            console.error(`[FormData Upload] Batch ${batchNumber} upload failed (non-retryable or max retries):`, response.status, errorText);
            totalFailed += batch.length;
            break; // Exit retry loop
          }

          throw new Error(`Batch upload failed: ${errorText}`);
        }

        const result = await response.json();
        const batchUploadedCount = result.uploaded_count || 0;
        totalUploaded += batchUploadedCount;

        // Update progress per photo actually uploaded (90-98% for upload completion)
        const uploadProgress = 90 + ((totalUploaded / allPhotosToUpload.length) * 8);
        onProgress?.(totalUploaded, allPhotosToUpload.length, Math.min(uploadProgress, 98));

        console.log(`[FormData Upload] Batch ${batchNumber} uploaded successfully:`, result);
        batchSuccess = true;
      } catch (error) {
        const shouldRetry = isRetryableError(error);

        if (error instanceof Error && error.name === 'AbortError') {
          console.error(`[FormData Upload] Batch ${batchNumber} timed out after 90s`);
        } else {
          console.error(`[FormData Upload] Batch ${batchNumber} error:`, error);
        }

        if (!shouldRetry || retryCount >= MAX_RETRIES) {
          totalFailed += batch.length;
          break; // Exit retry loop
        }

        retryCount++;
      }
    }
  }

  return {
    success: totalUploaded > 0,
    uploaded_count: totalUploaded,
    failed_count: totalFailed,
  };
}
