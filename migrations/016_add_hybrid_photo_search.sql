-- Add hybrid photo search that combines both text and image embeddings
-- for more accurate search results
--
-- Strategy:
-- - Text-to-caption: OpenAI 1536D embedding vs embedding column (caption similarity)
-- - Text-to-image: CLIP 512D embedding vs embedding_clip column (visual similarity)
-- - Combined score: weighted average of both similarities

-- Create hybrid search function
CREATE OR REPLACE FUNCTION match_photos_hybrid (
  query_embedding_text vector(1536),
  query_embedding_clip vector(512),
  match_count int DEFAULT 50,
  filter jsonb DEFAULT '{}',
  weight_text float DEFAULT 0.5,
  weight_clip float DEFAULT 0.5
)
RETURNS TABLE (
  id bigint,
  name text,
  file_url text,
  caption text,
  similarity float,
  similarity_text float,
  similarity_clip float
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

  -- Validate weights
  IF weight_text + weight_clip <= 0 THEN
    RAISE EXCEPTION 'weight_text + weight_clip must be greater than 0';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.file_url,
    p.caption,
    -- Combined similarity score (weighted average)
    (
      (1 - (p.embedding <=> query_embedding_text)) * weight_text +
      (1 - (p.embedding_clip <=> query_embedding_clip)) * weight_clip
    ) / (weight_text + weight_clip) AS similarity,
    -- Individual scores for debugging/analysis
    (1 - (p.embedding <=> query_embedding_text)) AS similarity_text,
    (1 - (p.embedding_clip <=> query_embedding_clip)) AS similarity_clip
  FROM public.photos p
  WHERE
    p.user_id = filter_user_id
    AND p.embedding IS NOT NULL
    AND p.embedding_clip IS NOT NULL
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION match_photos_hybrid IS 'Hybrid search combining text (1536D) and image (512D) embeddings for improved accuracy. Returns combined similarity score plus individual scores. REQUIRES user_id in filter.';

-- Grant permissions
GRANT EXECUTE ON FUNCTION match_photos_hybrid TO authenticated;
GRANT EXECUTE ON FUNCTION match_photos_hybrid TO service_role;
REVOKE EXECUTE ON FUNCTION match_photos_hybrid FROM anon;

-- Also fix the original match_photos to support both dimensions
DROP FUNCTION IF EXISTS match_photos(vector, int, jsonb);

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
    -- Use CLIP embeddings (512D)
    RETURN QUERY
    SELECT
      p.id,
      p.name,
      p.file_url,
      p.caption,
      1 - (p.embedding_clip <=> query_embedding) AS similarity
    FROM public.photos p
    WHERE
      p.user_id = filter_user_id
      AND p.embedding_clip IS NOT NULL
    ORDER BY p.embedding_clip <=> query_embedding
    LIMIT match_count;

  ELSIF embedding_dimensions = 1536 THEN
    -- Use OpenAI text embeddings (1536D)
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
    RAISE EXCEPTION 'Unsupported embedding dimension: %. Only 512D (CLIP) and 1536D (OpenAI) are supported.', embedding_dimensions;
  END IF;
END;
$$;

COMMENT ON FUNCTION match_photos IS 'Single-embedding search. Supports 512D (CLIP) or 1536D (OpenAI). For better accuracy, use match_photos_hybrid instead.';

-- Grant permissions
GRANT EXECUTE ON FUNCTION match_photos TO authenticated;
GRANT EXECUTE ON FUNCTION match_photos TO service_role;
REVOKE EXECUTE ON FUNCTION match_photos FROM anon;
