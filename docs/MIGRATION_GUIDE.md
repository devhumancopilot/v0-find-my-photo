# Migration Guide: Multi-User Schema & RLS Setup

## 🎯 Overview

This guide will help you migrate your FindMyPhoto database from the basic schema to a full multi-user schema with Row Level Security (RLS) policies.

---

## 📋 What Changed

### Database Schema Extensions

**ALBUMS Table - New Columns:**
- `user_id` - Owner of the album (UUID, references auth.users)
- `description` - User's search query/description
- `cover_image_url` - Cover image URL
- `photo_count` - Number of photos in album
- `status` - Album status (pending/active/archived)
- `processing_status` - AI workflow status (pending/processing/completed/failed)
- `updated_at` - Last update timestamp

**PHOTOS Table - New Columns:**
- `user_id` - Owner of the photo (UUID, references auth.users)
- `album_id` - Album this photo belongs to (references albums.id)
- `position` - Display order within album
- `metadata` - JSONB for flexible metadata (source type, upload info, etc.)
- `thumbnail_url` - Thumbnail image URL
- `updated_at` - Last update timestamp

**PROFILES Table - New Table:**
- `id` - User ID (UUID, references auth.users)
- `display_name` - User's display name
- `avatar_url` - User's avatar URL
- `bio` - User biography
- `created_at` - Account creation date
- `updated_at` - Last update timestamp

---

## 🚀 Migration Steps

### Step 1: Backup Your Database (CRITICAL!)

Before running any migration, **backup your data**:

\`\`\`bash
# Using Supabase CLI
supabase db dump > backup_$(date +%Y%m%d_%H%M%S).sql

# Or from Supabase Dashboard:
# Settings > Database > Database Backups > Create Backup
\`\`\`

### Step 2: Run the Migration Script

The migration script is located at:
\`\`\`
migrations/001_extend_schema_for_multi_user.sql
\`\`\`

**Option A: Run via Supabase Dashboard (Recommended)**

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy and paste the contents of `001_extend_schema_for_multi_user.sql`
5. **Review the script carefully**
6. Click **Run**

**Option B: Run via Supabase CLI**

\`\`\`bash
supabase db push --db-url "your_database_url"
# Or
psql -h your_host -U postgres -d postgres -f migrations/001_extend_schema_for_multi_user.sql
\`\`\`

### Step 3: Backfill Existing Data (IMPORTANT!)

If you have existing albums or photos, you **must** assign them to a user before making `user_id` NOT NULL.

**Find your user ID:**

\`\`\`sql
-- List all users
SELECT id, email FROM auth.users;
\`\`\`

**Choose ONE option:**

**Option A: Assign all data to a specific user**

Edit the migration script and uncomment these lines (around line 175):

\`\`\`sql
UPDATE public.albums
SET user_id = 'YOUR_USER_UUID_HERE'::uuid
WHERE user_id IS NULL;

UPDATE public.photos
SET user_id = 'YOUR_USER_UUID_HERE'::uuid
WHERE user_id IS NULL;
\`\`\`

Replace `YOUR_USER_UUID_HERE` with your actual user UUID, then run:

\`\`\`sql
-- Make user_id required
ALTER TABLE public.albums ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.photos ALTER COLUMN user_id SET NOT NULL;
\`\`\`

**Option B: Delete orphaned data (use with caution!)**

If you want to start fresh:

\`\`\`sql
DELETE FROM public.albums WHERE user_id IS NULL;
DELETE FROM public.photos WHERE user_id IS NULL;

-- Then make user_id required
ALTER TABLE public.albums ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.photos ALTER COLUMN user_id SET NOT NULL;
\`\`\`

### Step 4: Verify the Migration

Run these queries to verify everything is working:

\`\`\`sql
-- Check albums table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'albums';

-- Check photos table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'photos';

-- Check RLS policies
SELECT tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public';

-- Test queries (should return data)
SELECT * FROM albums LIMIT 5;
SELECT * FROM photos LIMIT 5;
SELECT * FROM profiles LIMIT 5;
\`\`\`

### Step 5: Test Your Application

1. **Start your development server:**
   \`\`\`bash
   npm run dev
   \`\`\`

2. **Test authentication:**
   - Sign in with your account
   - Verify you can see the dashboard

3. **Test Create Album workflow:**
   - Go to `/create-album`
   - Enter a description and album title
   - Click "Find Photos"
   - Verify the POST request succeeds
   - Check the database for the new album record

4. **Test Photo Upload:**
   - Go to `/upload-photos`
   - Upload a test photo
   - Verify it appears in the dashboard

5. **Check RLS policies:**
   - Sign in with User A, create an album
   - Sign in with User B, verify you can't see User A's albums
   - This confirms user isolation is working

---

## 🔧 Code Changes Made

All code has been updated to match the new schema:

### 1. `app/api/webhooks/album-create-request/route.ts`
- ✅ Changed `user_description` → `description`
- ✅ Added `status: "pending"`
- ✅ Added `photo_count: 0`
- ✅ Added `processing_status: "pending"`

### 2. `app/api/webhooks/album-finalized/route.ts`
- ✅ Changed `title` → `album_title`
- ✅ Added `processing_status: "completed"`
- ✅ Changed `image_url` → `file_url` in photo records
- ✅ Added required `name` field to photos
- ✅ Added `album_id`, `user_id`, `position` to photos

### 3. `app/api/webhooks/photos-uploaded/route.ts`
- ✅ Changed `image_url` → `file_url`
- ✅ Added required `name` field
- ✅ Added `type` and `size` fields
- ✅ Now properly stores `metadata` as JSONB

### 4. `app/dashboard/page.tsx`
- ✅ Changed `album.title` → `album.album_title`
- ✅ `profiles` table query now works (table created by migration)
- ✅ User filtering on albums works (user_id column exists)

### 5. `app/create-album/page.tsx`
- ✅ Now sends `albumTitle` in POST request
- ✅ Webhook payload includes structured `user` object

---

## 🔒 RLS (Row Level Security) Policies

The migration automatically creates these policies:

### Albums Table
- ✅ Users can view their own albums
- ✅ Users can insert their own albums
- ✅ Users can update their own albums
- ✅ Users can delete their own albums

### Photos Table
- ✅ Users can view their own photos
- ✅ Users can insert their own photos
- ✅ Users can update their own photos
- ✅ Users can delete their own photos

### Profiles Table
- ✅ Users can view their own profile
- ✅ Users can insert their own profile
- ✅ Users can update their own profile

### Storage Bucket (photos)
- ✅ Authenticated users can upload to their own folder (`{user_id}/...`)
- ✅ Users can view their own photos in storage
- ✅ Public read access for all photos (since bucket is public)

---

## 🧪 Testing RLS Policies

### Test User Isolation

\`\`\`sql
-- As User A (replace with your UUID)
SET request.jwt.claims TO '{"sub": "user-a-uuid"}';

-- Insert test album
INSERT INTO albums (user_id, album_title, status)
VALUES ('user-a-uuid'::uuid, 'User A Album', 'active');

-- Switch to User B
SET request.jwt.claims TO '{"sub": "user-b-uuid"}';

-- Try to select User A's album (should return nothing)
SELECT * FROM albums WHERE album_title = 'User A Album';

-- Insert User B's album
INSERT INTO albums (user_id, album_title, status)
VALUES ('user-b-uuid'::uuid, 'User B Album', 'active');

-- Should only see User B's album
SELECT * FROM albums;
\`\`\`

---

## 📊 n8n Webhook Payload Update

Your n8n workflows now receive this payload structure:

### Step 1: Find Photos Webhook

\`\`\`json
{
  "user": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "email": "user@example.com"
  },
  "albumTitle": "Summer Beach Trip 2024",
  "query": "Photos from my beach vacation with palm trees",
  "requestId": 42,
  "timestamp": "2025-01-15T14:22:00.000Z"
}
\`\`\`

### Step 3: Album Finalized Webhook

\`\`\`json
{
  "userId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "albumId": 15,
  "title": "Summer Beach Trip 2024",
  "photoCount": 12,
  "timestamp": "2025-01-15T14:30:00.000Z"
}
\`\`\`

**Update your n8n workflows to:**
1. Extract `user.id` and `user.email` instead of just `userId`
2. Handle the `albumTitle` field
3. Use the structured user object for personalization

---

## 🐛 Troubleshooting

### Issue: "permission denied for table albums"

**Cause:** RLS policies are blocking access

**Solution:**
\`\`\`sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' AND tablename IN ('albums', 'photos');

-- Verify policies exist
SELECT * FROM pg_policies WHERE tablename = 'albums';

-- Temporarily disable RLS for testing (NOT for production!)
ALTER TABLE albums DISABLE ROW LEVEL SECURITY;
\`\`\`

### Issue: "null value in column 'user_id' violates not-null constraint"

**Cause:** Trying to insert without user_id, or user_id is null

**Solution:**
\`\`\`sql
-- Make user_id nullable temporarily
ALTER TABLE albums ALTER COLUMN user_id DROP NOT NULL;

-- Fix your code to always include user_id in INSERT
-- Then make it NOT NULL again
ALTER TABLE albums ALTER COLUMN user_id SET NOT NULL;
\`\`\`

### Issue: "relation 'profiles' does not exist"

**Cause:** Migration didn't run completely

**Solution:**
\`\`\`sql
-- Manually create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  bio text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
\`\`\`

### Issue: Photos not showing in dashboard

**Cause:** RLS blocking queries or wrong field names

**Solution:**
1. Check if `user_id` matches in photos table
2. Verify you're using `file_url` not `image_url`
3. Check browser console for errors
4. Test query manually:

\`\`\`sql
-- As authenticated user
SELECT * FROM photos WHERE user_id = auth.uid();
\`\`\`

---

## 📝 Database Schema Reference

### Complete Albums Table Schema

\`\`\`sql
CREATE TABLE public.albums (
  id bigint PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
  created_at timestamptz NOT NULL DEFAULT now(),
  album_title text,
  photos text[],
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description text,
  cover_image_url text,
  photo_count integer DEFAULT 0,
  status text DEFAULT 'active' CHECK (status IN ('pending', 'active', 'archived')),
  processing_status text DEFAULT 'completed' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  updated_at timestamptz DEFAULT now()
);
\`\`\`

### Complete Photos Table Schema

\`\`\`sql
CREATE TABLE public.photos (
  id bigserial PRIMARY KEY,
  name text NOT NULL,
  file_url text,
  type text,
  size numeric,
  caption text,
  embedding vector,
  created_at timestamp DEFAULT now(),
  data text,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  album_id bigint REFERENCES public.albums(id) ON DELETE CASCADE,
  position integer DEFAULT 0,
  metadata jsonb,
  thumbnail_url text,
  updated_at timestamptz DEFAULT now()
);
\`\`\`

---

## 🔄 Rollback Instructions

If something goes wrong, you can rollback using the script at the bottom of the migration file:

\`\`\`sql
-- Uncomment the rollback section in 001_extend_schema_for_multi_user.sql
-- Then run it in SQL Editor
\`\`\`

Or restore from your backup:

\`\`\`bash
psql -h your_host -U postgres -d postgres < backup_file.sql
\`\`\`

---

## ✅ Checklist

- [ ] Backed up database
- [ ] Reviewed migration script
- [ ] Ran migration in development environment first
- [ ] Backfilled user_id for existing data
- [ ] Made user_id NOT NULL
- [ ] Verified RLS policies are working
- [ ] Tested authentication flow
- [ ] Tested Create Album workflow
- [ ] Tested Photo Upload
- [ ] Tested Dashboard displays correctly
- [ ] Updated n8n workflows to handle new payload structure
- [ ] Deployed to production

---

## 📞 Support

If you encounter any issues:

1. Check the troubleshooting section above
2. Review Supabase logs in Dashboard > Logs
3. Test queries manually in SQL Editor
4. Verify RLS policies with `SELECT * FROM pg_policies`

---

## 🎉 Success!

Once migration is complete, your application will have:

✅ **Multi-user support** - Each user has their own isolated data
✅ **Proper RLS policies** - Data security enforced at database level
✅ **Complete schema** - All fields needed for full functionality
✅ **n8n integration** - Correct payload structure for workflows
✅ **Type safety** - All fields match TypeScript types

Your Create Album workflow now properly sends:
- ✅ User information (ID + email)
- ✅ Album title
- ✅ Search query
- ✅ All metadata to n8n webhook

Happy coding! 🚀
