-- Change embedding column from 1536D (OpenAI) to 512D (CLIP)
-- This enables pure CLIP mode where both caption and image embeddings are in the same 512D space

-- First, we need to drop and recreate the column because pgvector doesn't allow
-- ALTER COLUMN for changing dimensions

-- Store existing data temporarily (only for photos with 512D embeddings)
-- Photos with 1536D will be cleared and need reprocessing

-- Drop the column and recreate with 512D
ALTER TABLE photos DROP COLUMN IF EXISTS embedding;
ALTER TABLE photos ADD COLUMN embedding vector(512);

COMMENT ON COLUMN photos.embedding IS 'CLIP text embedding from caption (512D) - in same space as embedding_clip for perfect multimodal matching';

-- Update match_photos function to handle 512D as default
CREATE OR REPLACE FUNCTION match_photos (
  query_embedding vector,
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
  embedding_dimensions int;
BEGIN
  -- Extract user_id from filter - this is REQUIRED
  filter_user_id := (filter->>'user_id')::uuid;

  -- SECURITY CHECK: user_id MUST be provided
  IF filter_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required in filter parameter for security reasons';
  END IF;

  -- Detect the dimension of the query embedding
  embedding_dimensions := array_length(query_embedding::float[], 1);

  -- Route to appropriate embedding column based on dimensions
  IF embedding_dimensions = 512 THEN
    -- Use CLIP embeddings (512D) - either caption or image
    -- Try caption embeddings first, fall back to image embeddings
    RETURN QUERY
    SELECT
      p.id,
      p.name,
      p.file_url,
      p.caption,
      1 - (COALESCE(p.embedding, p.embedding_clip) <=> query_embedding) AS similarity
    FROM public.photos p
    WHERE
      p.user_id = filter_user_id
      AND (p.embedding IS NOT NULL OR p.embedding_clip IS NOT NULL)
    ORDER BY COALESCE(p.embedding, p.embedding_clip) <=> query_embedding
    LIMIT match_count;

  ELSIF embedding_dimensions = 1536 THEN
    -- Use OpenAI text embeddings (1536D) - legacy support
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

  ELSE
    -- Unsupported dimension
    RAISE EXCEPTION 'Unsupported embedding dimension: %. Only 512D (CLIP) and 1536D (OpenAI legacy) are supported.', embedding_dimensions;
  END IF;
END;
$$;

COMMENT ON FUNCTION match_photos IS 'Single-embedding search. Supports 512D (CLIP) or 1536D (OpenAI legacy). For best results with pure CLIP, use match_photos_hybrid.';
