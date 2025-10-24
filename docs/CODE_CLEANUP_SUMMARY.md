# Code Cleanup Summary

## ✅ Changes Completed

### 1. **Removed Supabase Data Insertion from Manual Photo Upload**

**File:** `app/api/webhooks/photos-uploaded/route.ts`

**What Was Removed:**
```typescript
// ❌ REMOVED - Database insertion (now handled by n8n)
const { error: dbError } = await supabase.from("photos").insert({
  user_id: user.id,
  name: file.name,
  file_url: publicUrl,
  thumbnail_url: publicUrl,
  type: file.type,
  size: file.size,
  metadata: {
    source_type: "manual_upload",
    original_name: file.name,
    file_size: file.size,
    mime_type: file.type,
    uploaded_at: new Date().toISOString(),
  },
})
```

**Current Behavior:**
- ✅ Uploads files to Supabase Storage (`photos` bucket)
- ✅ Generates public URLs for uploaded files
- ✅ Sends complete payload to n8n webhook (`N8N_WEBHOOK_PHOTO_SOURCE_CONNECTED`)
- ✅ n8n handles all database insertions
- ✅ Cleaner separation of concerns

**n8n Webhook Payload:**
```json
{
  "event": "photos_uploaded",
  "user_id": "uuid",
  "album_title": "My Album",
  "album_description": "Description",
  "uploaded_files": [
    {
      "fileName": "user-id/timestamp-filename.jpg",
      "publicUrl": "https://storage-url/...",
      "originalName": "filename.jpg",
      "size": 123456,
      "type": "image/jpeg"
    }
  ],
  "timestamp": "2025-01-15T14:22:00.000Z"
}
```

**Your n8n workflow should:**
1. Receive the `photos_uploaded` webhook
2. Extract file information from `uploaded_files` array
3. Insert records into the `photos` table with:
   - `user_id`
   - `name` (from `originalName`)
   - `file_url` (from `publicUrl`)
   - `type` (from `type`)
   - `size` (from `size`)
   - `metadata` (with source_type, upload info, etc.)

---

### 2. **Removed user-registered API Route**

**File:** `app/api/webhooks/user-registered/route.ts` ❌ **DELETED**

**Reason for Removal:**
- You're using **normal Supabase authentication**
- Profile creation is now handled automatically by database trigger
- The migration script includes `handle_new_user()` function that:
  - Triggers on `auth.users` INSERT
  - Automatically creates a profile in `profiles` table
  - Extracts data from `raw_user_meta_data`

**Migration Script Handles This:**
```sql
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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

**What This Means:**
- ✅ User signs up via Supabase Auth
- ✅ Profile automatically created in `profiles` table
- ✅ No manual API calls needed
- ✅ Works with all Supabase auth methods (email, OAuth, magic link, etc.)

---

## ⚠️ Onboarding Flow - Requires Your Decision

### **File:** `app/api/webhooks/onboarding-completed/route.ts` ⚡ **KEPT (for now)**

**What It Does:**
- Triggered by frontend `/onboarding` page
- Updates user profile timestamp
- Sends `selectedSources` to n8n webhook

**Used By:**
- `app/onboarding/page.tsx` (line 32)

**Your Options:**

#### Option A: Keep Onboarding Flow (Current)
If you have a custom onboarding experience where users:
- Select photo sources
- Configure initial settings
- Complete setup wizard

Then **KEEP** this route and:
- Ensure `N8N_WEBHOOK_ONBOARDING_COMPLETED` is configured
- Your n8n workflow handles the `selectedSources` data

#### Option B: Remove Onboarding Flow
If you don't need custom onboarding:
1. Delete `app/api/webhooks/onboarding-completed/route.ts`
2. Delete or modify `app/onboarding/page.tsx`
3. Remove redirect to `/onboarding` from your auth flow

**Let me know if you want me to remove this too!**

---

## 📊 Updated Architecture

### Photo Upload Flow

**Before:**
```
Frontend → API → Supabase Storage ✅
                → Supabase DB ✅
                → n8n webhook ✅
```

**After (Cleaner):**
```
Frontend → API → Supabase Storage ✅
                → n8n webhook ✅
                     ↓
                  n8n handles DB insertion ✅
```

### User Registration Flow

**Before:**
```
Supabase Auth → Frontend → /api/webhooks/user-registered → profiles table
                                                           → n8n webhook
```

**After (Automated):**
```
Supabase Auth → Database Trigger → profiles table (automatic)
```

---

## 🔧 Environment Variables

Make sure these are configured in your `.env.local`:

```bash
# Required for manual photo upload
N8N_WEBHOOK_PHOTO_SOURCE_CONNECTED=https://your-n8n.com/webhook/photos-uploaded

# Required for Create Album workflow
N8N_WEBHOOK_FIND_PHOTOS=https://your-n8n.com/webhook/find-photos

# Required for finalizing albums
N8N_WEBHOOK_ALBUM_FINALIZED=https://your-n8n.com/webhook/album-finalized

# Optional - if keeping onboarding flow
N8N_WEBHOOK_ONBOARDING_COMPLETED=https://your-n8n.com/webhook/onboarding-completed

# Removed - no longer needed
# N8N_WEBHOOK_USER_REGISTERED (not used anymore)
```

---

## ✅ Testing Checklist

After these changes, test:

1. **User Registration**
   - [ ] Sign up a new user via Supabase Auth
   - [ ] Check that profile is automatically created in `profiles` table
   - [ ] Verify display_name and avatar_url are populated

2. **Manual Photo Upload**
   - [ ] Upload photos via `/upload-photos` page
   - [ ] Verify files appear in Supabase Storage (`photos` bucket)
   - [ ] Check n8n webhook receives the payload
   - [ ] Confirm n8n inserts records into `photos` table
   - [ ] Verify photos appear in dashboard

3. **Create Album Workflow**
   - [ ] Create album via `/create-album` page
   - [ ] Verify album record is created in database
   - [ ] Check n8n webhook receives correct payload with user info and albumTitle

4. **Onboarding Flow** (if keeping)
   - [ ] Complete onboarding as new user
   - [ ] Verify n8n webhook is triggered
   - [ ] Check that selectedSources are processed

---

## 🎯 Benefits of These Changes

1. **Cleaner Code** - Removed duplicate logic
2. **Better Separation** - n8n handles data processing and insertion
3. **Automatic Profiles** - Database trigger creates profiles on signup
4. **Simpler Authentication** - Standard Supabase auth without custom webhooks
5. **Easier Maintenance** - Less code to manage and debug

---

## 📝 Next Steps

1. **Update your n8n workflows** to handle photo metadata insertion
2. **Test user registration** to confirm profiles are auto-created
3. **Test photo uploads** to verify n8n receives and processes files
4. **Decide on onboarding flow** - keep or remove?
5. **Remove unused env variables** - clean up `.env.local`

---

## 🔍 Quick Reference: What Each Route Does Now

| Route | Purpose | Database Write | n8n Webhook |
|-------|---------|----------------|-------------|
| `/api/webhooks/album-create-request` | Step 1 of Create Album | ✅ Creates album record | ✅ Triggers find photos |
| `/api/webhooks/album-finalized` | Step 3 of Create Album | ✅ Creates album + photos | ✅ Notifies completion |
| `/api/webhooks/photos-uploaded` | Manual photo upload | ❌ No (n8n handles) | ✅ Sends file info |
| `/api/webhooks/onboarding-completed` | User onboarding | ✅ Updates profile timestamp | ✅ Sends sources |
| `/api/webhooks/user-registered` | ❌ DELETED | - | - |

---

## 💡 Recommendation

Your current setup is now **cleaner and more maintainable**!

If you don't use the onboarding flow, I recommend deleting it to simplify further. Let me know if you'd like me to remove that too!
