/**
 * Database Service
 * Handles Supabase database operations for photos and albums
 */

import { createClient } from "@/lib/supabase/server"

export interface PhotoInsertData {
  name: string
  file_url: string
  type: string
  size: number
  caption: string
  embedding: number[]
  embedding_clip?: number[] // Optional: 512D CLIP embeddings
  user_id: string
  data?: string // Optional base64 data
  album_id?: number | null
}

export interface MatchedPhoto {
  id: number
  name: string
  file_url: string
  caption: string
  similarity: number
}

export interface MatchedPhotoHybrid extends MatchedPhoto {
  similarity_text: number
  similarity_clip: number
}

export interface AlbumData {
  album_title: string
  description?: string | null
  cover_image_url: string
  photos: string[]
  user_id: string
  photo_count: number
}

/**
 * Check if photo already exists in database
 * Returns the existing photo ID if found, null otherwise
 */
export async function checkPhotoExists(
  name: string,
  size: number,
  userId: string,
  supabaseClient?: any
): Promise<number | null> {
  try {
    const supabase = supabaseClient || (await createClient())

    const { data, error } = await supabase
      .from("photos")
      .select("id")
      .eq("name", name)
      .eq("size", size)
      .eq("user_id", userId)
      .maybeSingle()

    if (error) {
      console.error("Error checking for duplicate photo:", error)
      return null
    }

    return data?.id || null
  } catch (error) {
    console.error("Error checking photo existence:", error)
    return null
  }
}

/**
 * Insert photo into database
 * Returns the inserted photo ID
 */
export async function insertPhoto(photoData: PhotoInsertData, supabaseClient?: any): Promise<number> {
  try {
    const supabase = supabaseClient || (await createClient())

    // Check for duplicates first
    const existingPhotoId = await checkPhotoExists(photoData.name, photoData.size, photoData.user_id, supabase)
    if (existingPhotoId) {
      throw new Error(`DUPLICATE_PHOTO:${existingPhotoId}`)
    }

    // Check if we should store base64 data
    const storeBase64 = process.env.STORE_BASE64_IN_DB === "true"

    const insertData: any = {
      name: photoData.name,
      file_url: photoData.file_url,
      type: photoData.type,
      size: photoData.size,
      caption: photoData.caption,
      embedding: JSON.stringify(photoData.embedding), // pgvector expects string format
      user_id: photoData.user_id,
      album_id: photoData.album_id || null,
    }

    // Add CLIP embeddings if provided (512D)
    if (photoData.embedding_clip) {
      insertData.embedding_clip = JSON.stringify(photoData.embedding_clip)
      console.log(`[Database] Saving CLIP embedding: ${photoData.embedding_clip.length}D`)
    }

    // Only include base64 data if configured
    if (storeBase64 && photoData.data) {
      insertData.data = photoData.data
    }

    const { data, error } = await supabase.from("photos").insert(insertData).select("id").single()

    if (error) {
      throw new Error(`Database insert failed: ${error.message}`)
    }

    if (!data?.id) {
      throw new Error("No ID returned from insert")
    }

    return data.id
  } catch (error) {
    console.error("Error inserting photo:", error)
    throw error
  }
}

/**
 * Search photos using vector similarity
 * Uses Supabase RPC function match_photos
 */
export async function matchPhotos(
  embedding: number[],
  userId: string,
  matchCount: number = 20,
  supabaseClient?: any
): Promise<MatchedPhoto[]> {
  try {
    // Use provided client or create default one
    const supabase = supabaseClient || await createClient()

    // Check current auth state (for logging purposes)
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    const isServiceRole = !currentUser && supabaseClient

    console.log(`[Database] Current authenticated user: ${currentUser?.id || 'NONE'}`)
    console.log(`[Database] Searching for user_id: ${userId}`)
    console.log(`[Database] User IDs match: ${currentUser?.id === userId}`)
    console.log(`[Database] Using service role: ${isServiceRole}`)

    // Call match_photos RPC (now accessible by service_role too)
    console.log(`[Database] Calling match_photos RPC:`, {
      embedding_length: embedding.length,
      filter: { user_id: userId },
      match_count: matchCount,
    })

    const { data, error } = await supabase.rpc("match_photos", {
      query_embedding: embedding,
      match_count: matchCount,
      filter: { user_id: userId },
    })

    if (error) {
      console.error(`[Database] match_photos RPC error:`, error)
      console.error(`[Database] Full error details:`, JSON.stringify(error, null, 2))
      throw new Error(`Vector search failed: ${error.message}`)
    }

    console.log(`[Database] match_photos returned ${data?.length || 0} results`)

    // Log detailed results
    if (data && data.length > 0) {
      console.log(`[Database] Results breakdown:`)
      const asMatchedPhotos = data as MatchedPhoto[]
      asMatchedPhotos.slice(0, 5).forEach((photo, idx) => {
        console.log(`[Database]   ${idx + 1}. ${photo.name} - ${(photo.similarity * 100).toFixed(2)}% similarity`)
      })
      if (data.length > 5) {
        console.log(`[Database]   ... and ${data.length - 5} more results`)
      }
    } else {
      console.log(`[Database] ⚠️ No results returned from match_photos`)
    }

    return (data || []) as MatchedPhoto[]
  } catch (error) {
    console.error("Error matching photos:", error)
    throw new Error(`Failed to match photos: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

/**
 * Search photos using hybrid vector similarity (BOTH text and image embeddings)
 * Combines OpenAI 1536D (caption) and CLIP 512D (image) for better accuracy
 *
 * @param embeddingText - 1536D OpenAI text embedding
 * @param embeddingClip - 512D CLIP embedding
 * @param userId - User ID to filter by
 * @param matchCount - Number of results to return
 * @param weightText - Weight for text similarity (default 0.5)
 * @param weightClip - Weight for CLIP similarity (default 0.5)
 * @returns Array of matched photos with combined and individual similarity scores
 */
export async function matchPhotosHybrid(
  embeddingText: number[],
  embeddingClip: number[],
  userId: string,
  matchCount: number = 20,
  weightText: number = 0.5,
  weightClip: number = 0.5,
  supabaseClient?: any
): Promise<MatchedPhotoHybrid[]> {
  try {
    const supabase = supabaseClient || await createClient()

    // Check current auth state (for logging purposes)
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    const isServiceRole = !currentUser && supabaseClient

    console.log(`[Database][HYBRID] Current authenticated user: ${currentUser?.id || 'NONE'}`)
    console.log(`[Database][HYBRID] Searching for user_id: ${userId}`)
    console.log(`[Database][HYBRID] User IDs match: ${currentUser?.id === userId}`)
    console.log(`[Database][HYBRID] Using service role: ${isServiceRole}`)

    console.log(`[Database][HYBRID] Calling match_photos_hybrid RPC:`, {
      embedding_text_length: embeddingText.length,
      embedding_clip_length: embeddingClip.length,
      filter: { user_id: userId },
      match_count: matchCount,
      weights: { text: weightText, clip: weightClip }
    })

    const { data, error } = await supabase.rpc("match_photos_hybrid", {
      query_embedding_text: embeddingText,
      query_embedding_clip: embeddingClip,
      match_count: matchCount,
      filter: { user_id: userId },
      weight_text: weightText,
      weight_clip: weightClip,
    })

    if (error) {
      console.error(`[Database][HYBRID] match_photos_hybrid RPC error:`, error)
      console.error(`[Database][HYBRID] Full error details:`, JSON.stringify(error, null, 2))
      throw new Error(`Hybrid vector search failed: ${error.message}`)
    }

    console.log(`[Database][HYBRID] match_photos_hybrid returned ${data?.length || 0} results`)

    // Log detailed results
    if (data && data.length > 0) {
      console.log(`[Database][HYBRID] Results breakdown:`)
      const asMatchedPhotos = data as MatchedPhotoHybrid[]
      asMatchedPhotos.slice(0, 5).forEach((photo, idx) => {
        console.log(`[Database][HYBRID]   ${idx + 1}. ${photo.name}`)
        console.log(`[Database][HYBRID]      Combined: ${(photo.similarity * 100).toFixed(2)}%`)
        console.log(`[Database][HYBRID]      Text: ${(photo.similarity_text * 100).toFixed(2)}%, CLIP: ${(photo.similarity_clip * 100).toFixed(2)}%`)
      })
      if (data.length > 5) {
        console.log(`[Database][HYBRID]   ... and ${data.length - 5} more results`)
      }
    } else {
      console.log(`[Database][HYBRID] ⚠️ No results returned from match_photos_hybrid`)
    }

    return (data || []) as MatchedPhotoHybrid[]
  } catch (error) {
    console.error("Error in hybrid photo matching:", error)
    throw new Error(`Failed to match photos (hybrid): ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

/**
 * Create album and link photos
 * Returns the created album ID
 */
export async function createAlbum(albumData: AlbumData, supabaseClient?: any): Promise<number> {
  try {
    const supabase = supabaseClient || (await createClient())

    const insertData = {
      album_title: albumData.album_title,
      description: albumData.description || null,
      cover_image_url: albumData.cover_image_url,
      photos: albumData.photos,
      user_id: albumData.user_id,
      photo_count: albumData.photo_count,
      status: "active",
      processing_status: "completed",
    }

    const { data, error } = await supabase.from("albums").insert(insertData).select("id").single()

    if (error) {
      throw new Error(`Album creation failed: ${error.message}`)
    }

    if (!data?.id) {
      throw new Error("No album ID returned from insert")
    }

    return data.id
  } catch (error) {
    console.error("Error creating album:", error)
    throw new Error(`Failed to create album: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

/**
 * Get photo by ID
 * Used to retrieve cover photo URL
 */
export async function getPhotoById(photoId: string, userId: string, supabaseClient?: any): Promise<{ file_url: string } | null> {
  try {
    const supabase = supabaseClient || (await createClient())

    const { data, error } = await supabase
      .from("photos")
      .select("file_url")
      .eq("id", photoId)
      .eq("user_id", userId)
      .single()

    if (error) {
      console.error("Error fetching photo:", error)
      return null
    }

    return data
  } catch (error) {
    console.error("Error getting photo by ID:", error)
    return null
  }
}

// ============================================================================
// FACE PROFILES OPERATIONS
// ============================================================================

export interface FaceProfileInsertData {
  photo_id: number
  user_id: string
  face_embedding: number[]
  face_name?: string | null
  bbox_x: number
  bbox_y: number
  bbox_width: number
  bbox_height: number
  detection_confidence: number
  metadata?: Record<string, any>
}

export interface FaceProfile {
  id: number
  photo_id: number
  user_id: string
  face_name: string | null
  bbox_x: number
  bbox_y: number
  bbox_width: number
  bbox_height: number
  detection_confidence: number
  metadata: Record<string, any> | null
  created_at: string
  updated_at: string
  photos?: {
    id: number
    name: string
    file_url: string
    thumbnail_url: string | null
  }
}

export interface MatchedFace {
  id: number
  photo_id: number
  face_name: string
  similarity: number
}

/**
 * Insert face profile into database
 * Returns the inserted face profile ID
 */
export async function insertFaceProfile(data: FaceProfileInsertData, supabaseClient?: any): Promise<number> {
  try {
    const supabase = supabaseClient || (await createClient())

    const insertData = {
      photo_id: data.photo_id,
      user_id: data.user_id,
      face_embedding: JSON.stringify(data.face_embedding), // pgvector expects string format
      face_name: data.face_name || null,
      bbox_x: data.bbox_x,
      bbox_y: data.bbox_y,
      bbox_width: data.bbox_width,
      bbox_height: data.bbox_height,
      detection_confidence: data.detection_confidence,
      metadata: data.metadata || null,
    }

    console.log("[Database] Inserting face profile:", {
      photo_id: insertData.photo_id,
      user_id: insertData.user_id,
      face_name: insertData.face_name,
      bbox: { x: insertData.bbox_x, y: insertData.bbox_y, w: insertData.bbox_width, h: insertData.bbox_height },
      confidence: insertData.detection_confidence,
      embedding_length: data.face_embedding.length,
    })

    const { data: result, error } = await supabase.from("face_profiles").insert(insertData).select("id").single()

    if (error) {
      console.error("[Database] Face profile insert error:", error)
      throw new Error(`Failed to insert face profile: ${error.message}`)
    }

    if (!result?.id) {
      console.error("[Database] No ID returned from face profile insert")
      throw new Error("No ID returned from face profile insert")
    }

    console.log("[Database] Face profile inserted successfully with ID:", result.id)
    return result.id
  } catch (error) {
    console.error("[Database] Error inserting face profile:", error)
    throw new Error(`Failed to insert face profile: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

/**
 * Find matching face profiles using vector similarity
 * Uses Supabase RPC function match_faces
 *
 * @param embedding - Face embedding to match (128D)
 * @param userId - User ID to filter by
 * @param threshold - Similarity threshold (0.4 = 60% similar with cosine)
 * @returns Array of matched faces with similarity scores
 */
export async function matchFaces(
  embedding: number[],
  userId: string,
  threshold: number = 0.4,
  supabaseClient?: any
): Promise<MatchedFace[]> {
  try {
    const supabase = supabaseClient || (await createClient())

    const { data, error } = await supabase.rpc("match_faces", {
      query_embedding: JSON.stringify(embedding),
      match_user_id: userId,
      similarity_threshold: threshold,
      match_limit: 1, // Return only best match
    })

    if (error) {
      throw new Error(`Face matching failed: ${error.message}`)
    }

    return (data || []) as MatchedFace[]
  } catch (error) {
    console.error("Error matching faces:", error)
    throw new Error(`Failed to match faces: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

/**
 * Update face name for a single profile
 *
 * @param faceProfileId - Face profile ID
 * @param faceName - New face name
 * @param userId - User ID (for security)
 */
export async function updateFaceName(faceProfileId: number, faceName: string, userId: string): Promise<void> {
  try {
    const supabase = await createClient()

    const { error } = await supabase
      .from("face_profiles")
      .update({ face_name: faceName })
      .eq("id", faceProfileId)
      .eq("user_id", userId)

    if (error) {
      throw new Error(`Failed to update face name: ${error.message}`)
    }
  } catch (error) {
    console.error("Error updating face name:", error)
    throw new Error(`Failed to update face name: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

/**
 * Bulk update face names for multiple profiles
 *
 * @param faceProfileIds - Array of face profile IDs
 * @param faceName - New face name to assign
 * @param userId - User ID (for security)
 * @returns Number of profiles updated
 */
export async function bulkUpdateFaceNames(
  faceProfileIds: number[],
  faceName: string,
  userId: string
): Promise<number> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase.rpc("bulk_update_face_names", {
      p_face_ids: faceProfileIds,
      p_face_name: faceName,
      p_user_id: userId,
    })

    if (error) {
      throw new Error(`Bulk update failed: ${error.message}`)
    }

    return data as number
  } catch (error) {
    console.error("Error bulk updating face names:", error)
    throw new Error(`Failed to bulk update face names: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

/**
 * Get all face profiles for a user
 *
 * @param userId - User ID
 * @param includeUnnamed - Include faces with NULL face_name (default: true)
 * @returns Array of face profiles with photo information
 */
export async function getFaceProfiles(userId: string, includeUnnamed: boolean = true): Promise<FaceProfile[]> {
  try {
    const supabase = await createClient()

    let query = supabase
      .from("face_profiles")
      .select(
        `
        id,
        photo_id,
        user_id,
        face_name,
        bbox_x,
        bbox_y,
        bbox_width,
        bbox_height,
        detection_confidence,
        metadata,
        created_at,
        updated_at,
        photos (
          id,
          name,
          file_url,
          thumbnail_url
        )
      `
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    // Filter out unnamed faces if requested
    if (!includeUnnamed) {
      query = query.not("face_name", "is", null)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to fetch face profiles: ${error.message}`)
    }

    return (data || []) as FaceProfile[]
  } catch (error) {
    console.error("Error getting face profiles:", error)
    throw new Error(`Failed to get face profiles: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

/**
 * Get face profiles grouped by face_name
 * Uses Supabase RPC function
 *
 * @param userId - User ID
 * @returns Grouped face profiles with counts
 */
export async function getFaceProfilesGrouped(userId: string): Promise<
  Array<{
    face_name: string
    face_count: number
    face_ids: number[]
    sample_photo_url: string | null
    latest_detection: string
  }>
> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase.rpc("get_face_profiles_grouped", {
      p_user_id: userId,
    })

    if (error) {
      throw new Error(`Failed to get grouped face profiles: ${error.message}`)
    }

    return data || []
  } catch (error) {
    console.error("Error getting grouped face profiles:", error)
    throw new Error(
      `Failed to get grouped face profiles: ${error instanceof Error ? error.message : "Unknown error"}`
    )
  }
}

/**
 * Delete face profile
 *
 * @param faceProfileId - Face profile ID to delete
 * @param userId - User ID (for security)
 */
export async function deleteFaceProfile(faceProfileId: number, userId: string): Promise<void> {
  try {
    const supabase = await createClient()

    const { error } = await supabase.from("face_profiles").delete().eq("id", faceProfileId).eq("user_id", userId)

    if (error) {
      throw new Error(`Failed to delete face profile: ${error.message}`)
    }
  } catch (error) {
    console.error("Error deleting face profile:", error)
    throw new Error(`Failed to delete face profile: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

/**
 * Get face profiles for a specific photo
 *
 * @param photoId - Photo ID
 * @param userId - User ID (for security)
 * @returns Array of face profiles for the photo
 */
export async function getFaceProfilesByPhoto(photoId: number, userId: string): Promise<FaceProfile[]> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("face_profiles")
      .select("*")
      .eq("photo_id", photoId)
      .eq("user_id", userId)
      .order("bbox_x", { ascending: true })

    if (error) {
      throw new Error(`Failed to fetch face profiles: ${error.message}`)
    }

    return (data || []) as FaceProfile[]
  } catch (error) {
    console.error("Error getting face profiles by photo:", error)
    throw new Error(`Failed to get face profiles by photo: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}
