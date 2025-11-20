import { useState } from 'react';
import { upload } from '@vercel/blob/client';

interface UploadProgress {
  filename: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
  url?: string;
}

interface UseVercelBlobUploadOptions {
  onProgress?: (progress: UploadProgress[]) => void;
  onComplete?: (results: UploadProgress[]) => void;
  onError?: (error: Error) => void;
}

export function useVercelBlobUpload(options?: UseVercelBlobUploadOptions) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);

  const uploadFiles = async (files: File[]) => {
    setIsUploading(true);

    // Initialize progress tracking
    const initialProgress: UploadProgress[] = files.map((file) => ({
      filename: file.name,
      progress: 0,
      status: 'pending',
    }));

    setUploadProgress(initialProgress);
    options?.onProgress?.(initialProgress);

    const results: UploadProgress[] = [];

    // Upload files sequentially to avoid overwhelming the server
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      try {
        // Update status to uploading
        const updatedProgress = [...results, {
          filename: file.name,
          progress: 0,
          status: 'uploading' as const
        }];
        setUploadProgress(updatedProgress);
        options?.onProgress?.(updatedProgress);

        console.log(`[Vercel Blob Upload] Uploading ${file.name}...`);

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

        console.log(`[Vercel Blob Upload] Uploaded ${file.name} successfully:`, blob.url);

        // Mark as completed
        const completedItem: UploadProgress = {
          filename: file.name,
          progress: 100,
          status: 'completed',
          url: blob.url,
        };

        results.push(completedItem);
        setUploadProgress([...results]);
        options?.onProgress?.([...results]);

      } catch (error) {
        console.error(`[Vercel Blob Upload] Failed to upload ${file.name}:`, error);

        const errorItem: UploadProgress = {
          filename: file.name,
          progress: 0,
          status: 'error',
          error: error instanceof Error ? error.message : 'Upload failed',
        };

        results.push(errorItem);
        setUploadProgress([...results]);
        options?.onProgress?.([...results]);
      }
    }

    setIsUploading(false);
    options?.onComplete?.(results);

    return results;
  };

  const reset = () => {
    setUploadProgress([]);
    setIsUploading(false);
  };

  return {
    uploadFiles,
    isUploading,
    uploadProgress,
    reset,
  };
}
