-- Fix match_photos function to properly filter by user_id
-- The previous version used JSONB containment which doesn't work correctly
-- This version returns ALL matches (including low similarity) for debugging

-- Drop the old function
DROP FUNCTION IF EXISTS match_photos(vector, int, jsonb);

-- Create improved function with proper user_id filtering
-- Returns ALL matches regardless of similarity score (for debugging)
-- SECURITY DEFINER allows function to bypass RLS policies
CREATE OR REPLACE FUNCTION match_photos (
  query_embedding vector(1536),
  match_count int DEFAULT 50,  -- Increased default for debugging
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
  -- Extract user_id from filter if present
  filter_user_id := (filter->>'user_id')::uuid;

  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.file_url,
    p.caption,
    1 - (p.embedding <=> query_embedding) AS similarity
  FROM public.photos p
  WHERE
    -- Only filter by user_id if provided in the filter
    (filter_user_id IS NULL OR p.user_id = filter_user_id)
    -- NO minimum similarity threshold - returns ALL matches for debugging
  ORDER BY p.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Add comment
COMMENT ON FUNCTION match_photos IS 'Search photos using vector similarity with optional user_id filter. Returns all matches including low similarity for debugging.';
