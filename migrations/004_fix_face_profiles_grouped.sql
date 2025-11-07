-- ============================================================================
-- Migration: Fix get_face_profiles_grouped function
-- Description: Fixes the subquery issue in get_face_profiles_grouped function
-- Date: 2025-01-15
-- ============================================================================

-- Drop and recreate the function with corrected query
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
  WITH grouped_faces AS (
    SELECT
      COALESCE(fp.face_name, 'unknown') as grouped_face_name,
      COUNT(fp.id) as count_faces,
      ARRAY_AGG(fp.id ORDER BY fp.created_at DESC) as ids,
      MAX(fp.created_at) as latest_created,
      (ARRAY_AGG(fp.photo_id ORDER BY fp.created_at DESC))[1] as latest_photo_id
    FROM public.face_profiles fp
    WHERE fp.user_id = p_user_id
    GROUP BY COALESCE(fp.face_name, 'unknown')
  )
  SELECT
    gf.grouped_face_name as face_name,
    gf.count_faces as face_count,
    gf.ids as face_ids,
    COALESCE(p.file_url, '') as sample_photo_url,
    gf.latest_created as latest_detection
  FROM grouped_faces gf
  LEFT JOIN public.photos p ON p.id = gf.latest_photo_id
  ORDER BY gf.latest_created DESC;
END;
$$;

COMMENT ON FUNCTION public.get_face_profiles_grouped IS 'Get face profiles grouped by name with counts and sample photos (FIXED)';
