# Favorites Feature - Implementation Guide

## ✅ Implementation Complete!

I've successfully integrated a **full favorites feature** into your Find My Photo project. Here's what was added:

---

## 📁 Files Created/Modified

### 1. **Database Migration** ✅
**File:** `migrations/012_add_favorites_feature.sql`

**What it adds:**
- ✅ `is_favorite` column on `photos` table (boolean)
- ✅ `is_favorite` column on `albums` table (boolean)
- ✅ `favorited_at` timestamp columns (tracks when favorited)
- ✅ Indexes for fast favorite queries
- ✅ Helper functions:
  - `toggle_photo_favorite(photo_id, user_id)` - Toggle photo favorite
  - `toggle_album_favorite(album_id, user_id)` - Toggle album favorite
  - `get_favorite_counts(user_id)` - Get counts
- ✅ View: `user_favorites` - Combined view of all favorites

### 2. **API Routes** ✅

**Created 3 new API endpoints:**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/favorites/photos/[id]` | POST | Toggle photo favorite |
| `/api/favorites/albums/[id]` | POST | Toggle album favorite |
| `/api/favorites` | GET | Get all favorites |

### 3. **UI Components** ✅

**File:** `components/favorite-button.tsx`

A reusable favorite button component with:
- ✅ Heart icon (filled when favorited)
- ✅ Loading state
- ✅ Toast notifications
- ✅ Optimistic UI updates
- ✅ Customizable size, variant, label
- ✅ Works for both photos and albums

### 4. **Dashboard Integration** ✅

**File:** `app/dashboard/page.tsx`

- ✅ Replaced hardcoded "0" with real favorite counts
- ✅ Queries both favorite photos and albums
- ✅ Shows total favorites in stats card

### 5. **Album Page Integration** ✅

**File:** `app/albums/[id]/page.tsx`

- ✅ Replaced static button with `FavoriteButton` component
- ✅ Shows current favorite status
- ✅ Toggles favorite on click
- ✅ Updates dashboard count automatically

---

## 🚀 Setup Instructions

### Step 1: Run the Database Migration

Execute the SQL migration on your Supabase database:

```bash
# Option 1: Copy and paste into Supabase SQL Editor
# Open: migrations/012_add_favorites_feature.sql
# Copy all contents
# Paste into Supabase dashboard → SQL Editor → Run

# Option 2: Use Supabase CLI (if installed)
supabase migration up
```

### Step 2: Verify Migration Success

Run this query in Supabase SQL Editor:

```sql
-- Check if columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'photos'
AND column_name IN ('is_favorite', 'favorited_at');

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'albums'
AND column_name IN ('is_favorite', 'favorited_at');
```

Expected result: 4 rows (2 columns per table)

### Step 3: Test the Feature

#### Test 1: Favorite an Album
```bash
1. Go to an album page: /albums/[id]
2. Click the "Favorite" button
3. Button should fill with red heart ❤️
4. Toast notification: "Added to favorites"
5. Go to dashboard
6. "Favorites" stat should show "1"
```

#### Test 2: Unfavorite an Album
```bash
1. Click "Favorited" button (filled heart)
2. Heart should become outline
3. Toast notification: "Removed from favorites"
4. Dashboard favorites count decreases
```

#### Test 3: API Test
```bash
# Test the API directly
curl -X POST http://localhost:3000/api/favorites/albums/1 \
  -H "Content-Type: application/json" \
  -H "Cookie: your-auth-cookie"

# Expected response:
{
  "success": true,
  "is_favorite": true,
  "album_id": 1
}
```

---

## 🎨 Component Usage

### Basic Usage

```tsx
import { FavoriteButton } from "@/components/favorite-button"

// In your component:
<FavoriteButton
  itemId={photoId}
  itemType="photo"
  initialIsFavorite={photo.is_favorite}
/>
```

### Advanced Usage

```tsx
<FavoriteButton
  itemId={albumId}
  itemType="album"
  initialIsFavorite={album.is_favorite}
  variant="ghost"
  size="icon"
  showLabel={false}
  onToggle={(isFavorite) => {
    console.log("Favorite toggled:", isFavorite)
    // Custom logic here
  }}
/>
```

### Props Reference

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `itemId` | number | required | Photo or album ID |
| `itemType` | "photo" \| "album" | required | Type of item |
| `initialIsFavorite` | boolean | false | Initial favorite state |
| `variant` | "default" \| "outline" \| "ghost" | "outline" | Button style |
| `size` | "default" \| "sm" \| "lg" \| "icon" | "sm" | Button size |
| `showLabel` | boolean | true | Show "Favorite"/"Favorited" text |
| `onToggle` | (isFavorite: boolean) => void | undefined | Callback on toggle |

---

## 📊 Database Schema

### Photos Table (Extended)

```sql
ALTER TABLE photos ADD COLUMN:
- is_favorite BOOLEAN DEFAULT false
- favorited_at TIMESTAMPTZ (nullable)
```

### Albums Table (Extended)

```sql
ALTER TABLE albums ADD COLUMN:
- is_favorite BOOLEAN DEFAULT false
- favorited_at TIMESTAMPTZ (nullable)
```

### Indexes Created

```sql
-- Fast lookups for favorite photos by user
CREATE INDEX idx_photos_is_favorite
ON photos(user_id, is_favorite)
WHERE is_favorite = true;

-- Fast lookups for favorite albums by user
CREATE INDEX idx_albums_is_favorite
ON albums(user_id, is_favorite)
WHERE is_favorite = true;
```

---

## 🔌 API Reference

### Toggle Photo Favorite

```http
POST /api/favorites/photos/:id
Authorization: Cookie-based (automatic)

Response:
{
  "success": true,
  "is_favorite": true,
  "photo_id": 123
}
```

### Toggle Album Favorite

```http
POST /api/favorites/albums/:id
Authorization: Cookie-based (automatic)

Response:
{
  "success": true,
  "is_favorite": true,
  "album_id": 456
}
```

### Get All Favorites

```http
GET /api/favorites
Authorization: Cookie-based (automatic)

Response:
{
  "success": true,
  "favorites": {
    "photos": [
      {
        "id": 123,
        "name": "photo.jpg",
        "file_url": "https://...",
        "is_favorite": true,
        "favorited_at": "2025-01-15T10:30:00Z"
      }
    ],
    "albums": [...]
  },
  "counts": {
    "photos": 5,
    "albums": 2,
    "total": 7
  }
}
```

---

## 🎯 Where to Add Favorite Buttons

### Already Integrated:
- ✅ Album detail page (`/albums/[id]`)
- ✅ Dashboard stats (shows count)

### Suggested Additions:

#### 1. Photo Gallery
Add favorite button to each photo in the gallery:

```tsx
// In components/photo-gallery.tsx or wherever photos are displayed
<FavoriteButton
  itemId={photo.id}
  itemType="photo"
  initialIsFavorite={photo.is_favorite}
  size="icon"
  showLabel={false}
  variant="ghost"
/>
```

#### 2. Album Grid
Add to album cards on dashboard:

```tsx
// In dashboard where albums are displayed
<FavoriteButton
  itemId={album.id}
  itemType="album"
  initialIsFavorite={album.is_favorite}
  size="icon"
  showLabel={false}
/>
```

#### 3. Photo Detail/Lightbox
When viewing a single photo:

```tsx
<FavoriteButton
  itemId={photo.id}
  itemType="photo"
  initialIsFavorite={photo.is_favorite}
  variant="ghost"
/>
```

---

## 🔍 Querying Favorites

### Get All Favorite Photos

```typescript
const { data: favoritePhotos } = await supabase
  .from("photos")
  .select("*")
  .eq("user_id", userId)
  .eq("is_favorite", true)
  .order("favorited_at", { ascending: false })
```

### Get All Favorite Albums

```typescript
const { data: favoriteAlbums } = await supabase
  .from("albums")
  .select("*")
  .eq("user_id", userId)
  .eq("is_favorite", true)
  .order("favorited_at", { ascending: false })
```

### Get Favorite Counts

```typescript
// Count favorite photos
const { count: favoriteCount } = await supabase
  .from("photos")
  .select("*", { count: "exact", head: true })
  .eq("user_id", userId)
  .eq("is_favorite", true)
```

---

## 🎨 UI States

### Button States:

| State | Appearance | Action |
|-------|-----------|--------|
| **Not Favorite** | ♡ Outline heart | Click to favorite |
| **Favorited** | ❤️ Filled red heart | Click to unfavorite |
| **Loading** | Disabled button | Processing... |
| **Error** | Toast notification | Shows error message |

---

## 🚧 Future Enhancements

### Phase 2 Ideas:

1. **Favorites Page** `/favorites`
   - Dedicated page showing all favorites
   - Filter by photos/albums
   - Sort by date favorited

2. **Bulk Favorite Actions**
   - Select multiple photos/albums
   - Favorite/unfavorite all selected

3. **Favorite Collections**
   - Create custom collections from favorites
   - Group favorites by category

4. **Smart Favorites**
   - Auto-suggest photos to favorite
   - Based on view frequency

5. **Favorite Analytics**
   - Track most favorited items
   - Time-based favorite trends

---

## 🐛 Troubleshooting

### Issue: Button doesn't change state

**Solution:**
- Check browser console for errors
- Verify migration ran successfully
- Check API endpoint is returning correct response

### Issue: Dashboard shows "0" favorites

**Solution:**
- Verify `is_favorite` column exists
- Check if items are actually favorited (query database)
- Refresh dashboard page

### Issue: "Unauthorized" error

**Solution:**
- Verify user is logged in
- Check Supabase session is valid
- Verify RLS policies allow favorite updates

### Issue: Favorite doesn't persist

**Solution:**
- Check database update is successful
- Verify `favorited_at` timestamp is set
- Check for SQL errors in Supabase logs

---

## ✅ Testing Checklist

- [ ] Migration ran successfully
- [ ] `is_favorite` columns exist on both tables
- [ ] Can favorite an album
- [ ] Can unfavorite an album
- [ ] Dashboard shows correct favorite count
- [ ] Toast notifications appear
- [ ] Button state updates immediately
- [ ] Favorite persists after page refresh
- [ ] API endpoints return correct responses
- [ ] Works for both photos and albums

---

## 📝 Summary

You now have a fully functional favorites system with:

✅ Database schema with proper indexing
✅ API routes for favorite operations
✅ Reusable UI component
✅ Dashboard integration
✅ Album page integration
✅ Toast notifications
✅ Optimistic UI updates
✅ Error handling

**Next Steps:**
1. Run the migration
2. Test favoriting an album
3. Add favorite buttons to more places (photo gallery, album grid, etc.)
4. Consider building a dedicated `/favorites` page

---

**Need Help?**
- Check Supabase logs for database errors
- Review browser console for client-side errors
- Verify RLS policies allow favorite updates
- Test API endpoints directly with curl/Postman

**Implementation Date:** 2025-01-15
**Status:** Ready for Testing 🚀
