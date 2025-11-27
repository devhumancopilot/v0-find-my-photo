# 🚀 Render Deployment Guide

Complete guide to deploy Find My Photo to Render.

## ✅ Prerequisites

1. [Render account](https://render.com) (free to sign up)
2. GitHub repository with your code
3. All environment variables ready (from `.env` file)

---

## 📋 Step-by-Step Deployment

### Step 1: Prepare Your Repository

1. **Commit all changes:**
   ```bash
   git add .
   git commit -m "feat: add Render configuration and optimizations"
   git push origin main
   ```

2. **Verify `render.yaml` is committed:**
   ```bash
   git ls-files | grep render.yaml
   ```
   Should show: `render.yaml`

---

### Step 2: Create New Web Service on Render

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Select your **FindMyPhoto** repository

---

### Step 3: Configure Service Settings

Render will auto-detect `render.yaml`. Verify these settings:

**Basic Settings:**
- **Name:** `findmyphoto` (or your choice)
- **Region:** Choose closest to your users
  - `oregon` (US West)
  - `ohio` (US East)
  - `frankfurt` (Europe)
  - `singapore` (Asia)
- **Branch:** `main`
- **Runtime:** `Node`

**Build & Deploy:**
- **Build Command:** `pnpm install && pnpm run build`
- **Start Command:** `pnpm start`
- **Root Directory:** (leave blank)

**Instance Type:**
- ⚠️ **IMPORTANT:** Select **Starter ($7/month)** to avoid cold starts
- Free tier has 15-minute sleep = bad UX for photo app

---

### Step 4: Add Environment Variables

Click **"Advanced"** → **"Environment Variables"**

Copy these from your `.env` file:

#### Required Variables:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=https://yourapp.onrender.com/dashboard

# Google OAuth
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
NEXT_PUBLIC_GOOGLE_REDIRECT_URI=https://yourapp.onrender.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# OpenAI
OPENAI_API_KEY=sk-your-openai-api-key

# Hugging Face (if using)
HUGGINGFACE_API_KEY=hf_your-key
HUGGINGFACE_CLIP_ENDPOINT=your-clip-endpoint-url
```

#### Optional Variables (have defaults):

```bash
# Already set in render.yaml, but you can override:
EMBEDDING_PROVIDER=huggingface
VARIABLE_EMBEDDING_DIMENSIONS=true
PHOTO_SEARCH_MIN_SIMILARITY=0.4
ENABLE_VISION_RERANKING=true
VISION_MAX_PHOTOS=50
VISION_MIN_CONFIDENCE=60
VISION_RERANKING_WEIGHT=0.4
CLIP_MIN_SCORE=0.20
CLIP_REFERENCE_WEIGHT=0.5
CLIP_NUM_REFERENCES=3
```

---

### Step 5: Update OAuth Redirect URLs

#### Google OAuth Console:
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to **APIs & Services** → **Credentials**
3. Edit your OAuth 2.0 Client
4. Add to **Authorized redirect URIs:**
   ```
   https://your-app-name.onrender.com
   https://your-app-name.onrender.com/dashboard
   ```

#### Supabase Auth:
1. Go to Supabase Dashboard → **Authentication** → **URL Configuration**
2. Add to **Redirect URLs:**
   ```
   https://your-app-name.onrender.com/dashboard
   ```

---

### Step 6: Deploy!

1. Click **"Create Web Service"**
2. Render will start building your app
3. Watch the build logs (should take 3-5 minutes)
4. Once complete, you'll get a URL: `https://your-app-name.onrender.com`

---

## 🔍 Verify Deployment

### 1. Check Build Logs
Look for:
```
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Creating an optimized production build
```

### 2. Test the App
- [ ] Visit your Render URL
- [ ] Login with Google OAuth
- [ ] Upload 10-20 photos
- [ ] ✅ **Congratulations modal should appear**
- [ ] ✅ **Countdown and redirect should work**
- [ ] Create an album with AI search
- [ ] ✅ **Step 2 should load with suggested photos**

---

## ⚙️ Advanced Configuration

### Enable Higher Vision Processing

On Render, you can process MORE photos with vision AI since there's no 10-second timeout:

**In Render Dashboard → Environment:**
```bash
VISION_MAX_PHOTOS=100  # Or even higher!
```

This means better quality album suggestions!

---

### Custom Domain (Optional)

1. In Render Dashboard → **Settings** → **Custom Domain**
2. Add your domain (e.g., `photos.yourdomain.com`)
3. Update DNS records as instructed
4. Update OAuth redirect URLs to use custom domain

---

## 🐛 Troubleshooting

### Build Fails: "pnpm: command not found"

**Fix:** Add pnpm installation to build command:

In Render Dashboard → **Settings** → **Build Command:**
```bash
npm install -g pnpm && pnpm install && pnpm run build
```

### App Shows 404 on All Routes

**Fix:** Ensure start command is correct:

In Render Dashboard → **Settings** → **Start Command:**
```bash
pnpm start
```

Should output: `▲ Next.js 15.x.x` and `✓ Ready on http://0.0.0.0:10000`

### Environment Variables Not Loading

**Check:**
1. All variables are added in Render Dashboard (not just render.yaml)
2. No trailing spaces in values
3. Restart service after adding variables

### Still Having Upload Issues

**Check Supabase CORS:**
1. Supabase Dashboard → **Storage** → **Policies**
2. Ensure upload policies allow your Render domain

---

## 💰 Cost Breakdown

### Recommended Plan: Starter ($7/month)
- No cold starts
- Always-on instance
- 512 MB RAM
- Better for photo app UX

### Free Plan (Not Recommended)
- 15-minute cold starts
- Bad user experience
- Fine for testing only

---

## 📊 Expected Performance on Render

| Operation | Vercel Hobby | Render Starter |
|-----------|-------------|----------------|
| Upload 500 photos | ❌ Timeout | ✅ Works |
| Vision reasoning | ⚠️ Max 20 photos | ✅ Can do 50-100+ |
| Album creation | ⚠️ Sometimes timeout | ✅ Reliable |
| Cold start | None | None (on paid) |
| Response time | ~100ms | ~200-300ms |

---

## 🎯 Next Steps After Deployment

1. **Monitor Performance:**
   - Check Render Metrics dashboard
   - Monitor response times
   - Watch for errors in logs

2. **Optimize Vision Processing:**
   - Gradually increase `VISION_MAX_PHOTOS`
   - Monitor processing time
   - Find sweet spot for quality vs speed

3. **Set Up Notifications:**
   - Render → **Settings** → **Deploy Notifications**
   - Get notified of deploy failures

4. **Enable Auto-Deploy:**
   - Already enabled in `render.yaml`
   - Push to main = auto deploy

---

## ✅ Success Checklist

- [ ] App builds successfully on Render
- [ ] Can access app at Render URL
- [ ] OAuth login works
- [ ] Can upload photos (congratulations modal appears!)
- [ ] Can create albums (Step 2 loads with photos)
- [ ] Vision reasoning validates photos
- [ ] Dashboard shows uploaded photos
- [ ] All features work as expected

---

## 🆘 Need Help?

If you encounter issues:

1. **Check Render Logs:**
   - Dashboard → Your Service → **Logs**
   - Look for errors

2. **Check Environment Variables:**
   - Dashboard → Your Service → **Environment**
   - Verify all keys are set

3. **Restart Service:**
   - Dashboard → **Manual Deploy** → **Clear build cache & deploy**

---

**Good luck with deployment! 🚀**
