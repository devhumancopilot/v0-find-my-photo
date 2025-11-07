-- Test match_photos function directly in SQL
-- This bypasses the application layer to verify the function works

-- First, get a sample embedding from an existing photo
DO $$
DECLARE
  test_embedding vector(1536);
  test_user_id uuid;
  result_count int;
BEGIN
  -- Get a sample photo's embedding and user_id
  SELECT embedding, user_id
  INTO test_embedding, test_user_id
  FROM photos
  WHERE embedding IS NOT NULL
  LIMIT 1;

  IF test_embedding IS NULL THEN
    RAISE NOTICE 'No photos with embeddings found in database';
    RETURN;
  END IF;

  RAISE NOTICE 'Testing with user_id: %', test_user_id;
  RAISE NOTICE 'Embedding dimensions: %', array_length(test_embedding::float[], 1);

  -- Test the match_photos function directly
  SELECT COUNT(*) INTO result_count
  FROM match_photos(
    test_embedding,
    10,
    jsonb_build_object('user_id', test_user_id)
  );

  RAISE NOTICE 'match_photos returned % results', result_count;

  -- Show the actual results
  RAISE NOTICE 'Top 5 matches:';
  FOR i IN (
    SELECT
      id,
      name,
      (similarity * 100)::numeric(5,2) as similarity_percent
    FROM match_photos(
      test_embedding,
      5,
      jsonb_build_object('user_id', test_user_id)
    )
  )
  LOOP
    RAISE NOTICE '  - ID: %, Name: %, Similarity: %%', i.id, i.name, i.similarity_percent;
  END LOOP;

  IF result_count = 0 THEN
    RAISE NOTICE '⚠️ WARNING: Function returned 0 results. Check SECURITY DEFINER setting.';
  ELSE
    RAISE NOTICE '✅ SUCCESS: Function is working correctly!';
  END IF;
END $$;
