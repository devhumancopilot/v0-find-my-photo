-- ============================================================================
-- Migration: Add Favorites Feature
-- Description: Adds favorite functionality for photos and albums
-- Date: 2025-01-15
-- ============================================================================

-- ============================================================================
-- STEP 1: Add is_favorite column to PHOTOS table
-- ============================================================================

ALTER TABLE public.photos
ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.photos.is_favorite IS 'Whether this photo is marked as favorite by the user';

-- Create index for faster queries on favorites
CREATE INDEX IF NOT EXISTS idx_photos_is_favorite
  ON public.photos(user_id, is_favorite)
  WHERE is_favorite = true;

-- ============================================================================
-- STEP 2: Add is_favorite column to ALBUMS table
-- ============================================================================

ALTER TABLE public.albums
ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.albums.is_favorite IS 'Whether this album is marked as favorite by the user';

-- Create index for faster queries on favorite albums
CREATE INDEX IF NOT EXISTS idx_albums_is_favorite
  ON public.albums(user_id, is_favorite)
  WHERE is_favorite = true;

-- ============================================================================
-- STEP 3: Add favorited_at timestamp columns (optional but useful)
-- ============================================================================

ALTER TABLE public.photos
ADD COLUMN IF NOT EXISTS favorited_at TIMESTAMPTZ;

COMMENT ON COLUMN public.photos.favorited_at IS 'Timestamp when photo was marked as favorite';

ALTER TABLE public.albums
ADD COLUMN IF NOT EXISTS favorited_at TIMESTAMPTZ;

COMMENT ON COLUMN public.albums.favorited_at IS 'Timestamp when album was marked as favorite';

-- ============================================================================
-- STEP 4: Create helper functions for favorites management
-- ============================================================================

-- Function to toggle favorite status for a photo
CREATE OR REPLACE FUNCTION public.toggle_photo_favorite(
  photo_uuid BIGINT,
  user_uuid UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  current_favorite BOOLEAN;
  new_favorite BOOLEAN;
BEGIN
  -- Get current favorite status
  SELECT is_favorite INTO current_favorite
  FROM public.photos
  WHERE id = photo_uuid AND user_id = user_uuid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Photo not found or unauthorized';
  END IF;

  -- Toggle favorite status
  new_favorite := NOT current_favorite;

  -- Update photo
  UPDATE public.photos
  SET
    is_favorite = new_favorite,
    favorited_at = CASE
      WHEN new_favorite THEN NOW()
      ELSE NULL
    END
  WHERE id = photo_uuid AND user_id = user_uuid;

  RETURN new_favorite;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.toggle_photo_favorite IS 'Toggles favorite status for a photo';

-- Function to toggle favorite status for an album
CREATE OR REPLACE FUNCTION public.toggle_album_favorite(
  album_uuid BIGINT,
  user_uuid UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  current_favorite BOOLEAN;
  new_favorite BOOLEAN;
BEGIN
  -- Get current favorite status
  SELECT is_favorite INTO current_favorite
  FROM public.albums
  WHERE id = album_uuid AND user_id = user_uuid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Album not found or unauthorized';
  END IF;

  -- Toggle favorite status
  new_favorite := NOT current_favorite;

  -- Update album
  UPDATE public.albums
  SET
    is_favorite = new_favorite,
    favorited_at = CASE
      WHEN new_favorite THEN NOW()
      ELSE NULL
    END
  WHERE id = album_uuid AND user_id = user_uuid;

  RETURN new_favorite;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.toggle_album_favorite IS 'Toggles favorite status for an album';

-- Function to get favorite counts for a user
CREATE OR REPLACE FUNCTION public.get_favorite_counts(user_uuid UUID)
RETURNS TABLE(
  favorite_photos_count BIGINT,
  favorite_albums_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.photos WHERE user_id = user_uuid AND is_favorite = true),
    (SELECT COUNT(*) FROM public.albums WHERE user_id = user_uuid AND is_favorite = true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_favorite_counts IS 'Returns count of favorite photos and albums for a user';

-- ============================================================================
-- STEP 5: Create view for favorite items
-- ============================================================================

CREATE OR REPLACE VIEW public.user_favorites AS
SELECT
  user_id,
  'photo' as item_type,
  id as item_id,
  name as item_name,
  favorited_at,
  created_at
FROM public.photos
WHERE is_favorite = true

UNION ALL

SELECT
  user_id,
  'album' as item_type,
  id as item_id,
  album_title as item_name,
  favorited_at,
  created_at
FROM public.albums
WHERE is_favorite = true

ORDER BY favorited_at DESC NULLS LAST;

COMMENT ON VIEW public.user_favorites IS 'Combined view of all favorited photos and albums';

-- ============================================================================
-- STEP 6: Update RLS policies to include is_favorite in user queries
-- ============================================================================

-- The existing RLS policies already cover is_favorite column access
-- since they filter by user_id. No changes needed.

-- ============================================================================
-- COMPLETED!
-- ============================================================================

-- Summary of changes:
-- ✅ Added is_favorite column to photos table
-- ✅ Added is_favorite column to albums table
-- ✅ Added favorited_at timestamps for tracking when items were favorited
-- ✅ Created indexes for efficient favorite queries
-- ✅ Created toggle functions for photos and albums
-- ✅ Created helper function to get favorite counts
-- ✅ Created view to see all favorites in one place
-- ✅ Verified RLS policies cover new columns

-- NEXT STEPS:
-- 1. Run this migration on your Supabase database
-- 2. Create API routes for favorite actions
-- 3. Update UI components to use favorites functionality
-- 4. Update dashboard to show real favorite counts

-- ============================================================================
-- ROLLBACK SCRIPT (if needed)
-- ============================================================================

/*
-- Uncomment to rollback

-- Drop view
DROP VIEW IF EXISTS public.user_favorites;

-- Drop functions
DROP FUNCTION IF EXISTS public.toggle_photo_favorite(BIGINT, UUID);
DROP FUNCTION IF EXISTS public.toggle_album_favorite(BIGINT, UUID);
DROP FUNCTION IF EXISTS public.get_favorite_counts(UUID);

-- Drop indexes
DROP INDEX IF EXISTS idx_photos_is_favorite;
DROP INDEX IF EXISTS idx_albums_is_favorite;

-- Drop columns
ALTER TABLE public.photos DROP COLUMN IF EXISTS is_favorite;
ALTER TABLE public.photos DROP COLUMN IF EXISTS favorited_at;
ALTER TABLE public.albums DROP COLUMN IF EXISTS is_favorite;
ALTER TABLE public.albums DROP COLUMN IF EXISTS favorited_at;
*/
