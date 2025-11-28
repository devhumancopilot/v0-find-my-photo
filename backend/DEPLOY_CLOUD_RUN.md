# Deploy Backend to Google Cloud Run

This guide walks you through deploying the FindMyPhoto backend to Google Cloud Run.

## Why Cloud Run?

- **More Memory**: 2GB+ (vs Render's 512MB free tier)
- **Longer Timeouts**: Up to 60 minutes (vs Render's 5 minutes)
- **Better Scaling**: Auto-scales from 0 to N instances
- **Cost Effective**: Free tier (2M requests/month) + pay-per-use
- **No More OOM Crashes**: Solves the memory issues on Render

---

## Prerequisites

### 1. Install Google Cloud CLI

**Windows:**
```bash
# Download installer from:
https://cloud.google.com/sdk/docs/install

# Or use PowerShell:
(New-Object Net.WebClient).DownloadFile("https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe", "$env:Temp\GoogleCloudSDKInstaller.exe")
& $env:Temp\GoogleCloudSDKInstaller.exe
```

**Mac/Linux:**
```bash
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
```

### 2. Authenticate

```bash
gcloud init
gcloud auth login
```

### 3. Create Google Cloud Project

```bash
# Create new project
gcloud projects create findmyphoto-backend --name="FindMyPhoto Backend"

# Set as active project
gcloud config set project findmyphoto-backend

# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
```

---

## Step 1: Prepare Backend for Cloud Run

### 1.1 Update `package.json`

Cloud Run sets the `PORT` environment variable. Update the start script:

```json
{
  "scripts": {
    "dev": "next dev -p 3001",
    "build": "next build",
    "start": "next start -p ${PORT:-3001}",
    "lint": "next lint"
  }
}
```

### 1.2 Configure CORS

**Option A: Update `next.config.js` (Recommended)**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.FRONTEND_URL || '*'
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS'
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization, Cookie'
          },
          {
            key: 'Access-Control-Allow-Credentials',
            value: 'true'
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
```

**Option B: Update `middleware.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server"

export async function middleware(request: NextRequest) {
  const origin = request.headers.get('origin')
  const response = NextResponse.next()

  // Allow requests from frontend
  const allowedOrigins = [
    'http://localhost:3000',
    process.env.FRONTEND_URL,
  ].filter(Boolean)

  if (origin && allowedOrigins.some(allowed => origin.includes(allowed))) {
    response.headers.set('Access-Control-Allow-Origin', origin)
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie')
    response.headers.set('Access-Control-Allow-Credentials', 'true')
  }

  return response
}

export const config = {
  matcher: '/api/:path*',
}
```

### 1.3 Test Locally

```bash
# Build the app
npm run build

# Test on Cloud Run's default port
PORT=8080 npm start

# In another terminal, test the endpoint
curl http://localhost:8080/api/health
```

---

## Step 2: Deploy to Cloud Run

### 2.1 Initial Deployment

```bash
# Navigate to backend directory
cd D:\Projects\HumanCoPilot\Active\FindMyPhoto\Src\backend

# Deploy (Cloud Run will auto-detect Next.js)
gcloud run deploy findmyphoto-backend \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --timeout 900s \
  --min-instances 0 \
  --max-instances 3
```

**What this does:**
- `--source .` - Deploy from source (no Docker needed!)
- `--memory 2Gi` - Allocate 2GB RAM (handles vision + queue processing)
- `--timeout 900s` - 15-minute timeout (for long-running workers)
- `--min-instances 0` - Scale to zero when idle (save costs)
- `--max-instances 3` - Max 3 concurrent instances (control costs)

### 2.2 Save the Deployed URL

After deployment, you'll see:
```
Service [findmyphoto-backend] revision [findmyphoto-backend-00001-abc] has been deployed
Service URL: https://findmyphoto-backend-xxxxx.run.app
```

**Save this URL!** You'll need it for frontend configuration.

---

## Step 3: Configure Environment Variables

### Method A: Using Command Line (Quick)

```bash
gcloud run services update findmyphoto-backend \
  --set-env-vars="OPENAI_API_KEY=sk-your-key-here" \
  --set-env-vars="SUPABASE_URL=https://your-project.supabase.co" \
  --set-env-vars="SUPABASE_ANON_KEY=your-anon-key" \
  --set-env-vars="SUPABASE_SERVICE_ROLE_KEY=your-service-role-key" \
  --set-env-vars="HUGGINGFACE_API_KEY=your-hf-key" \
  --set-env-vars="FRONTEND_URL=https://yourapp.onrender.com" \
  --set-env-vars="ENABLE_VISION_RERANKING=true" \
  --set-env-vars="ENABLE_FACE_DETECTION=false" \
  --region us-central1
```

### Method B: Using Secret Manager (Secure - Recommended for Production)

```bash
# Create secrets
echo -n "sk-your-key" | gcloud secrets create openai-key --data-file=-
echo -n "your-supabase-key" | gcloud secrets create supabase-service-key --data-file=-

# Grant Cloud Run access to secrets
PROJECT_ID=$(gcloud config get-value project)
gcloud secrets add-iam-policy-binding openai-key \
  --member="serviceAccount:${PROJECT_ID}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding supabase-service-key \
  --member="serviceAccount:${PROJECT_ID}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Update Cloud Run service to use secrets
gcloud run services update findmyphoto-backend \
  --set-secrets="OPENAI_API_KEY=openai-key:latest" \
  --set-secrets="SUPABASE_SERVICE_ROLE_KEY=supabase-service-key:latest" \
  --region us-central1
```

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key for GPT-4 Vision | `sk-...` |
| `SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase anonymous key | `eyJ...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | `eyJ...` |
| `HUGGINGFACE_API_KEY` | HuggingFace API key for CLIP | `hf_...` |
| `FRONTEND_URL` | Frontend URL for CORS | `https://yourapp.onrender.com` |
| `ENABLE_VISION_RERANKING` | Enable vision reasoning | `true` / `false` |
| `ENABLE_FACE_DETECTION` | Enable face detection | `true` / `false` |

---

## Step 4: Update Frontend Configuration

Your frontend needs to know where the backend is deployed.

### 4.1 Create `lib/config.ts` in Frontend

```typescript
export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'
```

### 4.2 Update API Calls

Find all `fetch('/api/...)` calls and update them:

**Before:**
```typescript
const response = await fetch('/api/photos/upload', {
  method: 'POST',
  body: formData,
})
```

**After:**
```typescript
import { BACKEND_URL } from '@/lib/config'

const response = await fetch(`${BACKEND_URL}/api/photos/upload`, {
  method: 'POST',
  body: formData,
})
```

**Files to update:**
- `components/queue-notification-banner.tsx`
- `hooks/use-search-stream.ts`
- Any other files with `/api/` calls

### 4.3 Configure Frontend Environment Variable

**On Render (Frontend):**

Add environment variable:
```
NEXT_PUBLIC_BACKEND_URL=https://findmyphoto-backend-xxxxx.run.app
```

**For Local Development:**

Create `.env.local`:
```
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
```

---

## Step 5: Verify Deployment

### 5.1 Test Backend Directly

```bash
# Get service URL
gcloud run services describe findmyphoto-backend \
  --region us-central1 \
  --format='value(status.url)'

# Test health endpoint
curl https://findmyphoto-backend-xxxxx.run.app/api/health

# Test with authentication (if needed)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://findmyphoto-backend-xxxxx.run.app/api/photos/queue-status
```

### 5.2 Check Logs

```bash
# View recent logs
gcloud run services logs read findmyphoto-backend \
  --region us-central1 \
  --limit 50

# Stream logs in real-time
gcloud run services logs tail findmyphoto-backend \
  --region us-central1
```

### 5.3 Monitor Metrics

```bash
# Open Cloud Console
gcloud run services describe findmyphoto-backend \
  --region us-central1 \
  --format='value(status.url)'
```

Visit: https://console.cloud.google.com/run

---

## Troubleshooting

### Issue: Build Fails

**Error:** `npm install` fails during build

**Solution:**
```bash
# Clean install locally
rm -rf node_modules package-lock.json
npm install

# Commit updated package-lock.json
git add package-lock.json
git commit -m "update package-lock"

# Redeploy
gcloud run deploy findmyphoto-backend --source .
```

### Issue: CORS Errors

**Error:** `Access-Control-Allow-Origin` error in browser

**Solution:**
1. Verify `FRONTEND_URL` environment variable is set correctly
2. Check CORS headers in `next.config.js` or `middleware.ts`
3. Ensure frontend URL matches exactly (no trailing slash)

```bash
# Update FRONTEND_URL
gcloud run services update findmyphoto-backend \
  --set-env-vars="FRONTEND_URL=https://yourapp.onrender.com" \
  --region us-central1
```

### Issue: Memory Limit Exceeded

**Error:** `Instance failed: Ran out of memory`

**Solution:**
```bash
# Increase memory to 4GB
gcloud run services update findmyphoto-backend \
  --memory 4Gi \
  --region us-central1
```

### Issue: Timeout Errors

**Error:** `Deadline Exceeded` or timeout after 15 minutes

**Solution:**
```bash
# Increase timeout (max 60 minutes with billing enabled)
gcloud run services update findmyphoto-backend \
  --timeout 3600s \
  --region us-central1
```

### Issue: Cold Start Delays

**Symptom:** First request after idle takes 5-10 seconds

**Solution:**
```bash
# Keep 1 instance always warm (costs ~$10/month)
gcloud run services update findmyphoto-backend \
  --min-instances 1 \
  --region us-central1
```

---

## Cost Management

### Free Tier (Always Free)

- **2 million requests** per month
- **360,000 GB-seconds** of memory
- **180,000 vCPU-seconds** of compute time

### Estimated Costs

**With `min-instances=0` (recommended):**
- Light usage: **$0-5/month**
- Medium usage: **$5-15/month**
- Heavy usage: **$15-30/month**

**With `min-instances=1` (no cold starts):**
- Base cost: **~$10/month** (1 instance always running)
- Plus usage costs

### View Costs

```bash
# Check current month's costs
gcloud billing accounts list
gcloud billing projects describe findmyphoto-backend
```

Visit: https://console.cloud.google.com/billing

---

## Scaling Configuration

### For Development/Testing

```bash
gcloud run services update findmyphoto-backend \
  --memory 1Gi \
  --timeout 300s \
  --min-instances 0 \
  --max-instances 1 \
  --region us-central1
```

### For Production (Recommended)

```bash
gcloud run services update findmyphoto-backend \
  --memory 2Gi \
  --timeout 900s \
  --min-instances 0 \
  --max-instances 3 \
  --cpu 1 \
  --concurrency 80 \
  --region us-central1
```

### For High Traffic

```bash
gcloud run services update findmyphoto-backend \
  --memory 4Gi \
  --timeout 900s \
  --min-instances 1 \
  --max-instances 10 \
  --cpu 2 \
  --concurrency 100 \
  --region us-central1
```

---

## Maintenance

### Update Deployment

```bash
# After code changes, redeploy
cd backend
gcloud run deploy findmyphoto-backend --source .
```

### Rollback to Previous Version

```bash
# List revisions
gcloud run revisions list --service findmyphoto-backend --region us-central1

# Rollback to specific revision
gcloud run services update-traffic findmyphoto-backend \
  --to-revisions findmyphoto-backend-00001-abc=100 \
  --region us-central1
```

### Delete Service

```bash
gcloud run services delete findmyphoto-backend --region us-central1
```

---

## Monitoring & Logs

### Real-time Logs

```bash
gcloud run services logs tail findmyphoto-backend --region us-central1
```

### Search Logs

```bash
# Filter by severity
gcloud logging read "resource.type=cloud_run_revision AND severity>=ERROR" --limit 50

# Filter by text
gcloud logging read "resource.type=cloud_run_revision AND textPayload:\"Worker\"" --limit 50
```

### Metrics Dashboard

Visit: https://console.cloud.google.com/run/detail/us-central1/findmyphoto-backend/metrics

Monitor:
- Request count
- Request latency
- Container instance count
- Memory utilization
- CPU utilization

---

## Custom Domain (Optional)

### 1. Map Custom Domain

```bash
gcloud run domain-mappings create \
  --service findmyphoto-backend \
  --domain api.yourdomain.com \
  --region us-central1
```

### 2. Update DNS

Add the DNS records shown in the output to your domain provider.

### 3. Update Frontend

```bash
# On Render
NEXT_PUBLIC_BACKEND_URL=https://api.yourdomain.com
```

---

## Support

**Cloud Run Documentation:** https://cloud.google.com/run/docs

**Pricing Calculator:** https://cloud.google.com/products/calculator

**Status Dashboard:** https://status.cloud.google.com

**Community Support:** https://stackoverflow.com/questions/tagged/google-cloud-run

---

## Summary

✅ **Deployed:** Backend running on Cloud Run
✅ **Scaled:** 0 to 3 instances based on traffic
✅ **Secure:** Environment variables via Secret Manager
✅ **Monitored:** Logs and metrics in Cloud Console
✅ **Cost-effective:** Pay only for what you use

**Next Steps:**
1. Monitor performance in Cloud Console
2. Set up alerts for errors/high latency
3. Configure custom domain (optional)
4. Enable Cloud Armor for DDoS protection (optional)
