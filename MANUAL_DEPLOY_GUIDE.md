# 🎯 Manual Deployment Guide - Deploy Each Service Separately

Deploy backend and frontend as **individual Web Services** on Render.

---

## 🔵 STEP 1: Deploy Backend API (First)

### 1. Create Backend Service

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repo: `devhumancopilot/v0-find-my-photo`
4. Click **"Connect"**

### 2. Configure Backend

**Name:** `v0-find-my-photo-backend`

**Root Directory:** `backend`

**Runtime:** `Node`

**Build Command:**
```bash
pnpm install && pnpm run build
```

**Start Command:**
```bash
pnpm start
```

**Instance Type:** `Free`

### 3. Add Backend Environment Variables

Click **"Advanced"** → Add these:

```bash
NODE_ENV=production
FRONTEND_URL=https://v0-find-my-photo.onrender.com

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Google OAuth
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-secret

# OpenAI
OPENAI_API_KEY=your-openai-key

# CLIP Service
CLIP_SERVICE_URL=https://devjustin-fmp-clip.hf.space
CLIP_API_KEY=your-clip-api-key

# Vision Settings
EMBEDDING_PROVIDER=huggingface
ENABLE_VISION_RERANKING=true
VISION_MAX_PHOTOS=30
VISION_MIN_CONFIDENCE=60
VISION_RERANKING_WEIGHT=0.4
PHOTO_SEARCH_MIN_SIMILARITY=0.4
CLIP_MIN_SCORE=0.20
CLIP_REFERENCE_WEIGHT=0.5
CLIP_NUM_REFERENCES=3
```

### 4. Click "Create Web Service"

Wait ~5 minutes for build to complete.

**Backend URL:** `https://v0-find-my-photo-backend.onrender.com`

---

## 🟢 STEP 2: Deploy Frontend (After Backend is Running)

### 1. Create Frontend Service

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"Web Service"**
3. Select same repo: `devhumancopilot/v0-find-my-photo`
4. Click **"Connect"**

### 2. Configure Frontend

**Name:** `v0-find-my-photo`

**Root Directory:** (leave blank - use root)

**Runtime:** `Node`

**Build Command:**
```bash
pnpm install && pnpm run build
```

**Start Command:**
```bash
pnpm start
```

**Instance Type:** `Free`

### 3. Add Frontend Environment Variables

Click **"Advanced"** → Add these:

```bash
NODE_ENV=production

# Backend API URL
NEXT_PUBLIC_API_URL=https://v0-find-my-photo-backend.onrender.com

# Supabase (for client-side auth)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Google OAuth
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
NEXT_PUBLIC_GOOGLE_REDIRECT_URI=https://v0-find-my-photo.onrender.com
```

### 4. Click "Create Web Service"

Wait ~5 minutes for build to complete.

**Frontend URL:** `https://v0-find-my-photo.onrender.com`

---

## ✅ STEP 3: Test Both Services

### Test Backend:
1. Visit: `https://v0-find-my-photo-backend.onrender.com`
2. Should see: **"✅ Find My Photo API Server - Status: Online"**

### Test Frontend:
1. Visit: `https://v0-find-my-photo.onrender.com`
2. Should see your app UI
3. Try login
4. Try upload → Congratulations modal should appear!

---

## 🔧 If Backend Build Fails:

Try this simpler build command:

**Build Command:**
```bash
npm install -g pnpm && pnpm install && pnpm run build
```

This ensures pnpm is installed first.

---

## 🔧 If Frontend Build Fails:

Same fix - use:

**Build Command:**
```bash
npm install -g pnpm && pnpm install && pnpm run build
```

---

## 📊 Expected Build Times:

- **Backend:** ~4-6 minutes (has more dependencies)
- **Frontend:** ~3-5 minutes

---

## 🎯 Final Checklist:

- [ ] Backend service created and deployed
- [ ] Backend URL works (shows status page)
- [ ] Frontend service created and deployed
- [ ] Frontend URL works (shows UI)
- [ ] Login works
- [ ] Upload works (congratulations modal!)
- [ ] Create album works (Step 2 loads!)

---

## 💡 Pro Tips:

1. **Deploy backend FIRST** - Frontend needs backend URL
2. **Copy env vars carefully** - Missing vars = build fails
3. **Check logs** if build fails - Dashboard → Service → Logs
4. **Free tier sleeps** - First load takes 30-60s

---

## 🆘 Troubleshooting:

**Build fails with "command not found":**
- Use: `npm install -g pnpm && pnpm install && pnpm run build`

**Build succeeds but app crashes:**
- Check environment variables
- Check logs for missing env vars

**CORS errors:**
- Verify `FRONTEND_URL` in backend env vars
- Verify `NEXT_PUBLIC_API_URL` in frontend env vars

---

**This manual approach is more reliable than Blueprint!** 🎉

Start with deploying the backend first, then come back for frontend!
