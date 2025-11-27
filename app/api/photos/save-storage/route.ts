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
 * OPTIMIZED VERSION - Uses batch inserts for Vercel Hobby 10s timeout
 *
 * OLD: 15 photos × 3 DB calls = 45 operations (~10+ seconds)
 * NEW: 3 batch operations total (<1 second)
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

    // Prepare batch insert data
    const timestamp = new Date().toISOString();
    const photoInsertData = photos.map((photo) => ({
      user_id: user.id,
      name: photo.name.split(/[/\\]/).pop() || photo.name,
      file_url: photo.url,
      type: photo.type,
      size: photo.size,
      processing_status: 'uploaded',
      source: 'manual_upload',
      created_at: timestamp,
      updated_at: timestamp,
    }));

    // BATCH INSERT #1: Insert all photos at once
    console.log(`[Save Storage] Batch inserting ${photos.length} photos...`);
    const { data: insertedPhotos, error: batchInsertError } = await serviceSupabase
      .from('photos')
      .insert(photoInsertData)
      .select('id, name, file_url, type, size');

    if (batchInsertError) {
      console.error(`[Save Storage] Batch insert failed:`, batchInsertError);
      return NextResponse.json(
        { error: `Database error: ${batchInsertError.message}` },
        { status: 500 }
      );
    }

    if (!insertedPhotos || insertedPhotos.length === 0) {
      return NextResponse.json(
        { error: 'No photos were inserted' },
        { status: 500 }
      );
    }

    console.log(`[Save Storage] ✅ Batch inserted ${insertedPhotos.length} photos`);

    // Prepare batch queue data
    const queueInsertData = insertedPhotos.map((photo) => ({
      photo_id: photo.id,
      user_id: user.id,
      status: 'pending',
      priority: 0,
      retry_count: 0,
      max_retries: 3,
      created_at: timestamp,
      updated_at: timestamp,
    }));

    // BATCH INSERT #2: Add all photos to queue at once
    console.log(`[Save Storage] Batch queueing ${insertedPhotos.length} photos...`);
    const { error: batchQueueError } = await serviceSupabase
      .from('photo_processing_queue')
      .insert(queueInsertData);

    if (batchQueueError) {
      console.error(`[Save Storage] Batch queue insert failed:`, batchQueueError);
      // Don't fail the entire request - photos are already saved
    } else {
      console.log(`[Save Storage] ✅ Added ${insertedPhotos.length} photos to queue`);

      // BATCH UPDATE #3: Update all photo statuses at once
      const photoIds = insertedPhotos.map((p) => p.id);
      await serviceSupabase
        .from('photos')
        .update({ processing_status: 'queued' })
        .in('id', photoIds);

      console.log(`[Save Storage] ✅ Updated ${photoIds.length} photos to 'queued' status`);
    }

    return NextResponse.json({
      success: true,
      uploaded_count: insertedPhotos.length,
      failed_count: 0,
      photos: insertedPhotos,
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
