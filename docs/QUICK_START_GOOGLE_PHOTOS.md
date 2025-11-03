# Quick Start: Google Photos Integration

This guide will get you up and running with Google Photos integration in **under 15 minutes**.

## Prerequisites

- [x] FindMyPhoto project already running locally
- [x] Supabase project set up
- [ ] Google account
- [ ] 10-15 minutes

## Step 1: Apply Database Migration (2 minutes)

1. Open Supabase Dashboard: https://supabase.com/dashboard
2. Go to your project → **SQL Editor**
3. Open the migration file: `migrations/002_add_google_photos_integration.sql`
4. Copy the entire SQL content
5. Paste into Supabase SQL Editor
6. Click **Run**
7. Verify success (should see "Success. No rows returned")

## Step 2: Set Up Google Cloud Console (5 minutes)

### Create Project & Enable API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project or select existing
3. Go to **APIs & Services > Library**
4. Search: "Google Photos Picker API"
5. Click **Enable**

### Configure OAuth Consent Screen

1. Go to **APIs & Services > OAuth consent screen**
2. Choose **External** → Click **Create**
3. Fill in:
   - App name: `FindMyPhoto`
   - User support email: Your email
   - Developer contact: Your email
4. Click **Save and Continue**
5. On "Scopes" page:
   - Click **Add or Remove Scopes**
   - Search: `photospicker.mediaitems.readonly`
   - Select it
   - Click **Update**
   - Click **Save and Continue**
6. On "Test users":
   - Click **Add Users**
   - Add your email
   - Click **Save and Continue**
7. Click **Back to Dashboard**

### Create OAuth Credentials

1. Go to **APIs & Services > Credentials**
2. Click **Create Credentials > OAuth client ID**
3. Application type: **Web application**
4. Name: `FindMyPhoto Web Client`
5. Authorized JavaScript origins:
   - Add: `http://localhost:3000`
6. Authorized redirect URIs:
   - Add: `http://localhost:3000/api/auth/google/callback`
7. Click **Create**
8. **SAVE YOUR CREDENTIALS:**
   - Copy **Client ID**
   - Copy **Client Secret**

## Step 3: Update Environment Variables (1 minute)

Open `.env.local` and add:

\`\`\`env
# Google Photos Picker API Configuration
NEXT_PUBLIC_GOOGLE_CLIENT_ID=paste-your-client-id-here
GOOGLE_CLIENT_SECRET=paste-your-client-secret-here
NEXT_PUBLIC_GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
\`\`\`

## Step 4: Restart Development Server (1 minute)

\`\`\`bash
# Stop the server (Ctrl+C)
npm run dev
\`\`\`

## Step 5: Test the Integration (5 minutes)

### Test OAuth Connection

1. Open http://localhost:3000
2. Sign in to your account
3. Go to **Upload Photos** page
4. You should see a new section: "Import from Google Photos"
5. Click **"Select from Google Photos"**
6. You'll be redirected to Google OAuth
7. Sign in with your Google account
8. Click **Allow** to grant permissions
9. You'll be redirected back to upload page
10. Success message should appear: "Google Photos connected successfully!"

### Test Photo Selection

1. Click **"Select from Google Photos"** again
2. A popup window opens showing Google Photos Picker
3. Browse your Google Photos library
4. Select a few photos (click to select)
5. Click **Done** at the top right
6. Popup closes automatically
7. Selected photos appear in "Google Photos Selection" section
8. Thumbnails load from Google Photos

### Test Upload

1. You should see:
   - Selected Google Photos with thumbnails
   - Photo count: "X photos selected from Google Photos"
2. Click **"Upload All Photos"**
3. Progress bar appears
4. Success! Redirected to dashboard
5. Your imported photos are now in your library

## Troubleshooting

### "redirect_uri_mismatch" error
**Solution:** In Google Cloud Console, verify redirect URI is exactly:
\`\`\`
http://localhost:3000/api/auth/google/callback
\`\`\`
(No trailing slash, exact URL)

### Popup blocked
**Solution:** Enable popups for `localhost:3000` in your browser settings

### "Google Photos not connected" error
**Solution:**
1. Check `.env.local` has correct credentials
2. Restart dev server after adding credentials
3. Clear browser cache and try again

### Photos don't load
**Solution:**
1. Check browser console for errors
2. Verify Google Photos Picker API is enabled
3. Ensure OAuth token is valid (re-authenticate)

### Can't find Google Photos Picker API
**Solution:**
- Make sure you search "Google Photos Picker API" (not "Google Picker API")
- It's different from the deprecated Google Picker API

## Production Deployment

When deploying to production:

1. Add production domain to Google Cloud Console:
   - Authorized JavaScript origins: `https://yourdomain.com`
   - Authorized redirect URIs: `https://yourdomain.com/api/auth/google/callback`

2. Update environment variables:
   \`\`\`env
   NEXT_PUBLIC_GOOGLE_REDIRECT_URI=https://yourdomain.com/api/auth/google/callback
   \`\`\`

3. Publish OAuth app (for public access):
   - Go to OAuth consent screen
   - Click "Publish App"
   - Submit for Google verification (if needed)

## What's Next?

- [x] Integration working
- [ ] Import your photos from Google Photos
- [ ] Create albums with imported photos
- [ ] Explore automatic photo processing

## Need More Details?

- **Setup Guide:** `GOOGLE_PHOTOS_SETUP.md` (detailed instructions)
- **Implementation Docs:** `GOOGLE_PHOTOS_IMPLEMENTATION.md` (technical details)
- **README:** Updated with Google Photos info

## Common Questions

**Q: Is this free?**
A: Yes, Google Photos Picker API is free within standard quotas.

**Q: Are my photos uploaded to your server?**
A: No, only metadata is stored. Photos remain in your Google Photos account.

**Q: Can I revoke access?**
A: Yes, go to Google Account → Security → Third-party apps → FindMyPhoto → Remove access

**Q: Do photo URLs expire?**
A: Yes, after 60 minutes. The app handles this automatically.

**Q: Can I import albums?**
A: Yes, you can select entire albums in the picker.

**Q: How many photos can I select at once?**
A: No documented limit, but performance is best under 100 photos per session.

## Success Checklist

- [x] Database migration applied
- [x] Google Cloud project created
- [x] Google Photos Picker API enabled
- [x] OAuth consent screen configured
- [x] OAuth credentials created
- [x] Environment variables set
- [x] Dev server restarted
- [x] OAuth connection tested
- [x] Photo selection tested
- [x] Upload tested
- [x] Photos appear in dashboard

Congratulations! Google Photos integration is working!

---

**Need Help?** Check the troubleshooting section above or refer to the detailed setup guide.

**Having Issues?** Open an issue with:
- Browser console errors
- Network tab screenshots
- Steps to reproduce
