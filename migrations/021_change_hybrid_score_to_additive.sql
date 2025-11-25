-- Change hybrid search scoring from weighted average + synergy bonus to simple addition
--
-- Old Formula:
-- Combined = (Text * weight + CLIP * weight) / total_weight + min(Text, CLIP) * 0.4
-- Example: Text: 63%, CLIP: 25% → Combined: 54.73%
--
-- New Formula:
-- Combined = Text + CLIP
-- Example: Text: 63%, CLIP: 25% → Combined: 88%
--
-- This gives a more intuitive score where both signals contribute additively.
-- The combined score can range from 0% to 200%.

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

  -- Validate weights (kept for backwards compatibility, though not used in new formula)
  IF weight_text + weight_clip <= 0 THEN
    RAISE EXCEPTION 'weight_text + weight_clip must be greater than 0';
  END IF;

  -- Detect dimensions using vector_dims()
  text_dimensions := vector_dims(query_embedding_text);
  clip_dimensions := vector_dims(query_embedding_clip);

  -- Support both pure CLIP (512D + 512D) and mixed mode (1536D + 512D)
  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.file_url,
    p.caption,
    -- Combined similarity score: simple addition of both scores
    -- Range: 0.0 to 2.0 (displayed as 0% to 200%)
    (
      COALESCE(1 - (p.embedding <=> query_embedding_text), 0) +
      COALESCE(1 - (p.embedding_clip <=> query_embedding_clip), 0)
    ) AS similarity,
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

COMMENT ON FUNCTION match_photos_hybrid IS 'Hybrid search with additive scoring. Combined = Text + CLIP. Supports pure CLIP (512D+512D) or mixed mode (1536D+512D). REQUIRES user_id in filter.';
