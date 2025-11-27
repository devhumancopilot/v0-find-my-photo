import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

interface StoragePhotoData {
  name: string;
  url: string;
  size: number;
  type: string;
}

/**
 * Save photos that were uploaded directly to Supabase Storage (client-side)
 * This is similar to save-blob but for Supabase Storage URLs
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const { photos } = (await req.json()) as { photos: StoragePhotoData[] };

    if (!photos || !Array.isArray(photos) || photos.length === 0) {
      return NextResponse.json({ error: 'No photos provided' }, { status: 400 });
    }

    console.log(`[Save Storage] Saving ${photos.length} photos for user ${user.id}`);

    // Use service role client for database operations
    const serviceSupabase = createServiceRoleClient();

    const uploadedPhotos = [];
    const errors: string[] = [];

    // Create database records for each storage URL
    for (const photo of photos) {
      try {
        // Extract clean filename
        const cleanFileName = photo.name.split(/[/\\]/).pop() || photo.name;

        // Insert photo record with processing_status = 'uploaded'
        const { data: insertedPhoto, error: dbError } = await serviceSupabase
          .from('photos')
          .insert({
            user_id: user.id,
            name: cleanFileName,
            file_url: photo.url,
            type: photo.type,
            size: photo.size,
            processing_status: 'uploaded',
            source: 'manual_upload',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select('id, name, file_url, type, size')
          .single();

        if (dbError) {
          console.error(`[Save Storage] Database error for ${photo.name}:`, dbError);
          errors.push(`${photo.name}: Database error - ${dbError.message}`);
          continue;
        }

        console.log(`[Save Storage] Saved photo ${insertedPhoto.id}: ${photo.name}`);

        // Add to processing queue
        const { error: queueError } = await serviceSupabase
          .from('photo_processing_queue')
          .insert({
            photo_id: insertedPhoto.id,
            user_id: user.id,
            status: 'pending',
            priority: 0,
            retry_count: 0,
            max_retries: 3,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (queueError) {
          console.error(`[Save Storage] Queue error for photo ${insertedPhoto.id}:`, queueError);
          // Don't fail the upload if queue insertion fails, just log it
        } else {
          console.log(`[Save Storage] Added photo ${insertedPhoto.id} to processing queue`);

          // Update photo status to 'queued'
          await serviceSupabase
            .from('photos')
            .update({ processing_status: 'queued' })
            .eq('id', insertedPhoto.id);
        }

        uploadedPhotos.push(insertedPhoto);
      } catch (error) {
        console.error(`[Save Storage] Error processing ${photo.name}:`, error);
        errors.push(
          `${photo.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    return NextResponse.json({
      success: true,
      uploaded_count: uploadedPhotos.length,
      failed_count: errors.length,
      photos: uploadedPhotos,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[Save Storage] Unexpected error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to save photos',
      },
      { status: 500 }
    );
  }
}
