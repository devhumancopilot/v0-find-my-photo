-- ============================================================================
-- Migration: Extend Schema for Multi-User Support
-- Description: Adds user_id columns, missing fields, and RLS policies
-- Date: 2025-01-15
-- IMPORTANT: This migration is designed to preserve existing data
-- ============================================================================

-- ============================================================================
-- STEP 1: Extend ALBUMS table
-- ============================================================================

-- Add user_id column (nullable initially to preserve existing data)
ALTER TABLE public.albums
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

COMMENT ON COLUMN public.albums.user_id IS 'Owner of the album';

-- Add description column
ALTER TABLE public.albums
ADD COLUMN IF NOT EXISTS description text;

COMMENT ON COLUMN public.albums.description IS 'User description/query for the album';

-- Add cover_image_url column
ALTER TABLE public.albums
ADD COLUMN IF NOT EXISTS cover_image_url text;

COMMENT ON COLUMN public.albums.cover_image_url IS 'URL of the album cover image';

-- Add photo_count column
ALTER TABLE public.albums
ADD COLUMN IF NOT EXISTS photo_count integer DEFAULT 0;

COMMENT ON COLUMN public.albums.photo_count IS 'Number of photos in the album';

-- Add status column
ALTER TABLE public.albums
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' CHECK (status IN ('pending', 'active', 'archived'));

COMMENT ON COLUMN public.albums.status IS 'Album processing/display status';

-- Add processing_status column (for n8n workflow tracking)
ALTER TABLE public.albums
ADD COLUMN IF NOT EXISTS processing_status text DEFAULT 'completed' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed'));

COMMENT ON COLUMN public.albums.processing_status IS 'Processing status for AI workflow';

-- Add updated_at column for tracking changes
ALTER TABLE public.albums
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

COMMENT ON COLUMN public.albums.updated_at IS 'Last update timestamp';

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_albums_user_id ON public.albums(user_id);

-- Create index on status
CREATE INDEX IF NOT EXISTS idx_albums_status ON public.albums(status);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_albums_created_at ON public.albums(created_at DESC);

-- ============================================================================
-- STEP 2: Extend PHOTOS table
-- ============================================================================

-- Add user_id column (nullable initially)
ALTER TABLE public.photos
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

COMMENT ON COLUMN public.photos.user_id IS 'Owner of the photo';

-- Add album_id column to link photos to albums
ALTER TABLE public.photos
ADD COLUMN IF NOT EXISTS album_id bigint REFERENCES public.albums(id) ON DELETE CASCADE;

COMMENT ON COLUMN public.photos.album_id IS 'Album this photo belongs to';

-- Add position column for ordering photos within an album
ALTER TABLE public.photos
ADD COLUMN IF NOT EXISTS position integer DEFAULT 0;

COMMENT ON COLUMN public.photos.position IS 'Display order within the album';

-- Add metadata column (JSONB for flexible metadata storage)
ALTER TABLE public.photos
ADD COLUMN IF NOT EXISTS metadata jsonb;

COMMENT ON COLUMN public.photos.metadata IS 'Flexible metadata storage (source, upload info, etc.)';

-- Add thumbnail_url column
ALTER TABLE public.photos
ADD COLUMN IF NOT EXISTS thumbnail_url text;

COMMENT ON COLUMN public.photos.thumbnail_url IS 'URL of the thumbnail version';

-- Add updated_at column
ALTER TABLE public.photos
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

COMMENT ON COLUMN public.photos.updated_at IS 'Last update timestamp';

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_photos_user_id ON public.photos(user_id);
CREATE INDEX IF NOT EXISTS idx_photos_album_id ON public.photos(album_id);
CREATE INDEX IF NOT EXISTS idx_photos_created_at ON public.photos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_photos_position ON public.photos(album_id, position);

-- Create index on metadata for JSON queries
CREATE INDEX IF NOT EXISTS idx_photos_metadata ON public.photos USING gin(metadata);

-- ============================================================================
-- STEP 3: Create PROFILES table (optional, for user metadata)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  bio text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

COMMENT ON TABLE public.profiles IS 'User profile information';

-- Create index on created_at
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles(created_at DESC);

-- ============================================================================
-- STEP 4: Backfill existing data (IMPORTANT FOR EXISTING DATA)
-- ============================================================================

-- OPTION A: If you want to assign all existing albums/photos to a specific user
-- Uncomment and replace 'YOUR_USER_UUID_HERE' with an actual user UUID from auth.users

-- UPDATE public.albums
-- SET user_id = 'YOUR_USER_UUID_HERE'::uuid
-- WHERE user_id IS NULL;

-- UPDATE public.photos
-- SET user_id = 'YOUR_USER_UUID_HERE'::uuid
-- WHERE user_id IS NULL;

-- OPTION B: If you want to delete orphaned records without a user
-- Uncomment these lines to remove data that has no owner

-- DELETE FROM public.albums WHERE user_id IS NULL;
-- DELETE FROM public.photos WHERE user_id IS NULL;

-- NOTE: Choose ONE option above before proceeding to make user_id NOT NULL

-- ============================================================================
-- STEP 5: Make user_id NOT NULL (after backfilling data)
-- ============================================================================

-- IMPORTANT: Only run these after backfilling data in STEP 4
-- Uncomment when ready:

-- ALTER TABLE public.albums ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE public.photos ALTER COLUMN user_id SET NOT NULL;

-- ============================================================================
-- STEP 6: Create updated_at trigger function
-- ============================================================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to albums table
DROP TRIGGER IF EXISTS set_albums_updated_at ON public.albums;
CREATE TRIGGER set_albums_updated_at
  BEFORE UPDATE ON public.albums
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Apply trigger to photos table
DROP TRIGGER IF EXISTS set_photos_updated_at ON public.photos;
CREATE TRIGGER set_photos_updated_at
  BEFORE UPDATE ON public.photos
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Apply trigger to profiles table
DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- STEP 7: Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS (already enabled according to user, but safe to run again)
ALTER TABLE public.albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their own albums" ON public.albums;
DROP POLICY IF EXISTS "Users can insert their own albums" ON public.albums;
DROP POLICY IF EXISTS "Users can update their own albums" ON public.albums;
DROP POLICY IF EXISTS "Users can delete their own albums" ON public.albums;

DROP POLICY IF EXISTS "Users can view their own photos" ON public.photos;
DROP POLICY IF EXISTS "Users can insert their own photos" ON public.photos;
DROP POLICY IF EXISTS "Users can update their own photos" ON public.photos;
DROP POLICY IF EXISTS "Users can delete their own photos" ON public.photos;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- ============================================================================
-- ALBUMS RLS Policies
-- ============================================================================

-- Allow users to view their own albums
CREATE POLICY "Users can view their own albums"
  ON public.albums
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow users to insert their own albums
CREATE POLICY "Users can insert their own albums"
  ON public.albums
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own albums
CREATE POLICY "Users can update their own albums"
  ON public.albums
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own albums
CREATE POLICY "Users can delete their own albums"
  ON public.albums
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- PHOTOS RLS Policies
-- ============================================================================

-- Allow users to view their own photos
CREATE POLICY "Users can view their own photos"
  ON public.photos
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow users to insert their own photos
CREATE POLICY "Users can insert their own photos"
  ON public.photos
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own photos
CREATE POLICY "Users can update their own photos"
  ON public.photos
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own photos
CREATE POLICY "Users can delete their own photos"
  ON public.photos
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- PROFILES RLS Policies
-- ============================================================================

-- Allow users to view their own profile
CREATE POLICY "Users can view their own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Allow users to insert their own profile
CREATE POLICY "Users can insert their own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================================================
-- STEP 8: Storage Bucket Setup (if not already created)
-- ============================================================================

-- Insert photos bucket (safe to run, will skip if exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'photos',
  'photos',
  true,  -- Public bucket for easier access
  52428800,  -- 50MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing storage policies
DROP POLICY IF EXISTS "Authenticated users can upload photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own photos" ON storage.objects;
DROP POLICY IF EXISTS "Public can view photos" ON storage.objects;

-- Allow authenticated users to upload to their own folder
CREATE POLICY "Authenticated users can upload photos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'photos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow users to view their own photos
CREATE POLICY "Users can view their own photos"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'photos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow users to update their own photos
CREATE POLICY "Users can update their own photos"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'photos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow users to delete their own photos
CREATE POLICY "Users can delete their own photos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'photos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow public read access (since bucket is public)
CREATE POLICY "Public can view photos"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'photos');

-- ============================================================================
-- STEP 9: Helper function to create user profile on signup
-- ============================================================================

-- Function to automatically create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- COMPLETED!
-- ============================================================================

-- Summary of changes:
-- ✅ Added user_id to albums and photos tables
-- ✅ Added missing columns: description, cover_image_url, photo_count, status, etc.
-- ✅ Created profiles table
-- ✅ Created indexes for performance
-- ✅ Set up RLS policies for user data isolation
-- ✅ Configured storage bucket policies
-- ✅ Added auto-profile creation on signup

-- IMPORTANT NEXT STEPS:
-- 1. Backfill user_id for existing data (uncomment STEP 4)
-- 2. Make user_id NOT NULL after backfill (uncomment STEP 5)
-- 3. Test the migration in a development environment first
-- 4. Update application code to use new schema

-- ============================================================================
-- ROLLBACK SCRIPT (in case you need to undo)
-- ============================================================================

/*
-- Uncomment to rollback changes

-- Drop triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS set_albums_updated_at ON public.albums;
DROP TRIGGER IF EXISTS set_photos_updated_at ON public.photos;
DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;

-- Drop functions
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.handle_updated_at();

-- Drop RLS policies
DROP POLICY IF EXISTS "Users can view their own albums" ON public.albums;
DROP POLICY IF EXISTS "Users can insert their own albums" ON public.albums;
DROP POLICY IF EXISTS "Users can update their own albums" ON public.albums;
DROP POLICY IF EXISTS "Users can delete their own albums" ON public.albums;

DROP POLICY IF EXISTS "Users can view their own photos" ON public.photos;
DROP POLICY IF EXISTS "Users can insert their own photos" ON public.photos;
DROP POLICY IF EXISTS "Users can update their own photos" ON public.photos;
DROP POLICY IF EXISTS "Users can delete their own photos" ON public.photos;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

DROP POLICY IF EXISTS "Authenticated users can upload photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own photos" ON storage.objects;
DROP POLICY IF EXISTS "Public can view photos" ON storage.objects;

-- Drop profiles table
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Remove columns from albums
ALTER TABLE public.albums DROP COLUMN IF EXISTS user_id;
ALTER TABLE public.albums DROP COLUMN IF EXISTS description;
ALTER TABLE public.albums DROP COLUMN IF EXISTS cover_image_url;
ALTER TABLE public.albums DROP COLUMN IF EXISTS photo_count;
ALTER TABLE public.albums DROP COLUMN IF EXISTS status;
ALTER TABLE public.albums DROP COLUMN IF EXISTS processing_status;
ALTER TABLE public.albums DROP COLUMN IF EXISTS updated_at;

-- Remove columns from photos
ALTER TABLE public.photos DROP COLUMN IF EXISTS user_id;
ALTER TABLE public.photos DROP COLUMN IF EXISTS album_id;
ALTER TABLE public.photos DROP COLUMN IF EXISTS position;
ALTER TABLE public.photos DROP COLUMN IF EXISTS metadata;
ALTER TABLE public.photos DROP COLUMN IF EXISTS thumbnail_url;
ALTER TABLE public.photos DROP COLUMN IF EXISTS updated_at;

-- Drop indexes
DROP INDEX IF EXISTS idx_albums_user_id;
DROP INDEX IF EXISTS idx_albums_status;
DROP INDEX IF EXISTS idx_albums_created_at;
DROP INDEX IF EXISTS idx_photos_user_id;
DROP INDEX IF EXISTS idx_photos_album_id;
DROP INDEX IF EXISTS idx_photos_created_at;
DROP INDEX IF EXISTS idx_photos_position;
DROP INDEX IF EXISTS idx_photos_metadata;
DROP INDEX IF EXISTS idx_profiles_created_at;

*/
