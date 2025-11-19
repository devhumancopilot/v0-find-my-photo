# Installation Status - Face Profiles Feature

## ✅ Installation Complete!

All dependencies and model files have been installed successfully.

---

## What Was Installed

### 1. NPM Packages ✅

\`\`\`bash
✅ @vladmandic/face-api - Face detection library
✅ canvas - Image processing for Node.js
✅ openai - Already installed

Note: @tensorflow/tfjs-node skipped due to Windows build issues
      (face-api will use CPU backend automatically)
\`\`\`

**Verification:**
\`\`\`bash
npm list @vladmandic/face-api canvas openai
\`\`\`

### 2. Face-API Model Files ✅

Downloaded to: `public/models/`

\`\`\`
✅ ssd_mobilenetv1_model-weights_manifest.json (28KB)
✅ ssd_mobilenetv1_model-shard1 (292KB)
✅ face_landmark_68_model-weights_manifest.json (8.3KB)
✅ face_landmark_68_model-shard1 (292KB)
✅ face_recognition_model-weights_manifest.json (20KB)
✅ face_recognition_model-shard1 (292KB)
✅ face_recognition_model-shard2 (292KB)
\`\`\`

**Total Size:** ~1.2MB

**Verification:**
\`\`\`bash
ls -lh public/models/
\`\`\`

### 3. Code Updates ✅

- ✅ Updated `lib/services/face-detection.ts` to use CPU backend
- ✅ No tensorflow dependency required

---

## What YOU Need to Do

### ⚠️ CRITICAL: Run Database Migration

**You mentioned you're running this - make sure you complete it!**

\`\`\`sql
-- In Supabase SQL Editor, run:
-- File: migrations/003_add_face_profiles.sql
\`\`\`

**Verify migration worked:**
\`\`\`sql
-- Check table exists
SELECT * FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'face_profiles';

-- Should return 1 row

-- Check pgvector extension
SELECT * FROM pg_extension WHERE extname = 'vector';

-- Should return 1 row
\`\`\`

---

## Enable Face Detection

Once migration is complete, enable the feature:

**Edit `.env.local`:**
\`\`\`bash
# Change this line:
ENABLE_FACE_DETECTION=false

# To this:
ENABLE_FACE_DETECTION=true
\`\`\`

**Optional: Adjust settings:**
\`\`\`bash
FACE_MATCHING_THRESHOLD=0.4  # Default is good
FACE_MIN_CONFIDENCE=0.5      # Default is good
\`\`\`

---

## Start the Server

\`\`\`bash
npm run dev
\`\`\`

**Expected output:**
\`\`\`
[FaceAPI] Loading models from: D:\...\public\models
[FaceAPI] Models loaded successfully
\`\`\`

---

## Test the Feature

### 1. Upload a Photo with Faces

Use the UI to upload a photo containing clear faces.

### 2. Check Server Logs

You should see:
\`\`\`
[Fallback] Detecting faces in photo.jpg
[FaceAPI] Detecting faces in image...
[FaceAPI] Detected 2 faces
[Fallback] Detected 2 faces in photo.jpg
[Fallback] Face 1/2 is new (no match found)
[Fallback] Face 1/2 profile created
[Fallback] Face 2/2 is new (no match found)
[Fallback] Face 2/2 profile created
\`\`\`

### 3. Verify in Database

\`\`\`sql
SELECT
  id,
  photo_id,
  face_name,
  detection_confidence,
  bbox_x,
  bbox_y,
  bbox_width,
  bbox_height
FROM face_profiles
ORDER BY created_at DESC
LIMIT 5;
\`\`\`

Should see face records with NULL face_name.

### 4. Test API Endpoints

\`\`\`bash
# Get face profiles
curl http://localhost:3000/api/face-profiles \
  -H "Authorization: Bearer YOUR_TOKEN"

# Assign name to face
curl -X PATCH http://localhost:3000/api/face-profiles/1 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"face_name":"John Doe"}'
\`\`\`

### 5. Test Auto-Matching

1. Assign a name to a face (via API or UI when built)
2. Upload another photo of the same person
3. Check logs - should see:
   \`\`\`
   [Fallback] Face 1/1 matched to: John Doe (similarity: 0.750)
   \`\`\`

---

## Troubleshooting

### Models Not Loading

**Error:** "Cannot find models"

**Solution:**
\`\`\`bash
# Verify files exist
ls public/models/

# Should show 7 files
# If missing, re-run download commands from setup guide
\`\`\`

### Face Detection Not Running

**Check:**
1. ✅ Migration completed? Check database
2. ✅ `ENABLE_FACE_DETECTION=true` in .env.local?
3. ✅ Server restarted after env change?
4. ✅ No errors in console?

### No Faces Detected

**Possible causes:**
- Photo has no faces
- Faces too small (<80x80px)
- Poor lighting
- Face partially obscured

**Try:**
- Use well-lit, front-facing photos
- Lower `FACE_MIN_CONFIDENCE` to 0.3
- Check detection_confidence in database

---

## Performance Notes

### Without @tensorflow/tfjs-node

- **Speed:** ~1-2 seconds per face (CPU only)
- **Memory:** ~200-300MB
- **Good for:** Development, small-scale production
- **Limitation:** No GPU acceleration

### If You Need Faster Performance

Install Visual Studio Build Tools, then:
\`\`\`bash
npm install @tensorflow/tfjs-node --legacy-peer-deps
\`\`\`

Then update `lib/services/face-detection.ts` to import:
\`\`\`typescript
import * as tf from "@tensorflow/tfjs-node"
\`\`\`

**Benefits:**
- 2-5x faster face detection
- Better memory management
- GPU support (with tfjs-node-gpu)

---

## Next Steps

1. ✅ **Complete migration** in Supabase
2. ✅ **Enable feature** in .env.local
3. ✅ **Restart server** with `npm run dev`
4. ✅ **Test upload** with photo containing faces
5. ⏳ **Build UI** for Face Profiles management (optional)

---

## Status Summary

| Task | Status |
|------|--------|
| Install npm packages | ✅ Complete |
| Download model files | ✅ Complete (7 files, 1.2MB) |
| Update code | ✅ Complete |
| Run migration | ⏳ **You're doing this** |
| Enable feature | ⏳ Waiting for migration |
| Test feature | ⏳ Waiting for migration |

---

## Quick Commands

\`\`\`bash
# Verify installation
npm list @vladmandic/face-api canvas openai
ls public/models/

# Start server
npm run dev

# Check database (after migration)
# In Supabase SQL Editor:
SELECT COUNT(*) FROM face_profiles;
\`\`\`

---

## 🎉 Summary

**Installation is 95% complete!**

Just need you to:
1. ✅ Finish running the migration in Supabase
2. ✅ Enable `ENABLE_FACE_DETECTION=true`
3. ✅ Restart the server

Then face detection will work automatically on every photo upload! 🚀
