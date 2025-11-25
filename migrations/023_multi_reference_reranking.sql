-- Multi-Reference CLIP Zero-Shot Re-ranking
--
-- Improvement over single-reference approach:
-- Instead of using just the TOP 1 result as reference,
-- use TOP N results (default 3) and average the similarity scores.
--
-- This provides better discrimination between related and unrelated images:
-- - Related images will be similar to ALL references (high average)
-- - Unrelated images may be similar to 1 reference but not all (lower average)
--
-- Example:
-- References: car1.jpg, car2.jpg, lamborghini.jpg
--
-- car3.jpg (related):
--   Sim to car1: 70%, Sim to car2: 72%, Sim to lambo: 65%
--   Average: 69% -> HIGH score
--
-- hab1.jpg (unrelated):
--   Sim to car1: 50%, Sim to car2: 45%, Sim to lambo: 40%
--   Average: 45% -> LOWER score (better filtered out)

CREATE OR REPLACE FUNCTION match_photos_hybrid_reranked (
  query_embedding_text vector,
  query_embedding_clip vector,
  match_count int DEFAULT 50,
  filter jsonb DEFAULT '{}',
  min_clip_score float DEFAULT 0.20,
  reference_weight float DEFAULT 0.5,
  num_references int DEFAULT 3
)
RETURNS TABLE (
  id bigint,
  name text,
  file_url text,
  caption text,
  similarity float,
  similarity_text float,
  similarity_clip float,
  reference_similarity float,
  is_reference boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  filter_user_id uuid;
  ref_count int;
BEGIN
  -- Extract user_id from filter - this is REQUIRED
  filter_user_id := (filter->>'user_id')::uuid;

  -- SECURITY CHECK: user_id MUST be provided
  IF filter_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required in filter parameter for security reasons';
  END IF;

  -- Validate parameters
  IF min_clip_score < 0 OR min_clip_score > 1 THEN
    RAISE EXCEPTION 'min_clip_score must be between 0 and 1';
  END IF;

  IF reference_weight < 0 OR reference_weight > 1 THEN
    RAISE EXCEPTION 'reference_weight must be between 0 and 1';
  END IF;

  IF num_references < 1 OR num_references > 10 THEN
    RAISE EXCEPTION 'num_references must be between 1 and 10';
  END IF;

  -- Use CTE-based approach for multi-reference re-ranking
  RETURN QUERY
  WITH
  -- Step 1: Get all candidates that pass CLIP threshold with initial scores
  candidates_raw AS (
    SELECT
      p.id,
      p.name,
      p.file_url,
      p.caption,
      p.embedding_clip,
      -- Initial combined score (text + clip)
      (
        COALESCE(1 - (p.embedding <=> query_embedding_text), 0) +
        COALESCE(1 - (p.embedding_clip <=> query_embedding_clip), 0)
      ) AS initial_score,
      -- Individual scores
      COALESCE(1 - (p.embedding <=> query_embedding_text), 0) AS text_score,
      COALESCE(1 - (p.embedding_clip <=> query_embedding_clip), 0) AS clip_score
    FROM public.photos p
    WHERE
      p.user_id = filter_user_id
      AND p.embedding IS NOT NULL
      AND p.embedding_clip IS NOT NULL
      -- Apply minimum CLIP score filter
      AND (1 - (p.embedding_clip <=> query_embedding_clip)) >= min_clip_score
  ),

  -- Step 2: Select top N as reference images
  ref_images AS (
    SELECT c.id AS ref_id, c.embedding_clip AS ref_embedding
    FROM candidates_raw c
    ORDER BY c.initial_score DESC
    LIMIT num_references
  ),

  -- Step 3: For each candidate, compute average similarity to ALL references
  candidates_with_ref_sim AS (
    SELECT
      c.id,
      c.name,
      c.file_url,
      c.caption,
      c.initial_score,
      c.text_score,
      c.clip_score,
      -- Average similarity to all reference images
      (
        SELECT COALESCE(AVG(1 - (c.embedding_clip <=> r.ref_embedding)), 0)
        FROM ref_images r
      ) AS avg_ref_similarity,
      -- Check if this candidate is one of the references
      EXISTS(SELECT 1 FROM ref_images r WHERE r.ref_id = c.id) AS is_ref
    FROM candidates_raw c
  )

  -- Step 4: Compute final score and return results
  SELECT
    crs.id,
    crs.name,
    crs.file_url,
    crs.caption,
    -- Final score: base_score * ((1 - ref_weight) + avg_ref_similarity * ref_weight)
    -- This boosts images similar to multiple references
    (crs.initial_score * ((1 - reference_weight) + crs.avg_ref_similarity * reference_weight))::float AS similarity,
    crs.text_score::float AS similarity_text,
    crs.clip_score::float AS similarity_clip,
    crs.avg_ref_similarity::float AS reference_similarity,
    crs.is_ref AS is_reference
  FROM candidates_with_ref_sim crs
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION match_photos_hybrid_reranked IS 'Multi-reference CLIP zero-shot re-ranking. Uses top N results as references and averages similarity scores for better discrimination. Parameters: min_clip_score (0-1), reference_weight (0-1), num_references (1-10, default 3). REQUIRES user_id in filter.';
