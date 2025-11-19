# Face Profiles Feature Implementation Plan

## Overview

Implement automatic face detection and recognition system that:
1. Detects faces in uploaded photos
2. Stores face embeddings (128-dimensional vectors) in Supabase
3. Automatically matches new faces with existing profiles
4. Allows users to manually label and manage face profiles

---

## Architecture

```
Photo Upload
    ↓
Face Detection (face-api.js)
    ↓
Extract Face Embeddings (128D vectors)
    ↓
Compare with Existing Embeddings
    ↓
    ├─ Match Found (similarity < 0.6) → Link to existing profile
    └─ No Match → Create new profile (face_name = NULL)
    ↓
Store in face_profiles table
    ↓
User reviews Face Profiles UI → Assigns names manually
```

---

## Technology Stack

### Face Detection Library

**Recommended: @vladmandic/face-api** (modern fork)
- Built on TensorFlow.js 4.x
- Works in Node.js and browser
- 128-dimensional face descriptors
- Includes age, gender, emotion detection
- Better maintained than original face-api.js

**Alternative: @tensorflow-models/facemesh**
- Official TensorFlow model
- More lightweight
- No face recognition (only detection)

**Decision: Use @vladmandic/face-api** for comprehensive face recognition

---

## Database Schema

### New Table: `face_profiles`

```sql
CREATE TABLE public.face_profiles (
  -- Primary Key
  id bigserial PRIMARY KEY,

  -- Relationships
  photo_id bigint NOT NULL REFERENCES public.photos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Face Data
  face_embedding vector(128) NOT NULL,  -- pgvector for similarity search
  face_name text,  -- NULL initially, user assigns manually

  -- Bounding Box (for display)
  bbox_x integer NOT NULL,  -- Top-left X coordinate
  bbox_y integer NOT NULL,  -- Top-left Y coordinate
  bbox_width integer NOT NULL,
  bbox_height integer NOT NULL,

  -- Confidence & Metadata
  detection_confidence real NOT NULL,  -- 0.0 to 1.0
  metadata jsonb,  -- Age, gender, emotion (optional)

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Indexes
  CONSTRAINT face_profiles_photo_user_fk FOREIGN KEY (photo_id, user_id)
    REFERENCES public.photos(id, user_id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_face_profiles_photo_id ON public.face_profiles(photo_id);
CREATE INDEX idx_face_profiles_user_id ON public.face_profiles(user_id);
CREATE INDEX idx_face_profiles_face_name ON public.face_profiles(face_name) WHERE face_name IS NOT NULL;
CREATE INDEX idx_face_profiles_created_at ON public.face_profiles(created_at DESC);

-- Vector index for similarity search (HNSW for speed)
CREATE INDEX idx_face_profiles_embedding ON public.face_profiles
  USING hnsw (face_embedding vector_cosine_ops);

-- RLS Policies
ALTER TABLE public.face_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own face profiles"
  ON public.face_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own face profiles"
  ON public.face_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own face profiles"
  ON public.face_profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own face profiles"
  ON public.face_profiles FOR DELETE
  USING (auth.uid() = user_id);

-- Updated_at trigger
CREATE TRIGGER set_face_profiles_updated_at
  BEFORE UPDATE ON public.face_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
```

### Similarity Search Function

```sql
-- Find similar faces using cosine similarity
CREATE OR REPLACE FUNCTION match_faces(
  query_embedding vector(128),
  match_user_id uuid,
  similarity_threshold float DEFAULT 0.6,
  match_limit int DEFAULT 1
)
RETURNS TABLE (
  id bigint,
  photo_id bigint,
  face_name text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    fp.id,
    fp.photo_id,
    fp.face_name,
    1 - (fp.face_embedding <=> query_embedding) as similarity
  FROM public.face_profiles fp
  WHERE
    fp.user_id = match_user_id
    AND fp.face_name IS NOT NULL  -- Only match named profiles
    AND (1 - (fp.face_embedding <=> query_embedding)) >= similarity_threshold
  ORDER BY fp.face_embedding <=> query_embedding
  LIMIT match_limit;
END;
$$;
```

---

## Implementation Steps

### Phase 1: Setup & Dependencies

#### 1.1 Install Dependencies

```bash
npm install @vladmandic/face-api
npm install @tensorflow/tfjs-node  # For server-side processing
npm install canvas  # Required for Node.js image processing
```

#### 1.2 Download Model Files

face-api requires model files:
- `face_detection_model` (SSD MobileNetV1)
- `face_landmark_68_model`
- `face_recognition_model` (generates 128D descriptors)
- `age_gender_model` (optional)
- `face_expression_model` (optional)

Store in: `public/models/` or download dynamically

---

### Phase 2: Service Layer

#### 2.1 Create `lib/services/face-detection.ts`

```typescript
import * as faceapi from '@vladmandic/face-api'
import * as tf from '@tensorflow/tfjs-node'
import { Canvas, Image, ImageData } from 'canvas'
import path from 'path'

// Monkey patch for Node.js environment
faceapi.env.monkeyPatch({ Canvas, Image, ImageData } as any)

let modelsLoaded = false

/**
 * Load face-api models (only once)
 */
export async function loadModels() {
  if (modelsLoaded) return

  const modelPath = path.join(process.cwd(), 'public', 'models')

  await Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromDisk(modelPath),
    faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath),
    faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath),
    faceapi.nets.ageGenderNet.loadFromDisk(modelPath),  // Optional
    faceapi.nets.faceExpressionNet.loadFromDisk(modelPath),  // Optional
  ])

  modelsLoaded = true
  console.log('[FaceAPI] Models loaded successfully')
}

/**
 * Detect all faces in an image and extract embeddings
 */
export async function detectFaces(imageBuffer: Buffer) {
  await loadModels()

  // Load image into canvas
  const img = new Image()
  img.src = imageBuffer

  // Detect faces with landmarks and descriptors
  const detections = await faceapi
    .detectAllFaces(img as any)
    .withFaceLandmarks()
    .withFaceDescriptors()
    .withAgeAndGender()  // Optional
    .withFaceExpressions()  // Optional

  return detections.map(detection => ({
    box: detection.detection.box,  // { x, y, width, height }
    descriptor: Array.from(detection.descriptor),  // 128D array
    confidence: detection.detection.score,
    age: detection.age,  // Optional
    gender: detection.gender,  // Optional
    expressions: detection.expressions,  // Optional
  }))
}

/**
 * Calculate Euclidean distance between two face descriptors
 * Lower distance = more similar
 * Threshold: 0.6 (faces are same person if distance < 0.6)
 */
export function calculateDistance(
  descriptor1: number[],
  descriptor2: number[]
): number {
  return faceapi.euclideanDistance(descriptor1, descriptor2)
}

/**
 * Compare face descriptor against stored embeddings
 * Returns best match if similarity is below threshold
 */
export async function findMatchingFace(
  descriptor: number[],
  userId: string,
  threshold: number = 0.6
): Promise<{ id: number; face_name: string; similarity: number } | null> {
  // Use Supabase RPC to find similar faces
  // Implementation in database.ts
  return null  // Placeholder
}
```

#### 2.2 Update `lib/services/database.ts`

Add face profile operations:

```typescript
export interface FaceProfileInsertData {
  photo_id: number
  user_id: string
  face_embedding: number[]
  bbox_x: number
  bbox_y: number
  bbox_width: number
  bbox_height: number
  detection_confidence: number
  face_name?: string | null
  metadata?: Record<string, any>
}

/**
 * Insert face profile into database
 */
export async function insertFaceProfile(data: FaceProfileInsertData): Promise<number> {
  const supabase = await createClient()

  const { data: result, error } = await supabase
    .from('face_profiles')
    .insert({
      photo_id: data.photo_id,
      user_id: data.user_id,
      face_embedding: JSON.stringify(data.face_embedding),
      bbox_x: data.bbox_x,
      bbox_y: data.bbox_y,
      bbox_width: data.bbox_width,
      bbox_height: data.bbox_height,
      detection_confidence: data.detection_confidence,
      face_name: data.face_name || null,
      metadata: data.metadata || null,
    })
    .select('id')
    .single()

  if (error) throw new Error(`Failed to insert face profile: ${error.message}`)
  return result.id
}

/**
 * Find matching face profiles using vector similarity
 */
export async function matchFaces(
  embedding: number[],
  userId: string,
  threshold: number = 0.6
): Promise<{ id: number; photo_id: number; face_name: string; similarity: number }[]> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('match_faces', {
    query_embedding: JSON.stringify(embedding),
    match_user_id: userId,
    similarity_threshold: threshold,
    match_limit: 1,
  })

  if (error) throw new Error(`Face matching failed: ${error.message}`)
  return data || []
}

/**
 * Update face name for a profile
 */
export async function updateFaceName(
  faceProfileId: number,
  faceName: string,
  userId: string
): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('face_profiles')
    .update({ face_name: faceName })
    .eq('id', faceProfileId)
    .eq('user_id', userId)

  if (error) throw new Error(`Failed to update face name: ${error.message}`)
}

/**
 * Get all face profiles for a user (grouped by face_name)
 */
export async function getFaceProfiles(userId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('face_profiles')
    .select(`
      id,
      photo_id,
      face_name,
      bbox_x,
      bbox_y,
      bbox_width,
      bbox_height,
      detection_confidence,
      metadata,
      created_at,
      photos (
        id,
        name,
        file_url,
        thumbnail_url
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch face profiles: ${error.message}`)
  return data
}
```

---

### Phase 3: Update Photo Upload Workflow

#### 3.1 Update `app/api/dev-webhooks/photos-upload/route.ts`

Add face detection after photo upload:

```typescript
// After inserting photo into database...
console.log(`[Fallback] Detecting faces in ${name}`)

try {
  // Convert base64 to buffer
  const imageBuffer = Buffer.from(data, 'base64')

  // Detect faces
  const faces = await detectFaces(imageBuffer)

  console.log(`[Fallback] Detected ${faces.length} faces in ${name}`)

  // Process each detected face
  for (let j = 0; j < faces.length; j++) {
    const face = faces[j]

    // Try to match with existing face profiles
    const matches = await matchFaces(face.descriptor, user_id, 0.6)

    let faceName = null
    if (matches.length > 0) {
      // Match found! Inherit the face_name
      faceName = matches[0].face_name
      console.log(`[Fallback] Face ${j+1} matched to: ${faceName} (similarity: ${matches[0].similarity.toFixed(3)})`)
    } else {
      console.log(`[Fallback] Face ${j+1} is new (no match found)`)
    }

    // Insert face profile
    await insertFaceProfile({
      photo_id: photoId,
      user_id,
      face_embedding: face.descriptor,
      bbox_x: Math.round(face.box.x),
      bbox_y: Math.round(face.box.y),
      bbox_width: Math.round(face.box.width),
      bbox_height: Math.round(face.box.height),
      detection_confidence: face.confidence,
      face_name: faceName,
      metadata: {
        age: face.age,
        gender: face.gender,
        expressions: face.expressions,
      },
    })
  }
} catch (faceError) {
  console.error(`[Fallback] Face detection failed for ${name}:`, faceError)
  // Continue - don't fail photo upload if face detection fails
}
```

---

### Phase 4: API Endpoints

#### 4.1 Get Face Profiles

`app/api/face-profiles/route.ts`:

```typescript
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const profiles = await getFaceProfiles(user.id)

  // Group by face_name
  const grouped = profiles.reduce((acc, profile) => {
    const key = profile.face_name || 'unknown'
    if (!acc[key]) acc[key] = []
    acc[key].push(profile)
    return acc
  }, {} as Record<string, any[]>)

  return NextResponse.json({ profiles: grouped })
}
```

#### 4.2 Update Face Name

`app/api/face-profiles/[id]/route.ts`:

```typescript
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { face_name } = await request.json()

  await updateFaceName(parseInt(params.id), face_name, user.id)

  return NextResponse.json({ success: true })
}
```

#### 4.3 Bulk Update Face Names

`app/api/face-profiles/bulk-update/route.ts`:

```typescript
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { face_profile_ids, face_name } = await request.json()

  // Update multiple profiles at once
  const { error } = await supabase
    .from('face_profiles')
    .update({ face_name })
    .in('id', face_profile_ids)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, updated_count: face_profile_ids.length })
}
```

---

### Phase 5: UI Implementation

#### 5.1 Create Face Profiles Page

`app/face-profiles/page.tsx`:

Features:
- Display all detected faces grouped by person
- Faces with NULL face_name shown as "Unknown Person"
- Click to assign name
- Drag-and-drop to merge profiles
- Show photo thumbnails with face bounding boxes

UI Layout:
```
┌─────────────────────────────────────────┐
│  Face Profiles                          │
├─────────────────────────────────────────┤
│  [Unknown Faces] (15)                   │
│  ┌───┬───┬───┬───┬───┐                 │
│  │😀│😀│😀│😀│😀│ ...              │
│  └───┴───┴───┴───┴───┘                 │
│  [Assign Name Button]                   │
├─────────────────────────────────────────┤
│  John Doe (24)                          │
│  ┌───┬───┬───┬───┬───┐                 │
│  │😀│😀│😀│😀│😀│ ...              │
│  └───┴───┴───┴───┴───┘                 │
│  [Edit Name] [Merge]                    │
├─────────────────────────────────────────┤
│  Jane Smith (18)                        │
│  ┌───┬───┬───┬───┬───┐                 │
│  │😀│😀│😀│😀│😀│ ...              │
│  └───┴───┴───┴───┴───┘                 │
│  [Edit Name] [Merge]                    │
└─────────────────────────────────────────┘
```

---

## Configuration

### Environment Variables

Add to `.env.local`:

```bash
# Face Detection Configuration
ENABLE_FACE_DETECTION=true
FACE_MATCHING_THRESHOLD=0.6  # Distance threshold (0.0 = identical, 1.0 = different)
FACE_MIN_CONFIDENCE=0.5  # Minimum detection confidence
```

---

## Performance Considerations

### 1. Processing Time
- Face detection: ~500ms - 2s per image
- Process faces **after** photo upload completes
- Consider background job queue for large batches

### 2. Model Loading
- Load models once on server startup
- Models total size: ~15MB
- Cache in memory

### 3. Database Performance
- HNSW index for fast vector similarity search
- Batch insert face profiles
- Index on face_name for filtering

### 4. Fallback Strategy
- If face detection fails, continue photo upload
- Log errors but don't block user experience
- Retry mechanism for transient failures

---

## Testing Plan

### Unit Tests
- Face detection accuracy
- Embedding similarity calculation
- Database operations

### Integration Tests
- Photo upload → Face detection → Profile creation
- Face matching logic
- Name assignment workflow

### Manual Tests
1. Upload photo with 1 face → Verify profile created
2. Upload another photo of same person → Verify auto-linking
3. Upload photo with multiple faces → Verify all detected
4. Assign names via UI → Verify updates
5. Test with edge cases: side profile, sunglasses, etc.

---

## Migration Strategy

### Step 1: Database Migration
```bash
# Create face_profiles table
npm run supabase:migration create face_profiles
```

### Step 2: Install Dependencies
```bash
npm install @vladmandic/face-api @tensorflow/tfjs-node canvas
```

### Step 3: Download Models
```bash
# Download to public/models/
# Or use CDN in production
```

### Step 4: Feature Flag
```bash
# Enable gradually
ENABLE_FACE_DETECTION=false  # Start disabled
ENABLE_FACE_DETECTION=true   # Enable after testing
```

---

## Future Enhancements

1. **Browser-side Detection** - Detect faces in browser before upload
2. **Face Cropping** - Store cropped face thumbnails
3. **Smart Albums** - Auto-create albums by person
4. **Face Search** - "Find all photos of John"
5. **Privacy Mode** - Blur unidentified faces
6. **Face Clustering** - ML-based grouping suggestions
7. **Multi-face Search** - "Find photos with John AND Jane"

---

## Security & Privacy

1. **User Isolation** - RLS policies ensure users only see their faces
2. **No Cross-user Matching** - Face matching only within user's data
3. **Opt-out** - Allow users to disable face detection
4. **Data Deletion** - Cascade delete face profiles when photo deleted
5. **Embedding Storage** - Embeddings are mathematical vectors, not images

---

## Cost Analysis

### OpenAI API (Current)
- $0.13 per 1K images (caption + embedding)

### Face Detection (New)
- **Free** - Runs locally in Node.js
- No API costs
- CPU/memory cost on server

### Storage (Supabase)
- Face embeddings: 128 floats × 4 bytes = 512 bytes per face
- 1M faces = ~512MB
- Negligible cost

---

## Summary

This implementation provides:
✅ Automatic face detection on upload
✅ Smart face matching with existing profiles
✅ Manual labeling interface
✅ Privacy-first design
✅ Cost-effective (no API costs for detection)
✅ Scalable vector similarity search

Next steps: Execute implementation in phases, starting with database migration.
