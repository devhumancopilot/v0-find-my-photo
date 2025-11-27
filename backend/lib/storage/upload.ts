/**
 * Supabase Storage Upload Utilities
 * Handles file uploads to Supabase Storage buckets
 */

import { createClient } from '@/lib/supabase/server'

/**
 * Upload PDF to Supabase Storage
 */
export async function uploadPDFToStorage(
  pdfBuffer: Buffer,
  fileName: string,
  bucketName: string = 'print-files'
): Promise<{ publicUrl: string; error?: string }> {
  try {
    const supabase = await createClient()

    // Ensure bucket exists (create if it doesn't)
    const { data: buckets } = await supabase.storage.listBuckets()
    const bucketExists = buckets?.some((b) => b.name === bucketName)

    if (!bucketExists) {
      console.log(`[Storage] Creating bucket: ${bucketName}`)
      const { error: createError } = await supabase.storage.createBucket(bucketName, {
        public: true,
        fileSizeLimit: 52428800, // 50MB limit
      })

      if (createError) {
        console.error('[Storage] Error creating bucket:', createError)
        return { publicUrl: '', error: createError.message }
      }
    }

    // Upload file
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(fileName, pdfBuffer, {
        contentType: 'application/pdf',
        cacheControl: '3600',
        upsert: true, // Replace if exists
      })

    if (uploadError) {
      console.error('[Storage] Upload error:', uploadError)
      return { publicUrl: '', error: uploadError.message }
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from(bucketName).getPublicUrl(fileName)

    return { publicUrl }
  } catch (error) {
    console.error('[Storage] Unexpected error:', error)
    return {
      publicUrl: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Delete file from storage
 */
export async function deleteFileFromStorage(
  fileName: string,
  bucketName: string = 'print-files'
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    const { error } = await supabase.storage.from(bucketName).remove([fileName])

    if (error) {
      console.error('[Storage] Delete error:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('[Storage] Unexpected error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Generate unique filename for PDF
 */
export function generatePDFFileName(albumId: number | string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  return `album-${albumId}-${timestamp}-${random}.pdf`
}
