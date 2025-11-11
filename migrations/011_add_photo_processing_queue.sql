-- ============================================================================
-- Migration: Add Photo Processing Queue
-- Description: Creates a queue system for background photo processing
--              to handle bulk uploads without overwhelming server resources
-- Date: 2025-01-15
-- ============================================================================

-- ============================================================================
-- STEP 1: Create photo_processing_queue table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.photo_processing_queue (
  id BIGSERIAL PRIMARY KEY,
  photo_id BIGINT NOT NULL REFERENCES public.photos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  priority INTEGER DEFAULT 0, -- Higher number = higher priority
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  error_message TEXT,
  processing_started_at TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.photo_processing_queue IS 'Queue for background photo processing (captions, face detection, etc.)';
COMMENT ON COLUMN public.photo_processing_queue.photo_id IS 'Reference to the uploaded photo';
COMMENT ON COLUMN public.photo_processing_queue.status IS 'Current processing status';
COMMENT ON COLUMN public.photo_processing_queue.priority IS 'Processing priority (higher number = higher priority)';
COMMENT ON COLUMN public.photo_processing_queue.retry_count IS 'Number of processing attempts';
COMMENT ON COLUMN public.photo_processing_queue.error_message IS 'Error message if processing failed';

-- ============================================================================
-- STEP 2: Add processing_status to photos table
-- ============================================================================

-- Add processing_status column to track photo processing state
ALTER TABLE public.photos
ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'uploaded' CHECK (
  processing_status IN ('uploaded', 'queued', 'processing', 'completed', 'failed')
);

COMMENT ON COLUMN public.photos.processing_status IS 'Current processing status of the photo';

-- ============================================================================
-- STEP 3: Create indexes for performance
-- ============================================================================

-- Index for fetching pending items
CREATE INDEX IF NOT EXISTS idx_photo_queue_status_priority
  ON public.photo_processing_queue(status, priority DESC, created_at ASC)
  WHERE status = 'pending';

-- Index for user queries
CREATE INDEX IF NOT EXISTS idx_photo_queue_user_id
  ON public.photo_processing_queue(user_id);

-- Index for photo queries
CREATE INDEX IF NOT EXISTS idx_photo_queue_photo_id
  ON public.photo_processing_queue(photo_id);

-- Index for status queries
CREATE INDEX IF NOT EXISTS idx_photo_queue_status
  ON public.photo_processing_queue(status);

-- Index for processing_status on photos table
CREATE INDEX IF NOT EXISTS idx_photos_processing_status
  ON public.photos(processing_status)
  WHERE processing_status IN ('queued', 'processing');

-- ============================================================================
-- STEP 4: Create trigger for updated_at
-- ============================================================================

-- Apply trigger to photo_processing_queue table
DROP TRIGGER IF EXISTS set_photo_queue_updated_at ON public.photo_processing_queue;
CREATE TRIGGER set_photo_queue_updated_at
  BEFORE UPDATE ON public.photo_processing_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- STEP 5: Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS
ALTER TABLE public.photo_processing_queue ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their own queue items" ON public.photo_processing_queue;
DROP POLICY IF EXISTS "Users can insert their own queue items" ON public.photo_processing_queue;
DROP POLICY IF EXISTS "Users can update their own queue items" ON public.photo_processing_queue;
DROP POLICY IF EXISTS "Users can delete their own queue items" ON public.photo_processing_queue;

-- Allow users to view their own queue items
CREATE POLICY "Users can view their own queue items"
  ON public.photo_processing_queue
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow users to insert their own queue items
CREATE POLICY "Users can insert their own queue items"
  ON public.photo_processing_queue
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own queue items (for retry, etc.)
CREATE POLICY "Users can update their own queue items"
  ON public.photo_processing_queue
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own queue items
CREATE POLICY "Users can delete their own queue items"
  ON public.photo_processing_queue
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- STEP 6: Helper functions
-- ============================================================================

-- Function to get pending queue count for a user
CREATE OR REPLACE FUNCTION public.get_pending_queue_count(user_uuid UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM public.photo_processing_queue
    WHERE user_id = user_uuid AND status = 'pending'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_pending_queue_count IS 'Returns count of pending queue items for a user';

-- Function to get next batch of photos to process
CREATE OR REPLACE FUNCTION public.get_next_processing_batch(
  batch_size INTEGER DEFAULT 10,
  user_uuid UUID DEFAULT NULL
)
RETURNS SETOF public.photo_processing_queue AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.photo_processing_queue
  WHERE
    status = 'pending'
    AND retry_count < max_retries
    AND (user_uuid IS NULL OR user_id = user_uuid)
  ORDER BY priority DESC, created_at ASC
  LIMIT batch_size
  FOR UPDATE SKIP LOCKED; -- Prevent race conditions
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_next_processing_batch IS 'Gets next batch of photos to process with row locking';

-- Function to mark queue item as processing
CREATE OR REPLACE FUNCTION public.mark_queue_processing(queue_id BIGINT)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.photo_processing_queue
  SET
    status = 'processing',
    processing_started_at = NOW()
  WHERE id = queue_id AND status = 'pending';

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.mark_queue_processing IS 'Marks a queue item as currently processing';

-- Function to mark queue item as completed
CREATE OR REPLACE FUNCTION public.mark_queue_completed(queue_id BIGINT)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.photo_processing_queue
  SET
    status = 'completed',
    processing_completed_at = NOW()
  WHERE id = queue_id;

  -- Also update photo status
  UPDATE public.photos p
  SET processing_status = 'completed'
  FROM public.photo_processing_queue q
  WHERE q.id = queue_id AND p.id = q.photo_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.mark_queue_completed IS 'Marks a queue item as completed and updates photo status';

-- Function to mark queue item as failed
CREATE OR REPLACE FUNCTION public.mark_queue_failed(
  queue_id BIGINT,
  error_msg TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  current_retry_count INTEGER;
  max_retry_count INTEGER;
BEGIN
  -- Get current retry count
  SELECT retry_count, max_retries INTO current_retry_count, max_retry_count
  FROM public.photo_processing_queue
  WHERE id = queue_id;

  -- Increment retry count
  current_retry_count := current_retry_count + 1;

  -- If max retries reached, mark as failed permanently
  IF current_retry_count >= max_retry_count THEN
    UPDATE public.photo_processing_queue
    SET
      status = 'failed',
      retry_count = current_retry_count,
      error_message = error_msg,
      processing_completed_at = NOW()
    WHERE id = queue_id;

    -- Update photo status to failed
    UPDATE public.photos p
    SET processing_status = 'failed'
    FROM public.photo_processing_queue q
    WHERE q.id = queue_id AND p.id = q.photo_id;
  ELSE
    -- Reset to pending for retry
    UPDATE public.photo_processing_queue
    SET
      status = 'pending',
      retry_count = current_retry_count,
      error_message = error_msg,
      processing_started_at = NULL
    WHERE id = queue_id;
  END IF;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.mark_queue_failed IS 'Marks a queue item as failed and handles retry logic';

-- ============================================================================
-- STEP 7: Create view for queue statistics
-- ============================================================================

CREATE OR REPLACE VIEW public.queue_statistics AS
SELECT
  user_id,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
  COUNT(*) FILTER (WHERE status = 'processing') as processing_count,
  COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
  COUNT(*) as total_count,
  MIN(created_at) FILTER (WHERE status = 'pending') as oldest_pending,
  MAX(created_at) as latest_created
FROM public.photo_processing_queue
GROUP BY user_id;

COMMENT ON VIEW public.queue_statistics IS 'Aggregate statistics for photo processing queue per user';

-- ============================================================================
-- COMPLETED!
-- ============================================================================

-- Summary of changes:
-- ✅ Created photo_processing_queue table with retry logic
-- ✅ Added processing_status column to photos table
-- ✅ Created indexes for performance optimization
-- ✅ Set up RLS policies for user data isolation
-- ✅ Added helper functions for queue management
-- ✅ Created view for queue statistics

-- IMPORTANT NEXT STEPS:
-- 1. Run this migration on your Supabase database
-- 2. Update application code to use the new queue system
-- 3. Implement batch processing endpoint
-- 4. Test with bulk photo uploads

-- ============================================================================
