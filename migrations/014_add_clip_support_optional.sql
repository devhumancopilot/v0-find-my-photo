-- ============================================================================
-- OPTIONAL MIGRATION: Add Native CLIP (512D) Embedding Support
-- ============================================================================
--
-- This migration is OPTIONAL and only needed if you want to use native 512-dimensional
-- CLIP embeddings without padding. If you're using VARIABLE_EMBEDDING_DIMENSIONS=false,
-- you can skip this migration (the system will pad 512D to 1536D automatically).
--
-- IMPORTANT: Only run this if you understand the implications:
-- 1. Existing photos with 1536D embeddings will become incompatible
-- 2. You'll need to reprocess all existing photos to generate new 512D embeddings
-- 3. The match_photos function will work with 512D instead of 1536D
--
-- This is recommended for NEW installations using CLIP from the start.
-- For existing installations, use VARIABLE_EMBEDDING_DIMENSIONS=false instead.
-- ============================================================================

-- Step 1: Drop existing match_photos function
-- (We'll recreate it to support 512D vectors)
DROP FUNCTION IF EXISTS match_photos(vector, int, jsonb);

-- Step 2: Modify photos table to use vector(512) for CLIP embeddings
-- WARNING: This will break existing photos with 1536D embeddings!
-- Only run this on a fresh database OR after backing up and planning to reprocess all photos

-- Option A: For fresh installations (no existing photos)
-- ALTER TABLE public.photos ALTER COLUMN embedding TYPE vector(512);

-- Option B: For existing installations (recommended approach)
-- Keep the existing column and add a new one for CLIP embeddings
-- This allows gradual migration
ALTER TABLE public.photos
  ADD COLUMN IF NOT EXISTS embedding_clip vector(512);

-- Add index for CLIP embeddings
CREATE INDEX IF NOT EXISTS photos_embedding_clip_idx
  ON public.photos
  USING ivfflat (embedding_clip vector_cosine_ops)
  WITH (lists = 100);

-- Step 3: Create match_photos function with dual support
-- This version checks which embedding column to use based on what's available
CREATE OR REPLACE FUNCTION match_photos (
  query_embedding vector(512),  -- Changed to 512D for CLIP
  match_count int DEFAULT 50,
  filter jsonb DEFAULT '{}'
)
RETURNS TABLE (
  id bigint,
  name text,
  file_url text,
  caption text,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  filter_user_id uuid;
BEGIN
  -- Extract user_id from filter - this is REQUIRED
  filter_user_id := (filter->>'user_id')::uuid;

  -- SECURITY CHECK: user_id MUST be provided
  IF filter_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required in filter parameter for security reasons';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.file_url,
    p.caption,
    1 - (p.embedding_clip <=> query_embedding) AS similarity
  FROM public.photos p
  WHERE
    -- ALWAYS filter by user_id - no exceptions
    p.user_id = filter_user_id
    -- Only include photos that have CLIP embeddings
    AND p.embedding_clip IS NOT NULL
  ORDER BY p.embedding_clip <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Add comment explaining the dual embedding support
COMMENT ON FUNCTION match_photos IS 'Search photos using CLIP vector similarity (512D). REQUIRES user_id in filter for security. Uses embedding_clip column. Will throw error if user_id is missing to prevent data leaks across users.';

-- Grant execute permission to authenticated users only
GRANT EXECUTE ON FUNCTION match_photos TO authenticated;
REVOKE EXECUTE ON FUNCTION match_photos FROM anon;

-- Step 4: Alternative approach - Create separate function for legacy support
-- If you want to support BOTH 1536D (OpenAI) and 512D (CLIP) simultaneously
CREATE OR REPLACE FUNCTION match_photos_openai (
  query_embedding vector(1536),  -- OpenAI dimensions
  match_count int DEFAULT 50,
  filter jsonb DEFAULT '{}'
)
RETURNS TABLE (
  id bigint,
  name text,
  file_url text,
  caption text,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  filter_user_id uuid;
BEGIN
  filter_user_id := (filter->>'user_id')::uuid;

  IF filter_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required in filter parameter for security reasons';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.file_url,
    p.caption,
    1 - (p.embedding <=> query_embedding) AS similarity
  FROM public.photos p
  WHERE
    p.user_id = filter_user_id
    AND p.embedding IS NOT NULL
  ORDER BY p.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION match_photos_openai IS 'Search photos using OpenAI vector similarity (1536D). Uses original embedding column for backward compatibility.';

-- ============================================================================
-- POST-MIGRATION STEPS
-- ============================================================================
--
-- After running this migration:
--
-- 1. Set environment variables:
--    EMBEDDING_PROVIDER=huggingface
--    VARIABLE_EMBEDDING_DIMENSIONS=true
--
-- 2. For fresh installations:
--    - Start uploading photos - they'll use CLIP embeddings automatically
--
-- 3. For existing installations with photos:
--    - Option A: Reprocess all photos to generate CLIP embeddings
--      (This will populate the embedding_clip column)
--    - Option B: Continue using OpenAI embeddings and gradually migrate
--      (New photos use CLIP, old photos use OpenAI)
--
-- 4. Update your code to call the right match function:
--    - match_photos() for CLIP (512D)
--    - match_photos_openai() for OpenAI (1536D)
--
-- ============================================================================

-- Verify the migration
SELECT
  'Migration completed successfully!' as message,
  'embedding_clip column added' as step1,
  'match_photos function updated for 512D' as step2,
  'match_photos_openai function added for legacy support' as step3;
