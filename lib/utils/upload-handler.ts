import { upload } from '@vercel/blob/client';

export interface UploadResult {
  success: boolean;
  uploaded_count: number;
  failed_count: number;
  photos?: Array<{ id: number; name: string; url: string }>;
  errors?: string[];
}

/**
 * Upload photos using Vercel Blob (client-side upload)
 * This bypasses the 4MB serverless function payload limit
 */
export async function uploadPhotosWithVercelBlob(
  files: File[],
  onProgress?: (current: number, total: number, progress: number) => void
): Promise<UploadResult> {
  console.log(`[Vercel Blob] Starting upload of ${files.length} files`);

  const uploadedPhotos: Array<{ name: string; url: string; size: number; type: string }> = [];
  const errors: string[] = [];

  // Upload files to Vercel Blob
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const currentIndex = i + 1;

    try {
      console.log(`[Vercel Blob] Uploading ${currentIndex}/${files.length}: ${file.name}`);

      // Update progress (0-90% for upload)
      const progress = (currentIndex / files.length) * 90;
      onProgress?.(currentIndex, files.length, progress);

      // Upload to Vercel Blob with client-side upload
      const blob = await upload(file.name, file, {
        access: 'public',
        handleUploadUrl: '/api/upload/token',
        clientPayload: JSON.stringify({
          filename: file.name,
          fileType: file.type,
          fileSize: file.size,
        }),
      });

      console.log(`[Vercel Blob] Uploaded successfully: ${blob.url}`);

      uploadedPhotos.push({
        name: file.name,
        url: blob.url,
        size: file.size,
        type: file.type,
      });
    } catch (error) {
      console.error(`[Vercel Blob] Failed to upload ${file.name}:`, error);
      errors.push(`${file.name}: ${error instanceof Error ? error.message : 'Upload failed'}`);
    }
  }

  // Save blob URLs to database
  if (uploadedPhotos.length > 0) {
    try {
      console.log(`[Vercel Blob] Saving ${uploadedPhotos.length} photos to database`);

      // Update progress (90-100% for saving)
      onProgress?.(uploadedPhotos.length, files.length, 95);

      const response = await fetch('/api/photos/save-blob', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photos: uploadedPhotos }),
      });

      if (!response.ok) {
        throw new Error(`Failed to save photos: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('[Vercel Blob] Database save result:', result);

      onProgress?.(files.length, files.length, 100);

      return {
        success: true,
        uploaded_count: result.uploaded_count || 0,
        failed_count: errors.length + (result.failed_count || 0),
        photos: result.photos,
        errors: [...errors, ...(result.errors || [])],
      };
    } catch (error) {
      console.error('[Vercel Blob] Failed to save to database:', error);
      return {
        success: false,
        uploaded_count: 0,
        failed_count: uploadedPhotos.length,
        errors: [
          ...errors,
          `Database error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ],
      };
    }
  }

  return {
    success: false,
    uploaded_count: 0,
    failed_count: errors.length,
    errors,
  };
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
