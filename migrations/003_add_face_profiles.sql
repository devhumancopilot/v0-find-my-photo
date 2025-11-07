-- ============================================================================
-- Migration: Add Face Profiles Feature
-- Description: Adds face detection and recognition capabilities
-- Date: 2025-01-15
-- SAFE FOR PRODUCTION: Uses IF NOT EXISTS to prevent breaking changes
-- ============================================================================

-- ============================================================================
-- STEP 1: Enable pgvector extension (if not already enabled)
-- ============================================================================

-- Create pgvector extension for vector similarity search
-- Safe to run multiple times
CREATE EXTENSION IF NOT EXISTS vector;

COMMENT ON EXTENSION vector IS 'Vector similarity search for face embeddings';

-- ============================================================================
-- STEP 2: Create face_profiles table
-- ============================================================================

-- Main table for storing detected faces and their embeddings
CREATE TABLE IF NOT EXISTS public.face_profiles (
  -- Primary Key
  id bigserial PRIMARY KEY,

  -- Relationships
  photo_id bigint NOT NULL,
  user_id uuid NOT NULL,

  -- Face Data
  face_embedding vector(128) NOT NULL,  -- 128-dimensional face descriptor
  face_name text,  -- NULL initially, user assigns manually

  -- Bounding Box (for display/cropping)
  bbox_x integer NOT NULL,  -- Top-left X coordinate
  bbox_y integer NOT NULL,  -- Top-left Y coordinate
  bbox_width integer NOT NULL,
  bbox_height integer NOT NULL,

  -- Confidence & Metadata
  detection_confidence real NOT NULL CHECK (detection_confidence >= 0 AND detection_confidence <= 1),
  metadata jsonb,  -- Optional: age, gender, emotion, landmarks

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Foreign Keys
  CONSTRAINT fk_face_profiles_photo
    FOREIGN KEY (photo_id)
    REFERENCES public.photos(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_face_profiles_user
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE
);

-- Add table comment
COMMENT ON TABLE public.face_profiles IS 'Stores detected faces with embeddings for recognition';

-- Add column comments
COMMENT ON COLUMN public.face_profiles.face_embedding IS '128-dimensional face descriptor from face-api.js';
COMMENT ON COLUMN public.face_profiles.face_name IS 'User-assigned name for the face (NULL = unidentified)';
COMMENT ON COLUMN public.face_profiles.bbox_x IS 'Bounding box top-left X coordinate';
COMMENT ON COLUMN public.face_profiles.bbox_y IS 'Bounding box top-left Y coordinate';
COMMENT ON COLUMN public.face_profiles.bbox_width IS 'Bounding box width in pixels';
COMMENT ON COLUMN public.face_profiles.bbox_height IS 'Bounding box height in pixels';
COMMENT ON COLUMN public.face_profiles.detection_confidence IS 'Face detection confidence score (0.0 to 1.0)';
COMMENT ON COLUMN public.face_profiles.metadata IS 'Optional metadata: age, gender, expression, landmarks';

-- ============================================================================
-- STEP 3: Create indexes for performance
-- ============================================================================

-- Index on photo_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_face_profiles_photo_id
  ON public.face_profiles(photo_id);

-- Index on user_id for filtering by user
CREATE INDEX IF NOT EXISTS idx_face_profiles_user_id
  ON public.face_profiles(user_id);

-- Index on face_name for filtering named/unnamed faces
CREATE INDEX IF NOT EXISTS idx_face_profiles_face_name
  ON public.face_profiles(face_name)
  WHERE face_name IS NOT NULL;

-- Index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_face_profiles_created_at
  ON public.face_profiles(created_at DESC);

-- Composite index for user + face_name queries
CREATE INDEX IF NOT EXISTS idx_face_profiles_user_face_name
  ON public.face_profiles(user_id, face_name);

-- ============================================================================
-- STEP 4: Create vector similarity index (HNSW for speed)
-- ============================================================================

-- HNSW (Hierarchical Navigable Small World) index for fast similarity search
-- Using cosine distance (best for normalized embeddings)
CREATE INDEX IF NOT EXISTS idx_face_profiles_embedding_hnsw
  ON public.face_profiles
  USING hnsw (face_embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

COMMENT ON INDEX idx_face_profiles_embedding_hnsw IS 'HNSW index for fast face similarity search using cosine distance';

-- Alternative: IVFFlat index (less accurate but faster to build)
-- Uncomment if HNSW is too slow for your dataset
-- CREATE INDEX IF NOT EXISTS idx_face_profiles_embedding_ivfflat
--   ON public.face_profiles
--   USING ivfflat (face_embedding vector_cosine_ops)
--   WITH (lists = 100);

-- ============================================================================
-- STEP 5: Create RLS (Row Level Security) policies
-- ============================================================================

-- Enable RLS
ALTER TABLE public.face_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (safe to run)
DROP POLICY IF EXISTS "Users can view their own face profiles" ON public.face_profiles;
DROP POLICY IF EXISTS "Users can insert their own face profiles" ON public.face_profiles;
DROP POLICY IF EXISTS "Users can update their own face profiles" ON public.face_profiles;
DROP POLICY IF EXISTS "Users can delete their own face profiles" ON public.face_profiles;

-- Allow users to view their own face profiles
CREATE POLICY "Users can view their own face profiles"
  ON public.face_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow users to insert their own face profiles
CREATE POLICY "Users can insert their own face profiles"
  ON public.face_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own face profiles
CREATE POLICY "Users can update their own face profiles"
  ON public.face_profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own face profiles
CREATE POLICY "Users can delete their own face profiles"
  ON public.face_profiles
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- STEP 6: Create updated_at trigger
-- ============================================================================

-- Create trigger to automatically update updated_at timestamp
DROP TRIGGER IF EXISTS set_face_profiles_updated_at ON public.face_profiles;

CREATE TRIGGER set_face_profiles_updated_at
  BEFORE UPDATE ON public.face_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Note: handle_updated_at() function should already exist from previous migration
-- If not, create it:
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 7: Create face matching function (Vector Similarity Search)
-- ============================================================================

-- Function to find matching faces using cosine similarity
-- Returns faces with similarity above threshold
CREATE OR REPLACE FUNCTION public.match_faces(
  query_embedding vector(128),
  match_user_id uuid,
  similarity_threshold float DEFAULT 0.4,  -- 0.4 = 60% similar (cosine)
  match_limit int DEFAULT 1
)
RETURNS TABLE (
  id bigint,
  photo_id bigint,
  face_name text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    fp.id,
    fp.photo_id,
    fp.face_name,
    1 - (fp.face_embedding <=> query_embedding) as similarity
  FROM public.face_profiles fp
  WHERE
    fp.user_id = match_user_id
    AND fp.face_name IS NOT NULL  -- Only match faces with assigned names
    AND (1 - (fp.face_embedding <=> query_embedding)) >= similarity_threshold
  ORDER BY fp.face_embedding <=> query_embedding
  LIMIT match_limit;
END;
$$;

COMMENT ON FUNCTION public.match_faces IS 'Find similar faces using cosine similarity (threshold: 0.4 = 60% similar)';

-- ============================================================================
-- STEP 8: Create helper function to get face profiles grouped by name
-- ============================================================================

-- Function to get all faces for a user, grouped by face_name
CREATE OR REPLACE FUNCTION public.get_face_profiles_grouped(
  p_user_id uuid
)
RETURNS TABLE (
  face_name text,
  face_count bigint,
  face_ids bigint[],
  sample_photo_url text,
  latest_detection timestamptz
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(fp.face_name, 'unknown') as face_name,
    COUNT(fp.id) as face_count,
    ARRAY_AGG(fp.id ORDER BY fp.created_at DESC) as face_ids,
    (
      SELECT p.file_url
      FROM public.photos p
      WHERE p.id = (
        SELECT fp2.photo_id
        FROM public.face_profiles fp2
        WHERE fp2.user_id = p_user_id
          AND COALESCE(fp2.face_name, 'unknown') = COALESCE(fp.face_name, 'unknown')
        ORDER BY fp2.created_at DESC
        LIMIT 1
      )
    ) as sample_photo_url,
    MAX(fp.created_at) as latest_detection
  FROM public.face_profiles fp
  WHERE fp.user_id = p_user_id
  GROUP BY COALESCE(fp.face_name, 'unknown')
  ORDER BY MAX(fp.created_at) DESC;
END;
$$;

COMMENT ON FUNCTION public.get_face_profiles_grouped IS 'Get face profiles grouped by name with counts and sample photos';

-- ============================================================================
-- STEP 9: Create function to update face names in bulk
-- ============================================================================

-- Function to assign same name to multiple face profiles
CREATE OR REPLACE FUNCTION public.bulk_update_face_names(
  p_face_ids bigint[],
  p_face_name text,
  p_user_id uuid
)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  updated_count int;
BEGIN
  UPDATE public.face_profiles
  SET face_name = p_face_name
  WHERE id = ANY(p_face_ids)
    AND user_id = p_user_id;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

COMMENT ON FUNCTION public.bulk_update_face_names IS 'Update face_name for multiple profiles at once';

-- ============================================================================
-- STEP 10: Add face_count column to photos table (optional)
-- ============================================================================

-- Add column to track number of faces detected in each photo
ALTER TABLE public.photos
ADD COLUMN IF NOT EXISTS face_count integer DEFAULT 0;

COMMENT ON COLUMN public.photos.face_count IS 'Number of faces detected in this photo';

-- Create index on face_count for filtering photos with/without faces
CREATE INDEX IF NOT EXISTS idx_photos_face_count
  ON public.photos(face_count);

-- ============================================================================
-- STEP 11: Create trigger to update face_count automatically
-- ============================================================================

-- Function to update photo face_count when face_profiles change
CREATE OR REPLACE FUNCTION public.update_photo_face_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the face_count for the affected photo
  IF TG_OP = 'DELETE' THEN
    UPDATE public.photos
    SET face_count = (
      SELECT COUNT(*)
      FROM public.face_profiles
      WHERE photo_id = OLD.photo_id
    )
    WHERE id = OLD.photo_id;
    RETURN OLD;
  ELSE
    UPDATE public.photos
    SET face_count = (
      SELECT COUNT(*)
      FROM public.face_profiles
      WHERE photo_id = NEW.photo_id
    )
    WHERE id = NEW.photo_id;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS update_photo_face_count_trigger ON public.face_profiles;

CREATE TRIGGER update_photo_face_count_trigger
  AFTER INSERT OR DELETE ON public.face_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_photo_face_count();

COMMENT ON FUNCTION public.update_photo_face_count IS 'Automatically update face_count in photos table';

-- ============================================================================
-- COMPLETED! Migration Summary
-- ============================================================================

-- ✅ Created face_profiles table with vector embeddings
-- ✅ Added indexes for performance (including HNSW vector index)
-- ✅ Set up RLS policies for user data isolation
-- ✅ Created match_faces() function for similarity search
-- ✅ Created helper functions for grouping and bulk updates
-- ✅ Added face_count to photos table with auto-update trigger
-- ✅ All operations use IF NOT EXISTS / IF EXISTS for safety

-- ============================================================================
-- TESTING QUERIES (Run these to verify migration)
-- ============================================================================

/*
-- 1. Test vector extension
SELECT * FROM pg_extension WHERE extname = 'vector';

-- 2. Check table exists
SELECT * FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'face_profiles';

-- 3. Check indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'face_profiles';

-- 4. Test match_faces function (requires data)
-- SELECT * FROM match_faces(
--   '[0.1, 0.2, ...]'::vector(128),
--   'user-uuid'::uuid,
--   0.4,
--   5
-- );

-- 5. Test grouped faces function
-- SELECT * FROM get_face_profiles_grouped('user-uuid'::uuid);
*/

-- ============================================================================
-- ROLLBACK SCRIPT (USE WITH CAUTION!)
-- ============================================================================

/*
-- Uncomment to rollback this migration

-- Drop triggers
DROP TRIGGER IF EXISTS update_photo_face_count_trigger ON public.face_profiles;
DROP TRIGGER IF EXISTS set_face_profiles_updated_at ON public.face_profiles;

-- Drop functions
DROP FUNCTION IF EXISTS public.match_faces(vector(128), uuid, float, int);
DROP FUNCTION IF EXISTS public.get_face_profiles_grouped(uuid);
DROP FUNCTION IF EXISTS public.bulk_update_face_names(bigint[], text, uuid);
DROP FUNCTION IF EXISTS public.update_photo_face_count();

-- Drop RLS policies
DROP POLICY IF EXISTS "Users can view their own face profiles" ON public.face_profiles;
DROP POLICY IF EXISTS "Users can insert their own face profiles" ON public.face_profiles;
DROP POLICY IF EXISTS "Users can update their own face profiles" ON public.face_profiles;
DROP POLICY IF EXISTS "Users can delete their own face profiles" ON public.face_profiles;

-- Drop indexes (will be dropped automatically with table, but listing for clarity)
DROP INDEX IF EXISTS idx_face_profiles_photo_id;
DROP INDEX IF EXISTS idx_face_profiles_user_id;
DROP INDEX IF EXISTS idx_face_profiles_face_name;
DROP INDEX IF EXISTS idx_face_profiles_created_at;
DROP INDEX IF EXISTS idx_face_profiles_user_face_name;
DROP INDEX IF EXISTS idx_face_profiles_embedding_hnsw;
DROP INDEX IF EXISTS idx_photos_face_count;

-- Remove column from photos table
ALTER TABLE public.photos DROP COLUMN IF EXISTS face_count;

-- Drop table (CASCADE will drop foreign key constraints)
DROP TABLE IF EXISTS public.face_profiles CASCADE;

-- Note: We don't drop the vector extension as other features might use it
-- DROP EXTENSION IF EXISTS vector CASCADE;
*/
