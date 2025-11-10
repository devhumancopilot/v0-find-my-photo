# Face Profiles - Implementation Checklist ✅

## Pre-Deployment Checklist

### ⚠️ Critical Steps (Must Do Before Testing)

- [ ] **1. Run Database Migration**
  - File: `migrations/003_add_face_profiles.sql`
  - Location: Supabase SQL Editor
  - Action: Copy entire file and execute
  - Verify: Check that `face_profiles` table exists

- [ ] **2. Install NPM Packages**
  \`\`\`bash
  npm install @vladmandic/face-api @tensorflow/tfjs-node canvas
  \`\`\`
  - Verify: Run `npm list @vladmandic/face-api`

- [ ] **3. Download Face-API Models**
  - Create: `public/models/` directory
  - Download 6 files from: https://github.com/vladmandic/face-api/tree/master/model
  - Required files:
    - [ ] `ssd_mobilenetv1_model-weights_manifest.json`
    - [ ] `ssd_mobilenetv1_model-shard1`
    - [ ] `face_landmark_68_model-weights_manifest.json`
    - [ ] `face_landmark_68_model-shard1`
    - [ ] `face_recognition_model-weights_manifest.json`
    - [ ] `face_recognition_model-shard1`
  - Verify: Check `ls public/models/` shows 6 files

- [ ] **4. Configure Environment**
  - File: `.env.local`
  - Set: `ENABLE_FACE_DETECTION=true`
  - Optional: Adjust `FACE_MATCHING_THRESHOLD=0.4`
  - Optional: Adjust `FACE_MIN_CONFIDENCE=0.5`

- [ ] **5. Restart Development Server**
  \`\`\`bash
  npm run dev
  \`\`\`
  - Wait for "Models loaded successfully" log

---

## Testing Checklist

### Basic Testing

- [ ] **Upload Photo with Faces**
  - Upload a photo containing 1-3 clear faces
  - Check server logs for: `[FaceAPI] Detected X faces`
  - Verify no errors in console

- [ ] **Verify Face Detection**
  - Check logs: `[Fallback] Face 1/X profile created`
  - Query database:
    \`\`\`sql
    SELECT * FROM face_profiles ORDER BY created_at DESC LIMIT 5;
    \`\`\`
  - Should see face records

- [ ] **Test API Endpoints**
  - GET `/api/face-profiles` - Should return face groups
  - PATCH `/api/face-profiles/[id]` - Should update name
  - POST `/api/face-profiles/bulk-update` - Should update multiple

- [ ] **Test Face Matching**
  - Assign a name to a face via API
  - Upload another photo of the same person
  - Check logs: Should see "matched to: [name]"
  - Verify new face inherits the name

### Advanced Testing

- [ ] **Multiple Faces**
  - Upload photo with 3+ faces
  - Verify all faces detected and stored

- [ ] **Edge Cases**
  - Side profile
  - Sunglasses
  - Poor lighting
  - Small faces (<80x80px)

- [ ] **Performance**
  - Upload 10 photos
  - Measure total time
  - Should be reasonable (<30s)

---

## Verification Checklist

### Database Verification

- [ ] **face_profiles table exists**
  \`\`\`sql
  SELECT * FROM information_schema.tables
  WHERE table_name = 'face_profiles';
  \`\`\`

- [ ] **pgvector extension enabled**
  \`\`\`sql
  SELECT * FROM pg_extension WHERE extname = 'vector';
  \`\`\`

- [ ] **RLS policies active**
  \`\`\`sql
  SELECT * FROM pg_policies WHERE tablename = 'face_profiles';
  \`\`\`
  - Should see 4 policies (SELECT, INSERT, UPDATE, DELETE)

- [ ] **Functions exist**
  \`\`\`sql
  SELECT proname FROM pg_proc
  WHERE proname IN ('match_faces', 'get_face_profiles_grouped', 'bulk_update_face_names');
  \`\`\`
  - Should see all 3 functions

- [ ] **Indexes created**
  \`\`\`sql
  SELECT indexname FROM pg_indexes
  WHERE tablename = 'face_profiles';
  \`\`\`
  - Should see 6+ indexes including HNSW vector index

### Code Verification

- [ ] **Service files exist**
  - `lib/services/face-detection.ts`
  - `lib/services/database.ts` (updated)

- [ ] **API endpoints exist**
  - `app/api/face-profiles/route.ts`
  - `app/api/face-profiles/[id]/route.ts`
  - `app/api/face-profiles/bulk-update/route.ts`

- [ ] **Webhook updated**
  - `app/api/dev-webhooks/photos-upload/route.ts`
  - Should have face detection code

- [ ] **Environment configured**
  - `.env.local` has face detection variables

---

## Production Readiness Checklist

### Before Going Live

- [ ] **Test on staging environment**
  - Run all tests on staging
  - Verify performance under load
  - Test with real user data

- [ ] **Security audit**
  - RLS policies tested
  - No cross-user data leakage
  - API endpoints secured

- [ ] **Performance optimization**
  - Models cached properly
  - Database indexes working
  - No memory leaks

- [ ] **Monitoring setup**
  - Log face detection errors
  - Track processing times
  - Alert on failures

- [ ] **Documentation**
  - User guide for Face Profiles UI
  - Admin guide for troubleshooting
  - API documentation

### Deployment Steps

- [ ] **1. Run migration on production DB**
  - Backup database first
  - Run `003_add_face_profiles.sql`
  - Verify tables created

- [ ] **2. Deploy code**
  - Push to production
  - Install dependencies
  - Upload model files

- [ ] **3. Configure production env**
  - Set `ENABLE_FACE_DETECTION=false` initially
  - Test with small batch first
  - Enable gradually

- [ ] **4. Monitor**
  - Watch logs for errors
  - Check processing times
  - Monitor database load

---

## Rollback Plan

### If Something Goes Wrong

- [ ] **Disable face detection**
  \`\`\`bash
  ENABLE_FACE_DETECTION=false
  \`\`\`
  - Photo uploads will continue working
  - No face detection runs

- [ ] **Database rollback**
  - Use rollback script in migration file
  - Uncomment and run rollback section
  - Only if absolutely necessary

- [ ] **Code rollback**
  - Git revert to previous commit
  - Remove model files
  - Restore .env.local

---

## Post-Deployment Checklist

### After Launch

- [ ] **Monitor for 24 hours**
  - Check error logs
  - Monitor performance
  - User feedback

- [ ] **Test with real users**
  - Upload real photos
  - Assign names
  - Verify matching works

- [ ] **Performance tuning**
  - Adjust thresholds if needed
  - Optimize slow queries
  - Add caching if needed

- [ ] **User feedback**
  - Gather feedback on accuracy
  - Adjust confidence thresholds
  - Improve UI/UX

---

## Quick Reference

### Important Files

- **Migration:** `migrations/003_add_face_profiles.sql`
- **Setup Guide:** `FACE_PROFILES_SETUP.md`
- **Implementation Plan:** `docs/FACE_PROFILES_IMPLEMENTATION_PLAN.md`
- **Summary:** `IMPLEMENTATION_COMPLETE_SUMMARY.md`

### Key Commands

\`\`\`bash
# Install dependencies
npm install @vladmandic/face-api @tensorflow/tfjs-node canvas

# Start dev server
npm run dev

# Check database
psql $DATABASE_URL -c "SELECT COUNT(*) FROM face_profiles;"
\`\`\`

### Key Configuration

\`\`\`bash
# Enable feature
ENABLE_FACE_DETECTION=true

# Adjust threshold (optional)
FACE_MATCHING_THRESHOLD=0.4

# Minimum confidence (optional)
FACE_MIN_CONFIDENCE=0.5
\`\`\`

---

## Status Tracking

### Current Status

- [x] Database schema designed
- [x] Migration file created
- [x] Service layer implemented
- [x] API endpoints created
- [x] Webhook integration complete
- [x] Configuration added
- [x] Documentation written
- [ ] Database migration run
- [ ] Dependencies installed
- [ ] Models downloaded
- [ ] Feature tested
- [ ] Production deployed

### Next Actions

1. ⚠️ **RUN MIGRATION** in Supabase
2. 📦 **INSTALL PACKAGES** via npm
3. 📥 **DOWNLOAD MODELS** to public/models/
4. ⚙️ **ENABLE FEATURE** in .env.local
5. 🧪 **TEST** with photo uploads

---

## Notes

- **Start with disabled:** Keep `ENABLE_FACE_DETECTION=false` until fully tested
- **Test incrementally:** Enable for small batch first
- **Monitor closely:** Watch logs for first 24 hours
- **Have rollback ready:** Can disable feature instantly
- **User feedback:** Gather feedback on accuracy

---

## ✅ Ready to Deploy

Once all checkboxes above are complete, the Face Profiles feature is ready for production!

**Estimated time to complete:** 30-60 minutes
**Risk level:** Low (can be disabled instantly if issues arise)
**Impact:** High (major new feature for users)

🎉 Good luck with the deployment!
