# 🚀 Hugging Face Spaces Deployment Guide

## Quick Start (30 minutes)

### Step 1: Create Hugging Face Account (5 min)

1. Go to https://huggingface.co/join
2. Sign up with email or GitHub
3. Verify your email
4. ✅ Done! No credit card needed

---

### Step 2: Create New Space (2 min)

1. Go to https://huggingface.co/new-space
2. Fill in details:
   - **Owner**: Your username
   - **Space name**: `clip-inference-api` (or your choice)
   - **License**: MIT
   - **Select SDK**: **Docker** ⚠️ Important!
   - **Space hardware**: **CPU basic (free)** ✅
   - **Visibility**: Public (or Private if you prefer)

3. Click **Create Space**

You'll be redirected to your new Space page.

---

### Step 3: Upload Files to Space (10 min)

You have 2 options:

#### Option A: Git (Recommended)

\`\`\`bash
# Clone your space
git clone https://huggingface.co/spaces/YOUR-USERNAME/clip-inference-api
cd clip-inference-api

# Copy all files from hf-space-clip-service folder
cp /path/to/hf-space-clip-service/* .

# Should have:
# - app.py
# - requirements.txt
# - Dockerfile
# - README.md

# Commit and push
git add .
git commit -m "Initial CLIP inference API"
git push
\`\`\`

#### Option B: Web Upload (Easier)

1. On your Space page, click **Files** tab
2. Click **Add file** → **Upload files**
3. Drag and drop ALL files:
   - ✅ `app.py`
   - ✅ `requirements.txt`
   - ✅ `Dockerfile`
   - ✅ `README.md`
4. Click **Commit changes to main**

---

### Step 4: Wait for Build (10-15 min)

1. Your Space will automatically start building
2. You'll see build logs in real-time
3. Look for:
   \`\`\`
   Building Docker image...
   Installing dependencies...
   Loading CLIP model...
   ✅ CLIP model loaded successfully!
   Running on http://0.0.0.0:7860
   \`\`\`

4. Status will change from **Building** → **Running**

⚠️ **First build takes 10-15 minutes** (downloading model, installing deps)

---

### Step 5: Test Your API (2 min)

Once status shows **Running**, your API is live!

#### Get Your URL

Your Space URL is: `https://YOUR-USERNAME-clip-inference-api.hf.space`

#### Test Endpoints

**1. Health Check:**
\`\`\`bash
curl https://YOUR-USERNAME-clip-inference-api.hf.space/health
\`\`\`

Expected response:
\`\`\`json
{
  "status": "healthy",
  "model_loaded": true,
  "device": "cpu",
  "model_name": "openai/clip-vit-base-patch32"
}
\`\`\`

**2. Interactive Docs:**

Visit: `https://YOUR-USERNAME-clip-inference-api.hf.space/docs`

You can test all endpoints directly in the browser!

**3. Text Embedding:**
\`\`\`bash
curl -X POST https://YOUR-USERNAME-clip-inference-api.hf.space/embed/text \
  -H "Content-Type: application/json" \
  -d '{"text": "a photo of a dog"}'
\`\`\`

**4. Image Embedding:**
\`\`\`bash
# First, convert image to base64
BASE64_IMG=$(base64 -w 0 your-image.jpg)

curl -X POST https://YOUR-USERNAME-clip-inference-api.hf.space/embed/image \
  -H "Content-Type: application/json" \
  -d "{\"image\": \"$BASE64_IMG\"}"
\`\`\`

---

### Step 6: Integrate with Your App (5 min)

Now update your main app to use the CLIP service.

#### Update Environment Variable

Add to your `.env.local`:
\`\`\`bash
CLIP_SERVICE_URL=https://YOUR-USERNAME-clip-inference-api.hf.space
EMBEDDING_PROVIDER=huggingface
\`\`\`

#### Update `lib/services/huggingface.ts`

Replace the API calls with your HF Space endpoint:

\`\`\`typescript
const CLIP_SERVICE_URL = process.env.CLIP_SERVICE_URL || ""

export async function generateCLIPImageEmbedding(base64: string, mimeType: string): Promise<number[]> {
  if (!CLIP_SERVICE_URL) {
    throw new Error("CLIP_SERVICE_URL not configured")
  }

  try {
    console.log("[HuggingFace][CLIP] Calling HF Spaces API for image embedding")

    const response = await fetch(`${CLIP_SERVICE_URL}/embed/image`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image: base64,
        mime_type: mimeType
      }),
      // Increase timeout for cold starts
      signal: AbortSignal.timeout(90000) // 90 seconds
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HF Spaces API error (${response.status}): ${errorText}`)
    }

    const result = await response.json()

    if (!result.embedding || !Array.isArray(result.embedding)) {
      throw new Error("Invalid response format from HF Spaces")
    }

    console.log(`[HuggingFace][CLIP] ✅ Generated ${result.dimensions}D embedding`)
    return result.embedding

  } catch (error) {
    console.error("[HuggingFace][CLIP] ❌ Error:", error)
    throw new Error(`Failed to generate CLIP image embedding: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

export async function generateCLIPTextEmbedding(text: string): Promise<number[]> {
  if (!CLIP_SERVICE_URL) {
    throw new Error("CLIP_SERVICE_URL not configured")
  }

  try {
    console.log("[HuggingFace][CLIP] Calling HF Spaces API for text embedding")

    const response = await fetch(`${CLIP_SERVICE_URL}/embed/text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(90000) // 90 seconds
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HF Spaces API error (${response.status}): ${errorText}`)
    }

    const result = await response.json()

    if (!result.embedding || !Array.isArray(result.embedding)) {
      throw new Error("Invalid response format from HF Spaces")
    }

    console.log(`[HuggingFace][CLIP] ✅ Generated ${result.dimensions}D embedding`)
    return result.embedding

  } catch (error) {
    console.error("[HuggingFace][CLIP] ❌ Error:", error)
    throw new Error(`Failed to generate CLIP text embedding: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}
\`\`\`

#### Deploy to Vercel

\`\`\`bash
# Add environment variable to Vercel
vercel env add CLIP_SERVICE_URL production

# Paste your HF Space URL when prompted:
# https://YOUR-USERNAME-clip-inference-api.hf.space

# Also add EMBEDDING_PROVIDER
vercel env add EMBEDDING_PROVIDER production
# Enter: huggingface

# Redeploy
vercel --prod
\`\`\`

---

## ✅ You're Done!

Your setup:
\`\`\`
User Request
     ↓
Vercel App (Next.js)
     ↓
HF Spaces (CLIP API) - FREE ✅
     ↓
Returns Embeddings
\`\`\`

---

## 📊 Understanding Cold Starts

**What happens:**
- Space goes to sleep after 15 minutes of inactivity
- Next request takes 30-60 seconds to wake up
- Model stays loaded once awake

**Your users will see:**
- First request after idle: 30-60s ⏱️
- Subsequent requests: 0.5-2s ⚡

**Solutions:**

### Option 1: Keep-Alive Ping (Recommended)
Set up a free cron job to ping your Space every 10 minutes:

**Using cron-job.org (Free):**
1. Go to https://cron-job.org
2. Create account
3. Create new job:
   - URL: `https://YOUR-SPACE.hf.space/health`
   - Interval: Every 10 minutes
4. Save and enable

Now your Space stays warm! ✅

### Option 2: Accept Cold Starts
Just let users wait 60s occasionally. For minimal usage, this is fine.

### Option 3: Upgrade to Persistent (Paid)
HF Spaces offers always-on hardware starting at $0.60/hour

---

## 🐛 Troubleshooting

### Build Failed
**Check logs for specific error:**
- Missing dependency? Add to `requirements.txt`
- Syntax error? Check `app.py`
- Docker issue? Check `Dockerfile`

### Space Stuck on "Building"
- Wait 15-20 minutes (first build is slow)
- If still stuck, check build logs
- Try rebuilding: Settings → Factory reboot

### API Returns 503
- Space is sleeping (cold start)
- Wait 60 seconds and retry
- Or set up keep-alive ping

### Timeout Errors from Vercel
- Increase timeout in fetch: `signal: AbortSignal.timeout(90000)`
- Or set up keep-alive to prevent cold starts

### Out of Memory
- Unlikely with CLIP on 16GB free tier
- If happens, simplify the code or upgrade hardware

---

## 💰 Cost Breakdown

| Feature | Free Tier | Persistent (Paid) |
|---------|-----------|-------------------|
| **Cost** | $0 | $0.60/hour (~$432/month) |
| **RAM** | 16 GB | 16 GB+ |
| **Cold Start** | Yes (60s) | No |
| **Uptime** | With keep-alive: ~99% | 100% |

**Recommendation:** Use free tier with keep-alive cron job! ✅

---

## 🔒 Security Tips

### Make Space Private (Optional)
1. Go to Space Settings
2. Change visibility to **Private**
3. Generate access token
4. Add token to your Vercel app

### Add API Key Authentication (Advanced)
Edit `app.py` to require API key:

\`\`\`python
from fastapi import Header, HTTPException

async def verify_api_key(x_api_key: str = Header(...)):
    if x_api_key != "your-secret-key":
        raise HTTPException(status_code=401, detail="Invalid API key")

@app.post("/embed/text", dependencies=[Depends(verify_api_key)])
async def embed_text(request: TextEmbeddingRequest):
    # ... rest of code
\`\`\`

Then pass key from Vercel:
\`\`\`typescript
headers: {
  "X-API-Key": process.env.CLIP_API_KEY
}
\`\`\`

---

## 📈 Monitoring

### Check Space Status
Visit: `https://YOUR-SPACE.hf.space/health`

### View Logs
Go to your Space → **Logs** tab to see real-time activity

### Monitor Usage
HF Spaces dashboard shows:
- Request count
- Error rate
- Uptime

---

## 🚀 Next Steps

1. ✅ Deploy to HF Spaces
2. ✅ Test endpoints
3. ✅ Integrate with your app
4. ✅ Set up keep-alive cron
5. 🎉 Enjoy free CLIP embeddings!

---

## 📞 Support

- HF Spaces Docs: https://huggingface.co/docs/hub/spaces
- Community Forum: https://discuss.huggingface.co/
- Issues with this setup: Check the README

**Happy deploying! 🎉**
