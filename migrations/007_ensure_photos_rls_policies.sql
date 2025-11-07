-- Ensure proper RLS policies for photos table
-- These policies allow users to read their own photos

-- First, check if policies exist
DO $$
BEGIN
    -- Enable RLS if not already enabled
    ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'RLS enabled on photos table';
END $$;

-- Drop existing policies if they exist (to recreate them)
DROP POLICY IF EXISTS "Users can view their own photos" ON public.photos;
DROP POLICY IF EXISTS "Users can insert their own photos" ON public.photos;
DROP POLICY IF EXISTS "Users can update their own photos" ON public.photos;
DROP POLICY IF EXISTS "Users can delete their own photos" ON public.photos;

-- Create SELECT policy - Users can view their own photos
CREATE POLICY "Users can view their own photos"
ON public.photos
FOR SELECT
USING (auth.uid() = user_id);

-- Create INSERT policy - Users can insert their own photos
CREATE POLICY "Users can insert their own photos"
ON public.photos
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create UPDATE policy - Users can update their own photos
CREATE POLICY "Users can update their own photos"
ON public.photos
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create DELETE policy - Users can delete their own photos
CREATE POLICY "Users can delete their own photos"
ON public.photos
FOR DELETE
USING (auth.uid() = user_id);

-- Verify policies were created
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'photos'
ORDER BY policyname;
