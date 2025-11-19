# 🚀 Quick Start - Deploy CLIP in 5 Steps (30 Minutes)

## What You'll Get

✅ **Free CLIP inference service** on Hugging Face Spaces
✅ **512D embeddings** for images and text
✅ **No credit card required**
✅ **Simple REST API**
✅ **90-second timeout** to handle cold starts

---

## 📦 Step 1: Create Hugging Face Space (2 min)

1. Sign up at https://huggingface.co/join (if you haven't)
2. Go to https://huggingface.co/new-space
3. Fill in:
   - Space name: `clip-inference-api`
   - SDK: **Docker** (important!)
   - Hardware: **CPU basic (free)**
4. Click **Create Space**

---

## 📤 Step 2: Upload Files (3 min)

### Option A: Web Upload (Easiest)

1. On your Space page, click **Files** tab
2. Click **Add file** → **Upload files**
3. Upload these 4 files from `hf-space-clip-service/`:
   - ✅ `app.py`
   - ✅ `requirements.txt`
   - ✅ `Dockerfile`
   - ✅ `README.md`
4. Click **Commit**

### Option B: Git

\`\`\`bash
git clone https://huggingface.co/spaces/YOUR-USERNAME/clip-inference-api
cd clip-inference-api
cp ../hf-space-clip-service/* .
git add .
git commit -m "Deploy CLIP API"
git push
\`\`\`

---

## ⏳ Step 3: Wait for Build (10-15 min)

Your Space will build automatically. Watch for:

\`\`\`
✅ Building Docker image...
✅ Installing dependencies...
✅ Loading CLIP model...
✅ Running on http://0.0.0.0:7860
\`\`\`

Status changes: **Building** → **Running**

☕ Grab a coffee while it builds!

---

## 🧪 Step 4: Test Your API (2 min)

Your URL: `https://YOUR-USERNAME-clip-inference-api.hf.space`

### Test Health:
\`\`\`bash
curl https://YOUR-USERNAME-clip-inference-api.hf.space/health
\`\`\`

Expected:
\`\`\`json
{
  "status": "healthy",
  "model_loaded": true,
  "device": "cpu"
}
\`\`\`

### Interactive Docs:
Visit: `https://YOUR-USERNAME-clip-inference-api.hf.space/docs`

Try the endpoints in your browser! 🎉

---

## 🔗 Step 5: Connect to Your App (5 min)

### 1. Add Environment Variables

In your `.env.local`:
\`\`\`bash
CLIP_SERVICE_URL=https://YOUR-USERNAME-clip-inference-api.hf.space
EMBEDDING_PROVIDER=huggingface
\`\`\`

**Replace `YOUR-USERNAME` with your actual HF username!**

### 2. Restart Dev Server

\`\`\`bash
# Stop current server (Ctrl+C)
# Restart
npm run dev
\`\`\`

### 3. Test It

Upload a photo in your app and check the logs:

\`\`\`
[HuggingFace][CLIP] Service: HF Spaces
[HuggingFace][CLIP] ✅ SUCCESS - Generated 512-dimensional CLIP image embedding
\`\`\`

---

## 🎉 Done! You're Using Free CLIP!

### What to Expect:

**First Request After Idle:**
- Takes 30-60 seconds (cold start)
- Service wakes up from sleep
- Be patient! ☕

**Subsequent Requests:**
- 0.5-2 seconds
- Fast and smooth! ⚡

---

## 🔥 Keep It Warm (Optional)

Set up free ping service to prevent cold starts:

### Using cron-job.org (Free):

1. Go to https://cron-job.org
2. Create account
3. Add new cron job:
   - **URL**: `https://YOUR-SPACE.hf.space/health`
   - **Interval**: Every 10 minutes
4. Save

Now your Space stays warm 24/7! 🔥

---

## 🐛 Troubleshooting

### "CLIP_SERVICE_URL not configured"
→ Add to `.env.local` and restart server

### "Request timed out (90s)"
→ Cold start! Wait 60s and retry

### "Service unavailable (503)"
→ Space is waking up, retry in 60s

### Build Failed
→ Check build logs on HF Space page

---

## 💰 Cost

**Free Forever!** ✅

With keep-alive ping:
- $0/month
- Unlimited requests (reasonable use)
- 16GB RAM
- Always responsive

---

## 📊 What's Next?

1. ✅ Test with different images
2. ✅ Try text search queries
3. ✅ Set up keep-alive ping
4. ✅ Monitor in HF Spaces dashboard
5. 🎉 Enjoy free CLIP embeddings!

---

## 📚 Need Help?

- **Full Guide**: See `DEPLOYMENT_GUIDE.md`
- **API Docs**: Visit `/docs` on your Space
- **HF Support**: https://discuss.huggingface.co/

---

**That's it! You now have a production-ready CLIP service running for free! 🎊**
