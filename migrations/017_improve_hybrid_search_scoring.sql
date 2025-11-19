-- Improve hybrid search scoring with synergy bonus
-- When both text and image embeddings match well, boost the score
--
-- New Formula:
-- Base Score = weighted average (60% text + 40% image)
-- Synergy Bonus = when both match well, add bonus based on minimum score
-- Final Score = Base Score + (Synergy Bonus * 0.4)
--
-- Example:
-- Text: 53%, Image: 31%
-- Base: 44.2% (weighted avg)
-- Synergy: 31% * 0.4 = 12.4%
-- Final: 44.2% + 12.4% = 56.6% ✓

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
    -- Combined similarity score with synergy bonus
    -- When both text and image match, the combination is stronger than the average
    LEAST(1.0, (
      -- Base weighted average
      (
        (1 - (p.embedding <=> query_embedding_text)) * weight_text +
        (1 - (p.embedding_clip <=> query_embedding_clip)) * weight_clip
      ) / (weight_text + weight_clip)
      +
      -- Synergy bonus: multiply minimum score by 0.4
      -- This rewards cases where BOTH embeddings match well
      (
        LEAST(
          1 - (p.embedding <=> query_embedding_text),
          1 - (p.embedding_clip <=> query_embedding_clip)
        ) * 0.4
      )
    )) AS similarity,
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

COMMENT ON FUNCTION match_photos_hybrid IS 'Hybrid search with synergy bonus. Combines text (1536D) and image (512D) embeddings with bonus when both match. REQUIRES user_id in filter.';
