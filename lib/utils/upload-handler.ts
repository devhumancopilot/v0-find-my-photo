import { uploadAllChunksToSupabase } from './supabase-chunked-upload';

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

    // Upload batch
    try {
      const response = await fetch('/api/photos/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[FormData Upload] Batch ${batchNumber} upload failed:`, response.status, errorText);
        totalFailed += batch.length;
        throw new Error(`Batch upload failed: ${errorText}`);
      }

      const result = await response.json();
      const batchUploadedCount = result.uploaded_count || 0;
      totalUploaded += batchUploadedCount;

      // Update progress per photo actually uploaded (90-98% for upload completion)
      const uploadProgress = 90 + ((totalUploaded / allPhotosToUpload.length) * 8);
      onProgress?.(totalUploaded, allPhotosToUpload.length, Math.min(uploadProgress, 98));

      console.log(`[FormData Upload] Batch ${batchNumber} uploaded successfully:`, result);
    } catch (error) {
      console.error(`[FormData Upload] Batch ${batchNumber} error:`, error);
      // Continue with next batch even if this one fails
    }
  }

  return {
    success: totalUploaded > 0,
    uploaded_count: totalUploaded,
    failed_count: totalFailed,
  };
}
