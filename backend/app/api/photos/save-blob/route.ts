import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface BlobPhotoData {
  name: string;
  url: string;
  size: number;
  type: string;
}

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
    const { photos } = (await req.json()) as { photos: BlobPhotoData[] };

    if (!photos || !Array.isArray(photos) || photos.length === 0) {
      return NextResponse.json({ error: 'No photos provided' }, { status: 400 });
    }

    console.log(`[Save Blob] Saving ${photos.length} photos for user ${user.id}`);

    const uploadedPhotos = [];
    const errors: string[] = [];

    // Create database records for each blob URL
    for (const photo of photos) {
      try {
        // Insert photo record
        const { data: insertedPhoto, error: dbError } = await supabase
          .from('photos')
          .insert({
            user_id: user.id,
            name: photo.name,
            file_url: photo.url,
            type: photo.type,
            size: photo.size,
            processing_status: 'uploaded',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select('id, name, file_url, type, size')
          .single();

        if (dbError) {
          console.error(`[Save Blob] Database error for ${photo.name}:`, dbError);
          errors.push(`${photo.name}: Database error - ${dbError.message}`);
          continue;
        }

        console.log(`[Save Blob] Saved photo ${insertedPhoto.id}: ${photo.name}`);

        // Add to processing queue
        const { error: queueError } = await supabase
          .from('photo_processing_queue')
          .insert({
            photo_id: insertedPhoto.id,
            user_id: user.id,
            status: 'pending',
            priority: 1,
            retry_count: 0,
            max_retries: 3,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (queueError) {
          console.error(`[Save Blob] Queue error for photo ${insertedPhoto.id}:`, queueError);
          // Don't fail the upload if queue insertion fails, just log it
        } else {
          console.log(`[Save Blob] Added photo ${insertedPhoto.id} to processing queue`);
        }

        uploadedPhotos.push(insertedPhoto);
      } catch (error) {
        console.error(`[Save Blob] Error processing ${photo.name}:`, error);
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
    console.error('[Save Blob] Unexpected error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to save photos',
      },
      { status: 500 }
    );
  }
}
