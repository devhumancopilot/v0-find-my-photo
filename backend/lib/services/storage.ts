/**
 * Supabase Storage Service
 * Handles photo uploads to Supabase Storage bucket
 */

/**
 * Upload photo to Supabase Storage
 * Matches N8N logic exactly: uploads/{sanitized_filename}{sanitized_user_id}
 */
export async function uploadPhotoToStorage(
  base64: string,
  userId: string,
  filename: string,
  mimeType: string
): Promise<string> {
  try {
    // Sanitize filename and userId (match N8N logic)
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9-_]/g, "_")
    const sanitizedUserId = userId.replace(/[^a-zA-Z0-9-_]/g, "_")

    // Build storage path: uploads/{sanitized_name}{sanitized_user_id}
    const storagePath = `uploads/${sanitizedFilename}${sanitizedUserId}`

    // Convert base64 to buffer
    const buffer = Buffer.from(base64, "base64")

    // Upload to Supabase Storage via HTTP POST
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables")
    }

    const uploadUrl = `${supabaseUrl}/storage/v1/object/photos/${storagePath}`

    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        apikey: supabaseServiceKey,
        authorization: `Bearer ${supabaseServiceKey}`,
        "content-type": "application/octet-stream",
      },
      body: buffer,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Storage upload failed (${response.status}): ${errorText}`)
    }

    // Build public URL
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/photos/${storagePath}`

    return publicUrl
  } catch (error) {
    console.error("Error uploading to Supabase Storage:", error)
    throw new Error(`Failed to upload to storage: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}
