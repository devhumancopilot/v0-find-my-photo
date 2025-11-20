# Vercel Blob Storage Setup Guide

This guide explains how to enable Vercel Blob storage for photo uploads to bypass the 4MB serverless function payload limit.

## Problem

When deploying to Vercel, serverless functions have a **4MB request/response body limit**. Uploading large photos (>4MB) causes a `FUNCTION_PAYLOAD_TOO_LARGE` error.

## Solution

**Vercel Blob** allows client-side uploads that bypass the serverless function entirely. Files upload directly from the browser to Vercel's CDN, with these benefits:

- ✅ No 4MB limit (supports files up to 512MB+)
- ✅ No data transfer charges for client uploads
- ✅ Secure token-based authentication
- ✅ Fast global CDN delivery
- ✅ Automatic cleanup on delete

## Setup Instructions

### 1. Create a Vercel Blob Store

1. Go to your Vercel Dashboard: https://vercel.com/dashboard
2. Navigate to **Storage** → **Create Database** → **Blob**
3. Choose a name for your store (e.g., "findmyphoto-photos")
4. Click **Create**
5. Copy the `BLOB_READ_WRITE_TOKEN` from the store settings

### 2. Add Environment Variables

Add these variables to your Vercel project:

**In Vercel Dashboard:**
1. Go to your project → **Settings** → **Environment Variables**
2. Add the following:

```env
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxxxxxxxxx
NEXT_PUBLIC_ENABLE_VERCEL_BLOB=true
```

**In Local Development (.env.local):**

```env
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxxxxxxxxx
NEXT_PUBLIC_ENABLE_VERCEL_BLOB=true
```

### 3. Deploy or Restart

- **Vercel**: Redeploy your application or let it auto-deploy
- **Local**: Restart your development server (`npm run dev`)

## How It Works

### Upload Flow

1. **User selects photos** on the upload page
2. **Client requests upload token** from `/api/upload/token`
3. **Server validates user** and generates secure token
4. **Client uploads directly to Vercel Blob** using token (bypasses serverless function)
5. **Server saves blob URL** to database via `/api/photos/save-blob`
6. **Photos added to processing queue** for AI features

### Architecture

```
┌─────────────┐                    ┌──────────────────┐
│   Browser   │◄──── Token ────────│  /api/upload/    │
│             │      Request       │     token        │
└──────┬──────┘                    └────────┬─────────┘
       │                                    │
       │ 1. Request Token                   │ 2. Validate User
       │                                    │    Generate Token
       │◄──────────────────────────────────┘
       │
       │ 3. Upload File Directly
       │    (Bypasses Serverless Function)
       ▼
┌─────────────────┐                ┌──────────────────┐
│  Vercel Blob    │                │  /api/photos/    │
│    Storage      │────────────────►  save-blob       │
└─────────────────┘                └────────┬─────────┘
                                            │
                     4. Save URL            │ 5. Create DB Record
                        to Database         │    Add to Queue
                                            ▼
                                   ┌──────────────────┐
                                   │   Supabase DB    │
                                   │   + Queue        │
                                   └──────────────────┘
```

## Dual Storage Support

The app supports **both** Vercel Blob and Supabase Storage simultaneously:

- **New uploads**: Use Vercel Blob (when `NEXT_PUBLIC_ENABLE_VERCEL_BLOB=true`)
- **Existing photos**: Remain in Supabase Storage
- **Delete operation**: Automatically detects storage type and deletes accordingly

### Switching Between Storage Types

**Enable Vercel Blob:**
```env
NEXT_PUBLIC_ENABLE_VERCEL_BLOB=true
```

**Disable Vercel Blob (use Supabase Storage):**
```env
NEXT_PUBLIC_ENABLE_VERCEL_BLOB=false
```

No code changes needed - the app detects the environment variable.

## File Size Limits

| Storage Type       | Max File Size | Limit Type |
|--------------------|---------------|------------|
| Supabase Storage   | 50MB          | Per file   |
| Vercel Blob        | 100MB*        | Per upload |

*Configurable in `/app/api/upload/token/route.ts` (line 44)

For files >100MB, you can increase the limit or implement multipart uploads.

## Security Features

✅ **Server-side token generation** - BLOB_READ_WRITE_TOKEN never exposed to client
✅ **User authentication** - Only authenticated users can upload
✅ **File type validation** - Only image files allowed
✅ **File size validation** - Configurable limits
✅ **Ownership verification** - Users can only delete their own photos

## API Routes

### Upload Token Generation
**Route:** `/app/api/upload/token/route.ts`
**Method:** POST
**Purpose:** Generate secure upload tokens for client-side uploads
**Security:** Validates user auth, file type, and size

### Save Blob URLs
**Route:** `/app/api/photos/save-blob/route.ts`
**Method:** POST
**Purpose:** Save uploaded blob URLs to database
**Creates:** Photo record + processing queue entry

### Photo Delete
**Route:** `/app/api/photos/delete/route.ts`
**Method:** DELETE
**Purpose:** Delete photos from storage and database
**Supports:** Both Vercel Blob and Supabase Storage

## Testing

### Test with Various File Sizes

1. **Small file (<1MB)**: Should upload instantly
2. **Medium file (4-10MB)**: Previously failed, now succeeds
3. **Large file (>10MB)**: Succeeds with Vercel Blob, fails with Supabase
4. **Very large file (>50MB)**: Test the 100MB limit

### Verify Upload Method

Check browser console logs:
- Vercel Blob: `[Upload] Using Vercel Blob for uploads`
- Supabase: `[Upload] Using FormData upload (Supabase Storage)`

### Test Delete Functionality

1. Upload photos via Vercel Blob
2. Navigate to photos page
3. Delete a photo
4. Check console for storage cleanup logs
5. Verify file no longer accessible at blob URL

## Troubleshooting

### Error: "Upload token generation failed"

**Cause:** Missing or invalid `BLOB_READ_WRITE_TOKEN`
**Solution:**
1. Verify token is set in environment variables
2. Ensure token starts with `vercel_blob_rw_`
3. Regenerate token if needed from Vercel Dashboard

### Error: "Only image files are allowed"

**Cause:** Attempting to upload non-image files
**Solution:** Only select image files (JPG, PNG, GIF, WebP)

### Error: "File size exceeds 100MB limit"

**Cause:** File is too large
**Solution:**
1. Reduce file size or
2. Increase limit in `/app/api/upload/token/route.ts` (line 44)

### Photos not appearing after upload

**Cause:** Database save failed
**Check:**
1. Browser console for errors
2. Vercel function logs for `/api/photos/save-blob` errors
3. Supabase logs for database errors

### Delete not working for Vercel Blob photos

**Cause:** Invalid BLOB_READ_WRITE_TOKEN for delete operations
**Solution:** Ensure token has write permissions (should start with `vercel_blob_rw_`)

## Cost Considerations

### Vercel Blob Pricing (as of 2024)

- **Storage**: $0.15/GB/month
- **Data transfer**:
  - Client uploads: **FREE** ✅
  - Server uploads: Charged
  - Downloads: Charged
- **Operations**: Free for most operations including delete

### Cost Comparison

| Scenario | Supabase Storage | Vercel Blob |
|----------|------------------|-------------|
| 1000 photos @ 5MB each | ~$0.75/month | ~$0.75/month |
| Upload bandwidth | Charged via Vercel | **FREE** ✅ |
| Download bandwidth | Free (public bucket) | Charged |

**Recommendation:** Use Vercel Blob for uploads, keep frequently accessed photos in CDN cache.

## Migration Path (Optional)

To migrate existing Supabase photos to Vercel Blob:

1. Create a migration script that:
   - Fetches all photos from Supabase Storage
   - Uploads them to Vercel Blob
   - Updates `file_url` in database
   - Deletes from Supabase Storage

**Note:** This is optional. The dual storage approach works well for most use cases.

## Additional Resources

- [Vercel Blob Documentation](https://vercel.com/docs/storage/vercel-blob)
- [Vercel Blob Client SDK](https://vercel.com/docs/storage/vercel-blob/using-blob-sdk)
- [Vercel Blob Pricing](https://vercel.com/docs/storage/vercel-blob#pricing)
- [Vercel Function Limits](https://vercel.com/docs/functions/limits)

## Support

If you encounter issues:

1. Check Vercel function logs in dashboard
2. Check browser console for client errors
3. Verify environment variables are set correctly
4. Ensure @vercel/blob package is installed (`npm list @vercel/blob`)

## Summary

Vercel Blob solves the 4MB upload limit by enabling client-side uploads. Setup is simple:

1. ✅ Create Blob store in Vercel Dashboard
2. ✅ Add `BLOB_READ_WRITE_TOKEN` to environment variables
3. ✅ Set `NEXT_PUBLIC_ENABLE_VERCEL_BLOB=true`
4. ✅ Redeploy and test

Your users can now upload large photos without errors!
