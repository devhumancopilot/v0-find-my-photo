-- Add CLIP Zero-Shot Re-ranking Function
--
-- This function implements a two-phase search:
-- 1. Initial hybrid search (text + CLIP)
-- 2. Re-ranking using reference image similarity (CLIP zero-shot style)
--
-- The top result from phase 1 becomes the "reference image"
-- All other results are re-ranked by their CLIP embedding similarity to the reference
--
-- This filters out images that match text/captions but don't visually match the query

-- Helper function: Calculate cosine similarity between two vectors
-- Note: pgvector's <=> operator returns DISTANCE (0 = identical, 2 = opposite)
-- We convert to similarity: 1 - distance/2 gives us 0-1 range for normalized vectors
CREATE OR REPLACE FUNCTION cosine_similarity(a vector, b vector)
RETURNS float
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT 1 - (a <=> b);
$$;

COMMENT ON FUNCTION cosine_similarity IS 'Calculate cosine similarity between two vectors. Returns 0-1 for normalized vectors.';

-- Main function: Hybrid search with CLIP zero-shot re-ranking
CREATE OR REPLACE FUNCTION match_photos_hybrid_reranked (
  query_embedding_text vector,
  query_embedding_clip vector,
  match_count int DEFAULT 50,
  filter jsonb DEFAULT '{}',
  min_clip_score float DEFAULT 0.20,
  reference_weight float DEFAULT 0.5
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
  reference_embedding vector(512);
  reference_photo_id bigint;
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

  -- Phase 1: Find the reference image (best initial match)
  -- This is the top result from standard hybrid search with minimum CLIP threshold
  SELECT
    p.id,
    p.embedding_clip
  INTO reference_photo_id, reference_embedding
  FROM public.photos p
  WHERE
    p.user_id = filter_user_id
    AND p.embedding IS NOT NULL
    AND p.embedding_clip IS NOT NULL
    -- Apply minimum CLIP score filter to ensure reference is visually relevant
    AND (1 - (p.embedding_clip <=> query_embedding_clip)) >= min_clip_score
  ORDER BY (
    -- Initial ranking: Text + CLIP (additive)
    COALESCE(1 - (p.embedding <=> query_embedding_text), 0) +
    COALESCE(1 - (p.embedding_clip <=> query_embedding_clip), 0)
  ) DESC
  LIMIT 1;

  -- If no reference found (no images pass CLIP threshold), return empty
  IF reference_embedding IS NULL THEN
    RETURN;
  END IF;

  -- Phase 2: Re-rank all results using reference image similarity
  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.file_url,
    p.caption,
    -- Final score: combines original score with reference similarity
    -- Formula: base_score * (1 - reference_weight) + base_score * reference_similarity * reference_weight
    -- Simplified: base_score * ((1 - reference_weight) + reference_similarity * reference_weight)
    (
      (
        COALESCE(1 - (p.embedding <=> query_embedding_text), 0) +
        COALESCE(1 - (p.embedding_clip <=> query_embedding_clip), 0)
      ) * (
        (1 - reference_weight) +
        COALESCE(1 - (p.embedding_clip <=> reference_embedding), 0) * reference_weight
      )
    ) AS similarity,
    -- Individual scores for debugging
    COALESCE(1 - (p.embedding <=> query_embedding_text), 0) AS similarity_text,
    COALESCE(1 - (p.embedding_clip <=> query_embedding_clip), 0) AS similarity_clip,
    -- Reference similarity score
    COALESCE(1 - (p.embedding_clip <=> reference_embedding), 0) AS reference_similarity,
    -- Flag to identify the reference image
    (p.id = reference_photo_id) AS is_reference
  FROM public.photos p
  WHERE
    p.user_id = filter_user_id
    AND p.embedding IS NOT NULL
    AND p.embedding_clip IS NOT NULL
    -- Apply minimum CLIP score filter
    AND (1 - (p.embedding_clip <=> query_embedding_clip)) >= min_clip_score
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION match_photos_hybrid_reranked IS 'Hybrid search with CLIP zero-shot re-ranking. Uses top result as reference and re-ranks by visual similarity. Parameters: min_clip_score (0-1) filters low visual matches, reference_weight (0-1) controls how much reference similarity affects ranking. REQUIRES user_id in filter.';
