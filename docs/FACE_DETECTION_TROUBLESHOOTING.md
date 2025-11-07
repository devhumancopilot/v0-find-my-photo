# Face Detection Troubleshooting Guide

## Common Issues and Solutions

### 1. TextEncoder is not a constructor

**Error:**
```
TypeError: this.util.TextEncoder is not a constructor
at node_modules/@vladmandic/face-api/dist/face-api.esm.js:138
```

**Solution:**
This has been fixed in `lib/services/face-detection.ts` by adding TextEncoder polyfills for Node.js. If you still encounter this:

1. Make sure you're using Node.js 18 or higher
2. Clear your `.next` folder and rebuild:
   ```bash
   rm -rf .next
   npm run dev
   ```

### 2. Face Models Not Found

**Error:**
```
[FaceAPI] Failed to load models: ENOENT: no such file or directory
```

**Solution:**
1. Ensure face-api models are in `public/models/` directory
2. Required model files:
   - `ssd_mobilenetv1_model-weights_manifest.json`
   - `ssd_mobilenetv1_model-shard1`
   - `face_landmark_68_model-weights_manifest.json`
   - `face_landmark_68_model-shard1`
   - `face_recognition_model-weights_manifest.json`
   - `face_recognition_model-shard1`

3. Download models if missing:
   ```bash
   # Download from face-api.js repository
   wget https://github.com/vladmandic/face-api/raw/master/model/ssd_mobilenetv1_model-weights_manifest.json -P public/models/
   # ... repeat for all required files
   ```

### 3. Disable Face Detection During Development

If face detection is causing issues, you can temporarily disable it:

1. Add to `.env.local`:
   ```
   ENABLE_FACE_DETECTION=false
   ```

2. Restart your development server:
   ```bash
   npm run dev
   ```

### 4. Webhook Fallback Not Working

**Symptoms:**
- Photos upload fails
- Console shows "Both N8N and fallback failed"

**Check:**

1. **Environment Variables:**
   ```bash
   USE_LOCAL_WEBHOOKS=true  # Use local handlers instead of N8N
   ENABLE_WEBHOOK_FALLBACK=true  # Enable automatic fallback
   ```

2. **Local Webhook URL:**
   Ensure `NEXT_PUBLIC_APP_URL` is set correctly:
   ```
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

3. **Check Console Logs:**
   Look for detailed error messages in the terminal where you ran `npm run dev`

### 5. Memory Issues with Face Detection

Face detection can be memory-intensive. If you encounter out-of-memory errors:

1. **Increase Node.js memory limit:**
   ```bash
   # In package.json, update scripts:
   "dev": "NODE_OPTIONS='--max-old-space-size=4096' next dev"
   ```

2. **Process images in smaller batches:**
   The webhook handler already processes images sequentially to avoid overload.

3. **Use smaller images:**
   Consider resizing images before processing if they're very large.

## Configuration Reference

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_FACE_DETECTION` | `true` | Enable/disable face detection |
| `FACE_MATCHING_THRESHOLD` | `0.4` | Face matching sensitivity (0.0-1.0) |
| `USE_LOCAL_WEBHOOKS` | `true` | Use local handlers instead of N8N |
| `ENABLE_WEBHOOK_FALLBACK` | `true` | Enable automatic fallback to local handlers |

### Face Matching Threshold

- `0.3` - Very strict (fewer false matches, may miss some real matches)
- `0.4` - Recommended default (balanced)
- `0.5` - More lenient (more matches, higher false positive rate)
- `0.6` - Very lenient (not recommended)

## Testing Face Detection

### Test Locally

1. Enable face detection:
   ```bash
   echo "ENABLE_FACE_DETECTION=true" >> .env.local
   ```

2. Upload a test photo through the app

3. Check console logs for face detection output:
   ```
   [FaceAPI] Loading models from: /path/to/public/models
   [FaceAPI] Models loaded successfully
   [FaceAPI] Detecting faces in image...
   [FaceAPI] Detected 2 faces
   ```

4. Verify in database:
   ```sql
   SELECT * FROM face_profiles WHERE user_id = 'your-user-id';
   ```

## Performance Tips

1. **First upload is slow:** Models need to be loaded on first use. Subsequent uploads will be faster.

2. **Parallel uploads:** The system processes images sequentially to avoid overwhelming the system.

3. **Model caching:** Models are cached in memory after first load.

## Getting Help

If issues persist:

1. Check the full error stack trace in terminal
2. Verify all environment variables are set correctly
3. Ensure Node.js version is 18 or higher
4. Try with face detection disabled to isolate the issue
5. Check Supabase database for any migration issues

## Related Files

- Face Detection Service: `lib/services/face-detection.ts`
- Local Webhook Handler: `app/api/dev-webhooks/photos-upload/route.ts`
- Webhook Utilities: `lib/webhooks.ts`
- Database Functions: `lib/services/database.ts`
- Migration: `migrations/003_add_face_profiles.sql`
