-- Fix vector dimension detection - remove invalid float[] casts
-- pgvector's vector type cannot be cast to float[], use vector_dims() instead

-- Fix match_photos function
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

  -- Detect the dimension of the query embedding using vector_dims()
  embedding_dimensions := vector_dims(query_embedding);

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

-- Fix match_photos_hybrid function
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
