-- Update hybrid search to support pure CLIP mode (512D + 512D)

CREATE OR REPLACE FUNCTION match_photos_hybrid (
  query_embedding_text vector,
  query_embedding_clip vector,
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
  text_dimensions int;
  clip_dimensions int;
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

  -- Detect dimensions
  text_dimensions := array_length(query_embedding_text::float[], 1);
  clip_dimensions := array_length(query_embedding_clip::float[], 1);

  -- Support both pure CLIP (512D + 512D) and mixed mode (1536D + 512D)
  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.file_url,
    p.caption,
    -- Combined similarity score with synergy bonus
    LEAST(1.0, (
      -- Base weighted average
      (
        COALESCE(1 - (p.embedding <=> query_embedding_text), 0) * weight_text +
        COALESCE(1 - (p.embedding_clip <=> query_embedding_clip), 0) * weight_clip
      ) / (weight_text + weight_clip)
      +
      -- Synergy bonus: multiply minimum score by 0.4
      (
        LEAST(
          COALESCE(1 - (p.embedding <=> query_embedding_text), 0),
          COALESCE(1 - (p.embedding_clip <=> query_embedding_clip), 0)
        ) * 0.4
      )
    )) AS similarity,
    -- Individual scores for debugging/analysis
    COALESCE(1 - (p.embedding <=> query_embedding_text), 0) AS similarity_text,
    COALESCE(1 - (p.embedding_clip <=> query_embedding_clip), 0) AS similarity_clip
  FROM public.photos p
  WHERE
    p.user_id = filter_user_id
    AND (p.embedding IS NOT NULL OR p.embedding_clip IS NOT NULL)
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION match_photos_hybrid IS 'Hybrid search with synergy bonus. Supports pure CLIP (512D+512D) or mixed mode (1536D+512D). REQUIRES user_id in filter.';
