-- FIX CRITICAL SECURITY ISSUE: match_photos function must ALWAYS filter by user_id
-- Previous version allowed NULL user_id which would return photos from ALL users
-- This is a critical privacy/security bug that must be fixed immediately

-- Drop the insecure function
DROP FUNCTION IF EXISTS match_photos(vector, int, jsonb);

-- Create secure version that REQUIRES user_id filtering
CREATE OR REPLACE FUNCTION match_photos (
  query_embedding vector(1536),
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
  -- If not provided, raise an error instead of returning all photos
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
    -- ALWAYS filter by user_id - no exceptions
    p.user_id = filter_user_id
  ORDER BY p.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Add comment explaining the security requirements
COMMENT ON FUNCTION match_photos IS 'Search photos using vector similarity. REQUIRES user_id in filter for security. Will throw error if user_id is missing to prevent data leaks across users.';

-- Grant execute permission to authenticated users only
GRANT EXECUTE ON FUNCTION match_photos TO authenticated;
REVOKE EXECUTE ON FUNCTION match_photos FROM anon;
