# n8n Webhook Integration Documentation

This document provides comprehensive information about the n8n webhook orchestration endpoints used in the FindMyPhoto application.

## Overview

The application uses n8n webhooks as orchestration points for two key functionalities:
1. **Manual Image Upload** - Processing and embedding generation for uploaded images
2. **Find Photos (Semantic Search)** - Text-based or image-based similarity search

---

## 1. Manual Image Upload Webhook

### Purpose
Processes manually uploaded images, generates embeddings, and stores them for semantic search capabilities.

### Endpoint Configuration
```bash
N8N_WEBHOOK_MANUAL_IMAGE_UPLOAD=https://your-n8n-instance.com/webhook/manual-image-upload
```

### API Endpoint
```
POST /api/photos/upload
```

### Request Format (Client → API)
**Content-Type:** `multipart/form-data`

```typescript
FormData {
  files: File[]  // Array of image files
}
```

### Webhook Payload (API → n8n)
**Content-Type:** `application/json`

```json
{
  "user_id": "string",           // User UUID from Supabase auth
  "images": [
    {
      "name": "string",          // Original filename (e.g., "vacation.jpg")
      "data": "string",          // Base64 encoded image data
      "type": "string",          // MIME type (e.g., "image/jpeg", "image/png")
      "size": number             // File size in bytes
    }
  ],
  "timestamp": "string"          // ISO 8601 timestamp
}
```

### Example Payload
```json
{
  "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "images": [
    {
      "name": "beach-sunset.jpg",
      "data": "/9j/4AAQSkZJRgABAQEAYABgAAD...",
      "type": "image/jpeg",
      "size": 2048576
    },
    {
      "name": "family-photo.png",
      "data": "iVBORw0KGgoAAAANSUhEUgAA...",
      "type": "image/png",
      "size": 1536000
    }
  ],
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

### Validation Rules
- **File Types:** `image/jpeg`, `image/jpg`, `image/png`, `image/webp`, `image/gif`
- **Max File Size:** 10MB per file
- **Required Fields:** All fields in the payload are required
- **Authentication:** User must be authenticated via Supabase

### Expected n8n Workflow
1. **Receive webhook payload** with base64 image data
2. **Upload to Supabase Storage**:
   - Decode base64 data to binary image
   - Upload to `photos` bucket with path: `{user_id}/{timestamp}-{filename}`
   - Get public URL
3. **Insert to Database**:
   - Insert record into `photos` table with:
     - `name`: Original filename
     - `file_url`: Public Supabase Storage URL
     - `type`: MIME type
     - `size`: File size in bytes
     - `data`: Base64 encoded data (for processing)
     - `caption`: null (can be added later)
4. **Generate vision embeddings** (e.g., using CLIP, ResNet, or similar model)
5. **Update embeddings** in Supabase `photos` table (vector column)
6. **Enable images for semantic search queries**
7. (Optional) Generate thumbnails
8. (Optional) Extract metadata (EXIF, dominant colors, etc.)

**Important:** The Next.js API only validates and converts images to base64. ALL Supabase operations (storage upload, database insert, embedding generation) happen in n8n.

### Error Handling
- Returns 400 if file type is invalid
- Returns 400 if file size exceeds limit
- Returns 401 if user is not authenticated
- Returns 500 for server errors
- Webhook failures do not fail the upload request (logged only)

---

## 2. Find Photos (Semantic Search) Webhook

### Purpose
Performs semantic search across uploaded photos using either natural language queries or reference images.

### Endpoint Configuration
```bash
N8N_WEBHOOK_FIND_PHOTOS=https://your-n8n-instance.com/webhook/find-photos
```

### API Endpoint
```
POST /api/webhooks/album-create-request
```

### Request Format (Client → API)
**Content-Type:** `application/json`

#### Option A: Text Query
```json
{
  "query": "string"  // Natural language description of desired photos
}
```

#### Option B: Image-Based Search
```json
{
  "image": "string"  // Base64 encoded reference image
}
```

### Webhook Payload (API → n8n)
**Content-Type:** `application/json`

#### Text Query Format
```json
{
  "userId": "string",           // User UUID
  "requestId": number,          // Album request ID from database
  "query": "string",            // Natural language query
  "timestamp": "string"         // ISO 8601 timestamp
}
```

#### Image Query Format
```json
{
  "userId": "string",           // User UUID
  "requestId": number,          // Album request ID from database
  "image": "string",            // Base64 encoded reference image
  "timestamp": "string"         // ISO 8601 timestamp
}
```

### Example Payloads

#### Text-Based Search
```json
{
  "userId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "requestId": 42,
  "query": "sunset at the beach with palm trees",
  "timestamp": "2025-01-15T14:22:00.000Z"
}
```

#### Image-Based Search
```json
{
  "userId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "requestId": 43,
  "image": "/9j/4AAQSkZJRgABAQEAYABgAAD...",
  "timestamp": "2025-01-15T14:25:00.000Z"
}
```

### Validation Rules
- **Required:** Either `query` OR `image` must be provided (not both)
- **Query Length:** Minimum 1 character
- **Image Format:** Valid base64 encoded image
- **Authentication:** User must be authenticated

### Expected n8n Workflow

#### For Text Queries:
1. Receive webhook with text query
2. Generate text embedding (e.g., using CLIP text encoder)
3. Perform vector similarity search in Supabase
4. Retrieve top K matching photos (e.g., K=20)
5. Rank results by similarity score
6. Return photo IDs and URLs to application
7. Update `album_requests` table with results

#### For Image Queries:
1. Receive webhook with base64 image
2. Decode base64 to binary
3. Generate image embedding
4. Perform vector similarity search
5. Retrieve visually similar photos
6. Rank by similarity score
7. Return results
8. Update database

### Response Flow
The webhook should update the database directly or return results via a callback mechanism. The frontend polls or receives updates to display suggested photos.

---

## Database Schema Reference

### Photos Table
```sql
CREATE TABLE public.photos (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  file_url TEXT,
  type TEXT,
  size NUMERIC,
  caption TEXT,
  embedding public.vector,    -- pgvector type for semantic search
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  data TEXT                   -- Base64 encoded image data
) TABLESPACE pg_default;
```

### Album Requests Table
```sql
CREATE TABLE public.album_requests (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  user_description TEXT,
  processing_status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);
```

---

## n8n Workflow Setup Guide

### Workflow 1: Manual Image Upload

**Trigger:** Webhook (POST)
**URL:** `/webhook/manual-image-upload`

**Nodes:**
1. **Webhook Trigger** - Receive payload
2. **Function Node** - Extract images array
3. **Loop Node** - Process each image
   - Decode base64 data
   - Generate embeddings (HTTP Request to ML model)
   - Store in Supabase (UPDATE photos SET embedding = ...)
4. **Response Node** - Send success confirmation

**Required Credentials:**
- Supabase API Key (for database updates)
- ML Model API (e.g., OpenAI CLIP, Hugging Face)

### Workflow 2: Find Photos (Semantic Search)

**Trigger:** Webhook (POST)
**URL:** `/webhook/find-photos`

**Nodes:**
1. **Webhook Trigger** - Receive query or image
2. **Switch Node** - Check if query or image provided
3. **Branch A (Text Query):**
   - HTTP Request to text embedding service
   - Generate query embedding
4. **Branch B (Image Query):**
   - Decode base64 image
   - HTTP Request to image embedding service
   - Generate image embedding
5. **Supabase Query Node** - Vector similarity search
   ```sql
   SELECT id, name, file_url,
          1 - (embedding <=> $1) as similarity
   FROM photos
   WHERE user_id = $2
   ORDER BY embedding <=> $1
   LIMIT 20
   ```
6. **Function Node** - Format results
7. **Supabase Update Node** - Update album_requests status
8. **Response Node** - Return results

**Required Credentials:**
- Supabase API Key
- Text embedding service (e.g., OpenAI)
- Image embedding service (e.g., CLIP API)

---

## Testing Webhooks

### Test Manual Upload
```bash
curl -X POST https://your-app.com/api/photos/upload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "files=@/path/to/image1.jpg" \
  -F "files=@/path/to/image2.png"
```

### Test Text Search
```bash
curl -X POST https://your-app.com/api/webhooks/album-create-request \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "query": "sunset at the beach"
  }'
```

### Test Image Search
```bash
curl -X POST https://your-app.com/api/webhooks/album-create-request \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "image": "BASE64_ENCODED_IMAGE_STRING"
  }'
```

---

## Error Handling Best Practices

### In n8n Workflows:

1. **Add Error Handlers:**
   - Catch embedding generation failures
   - Handle database connection errors
   - Log failures for debugging

2. **Implement Retries:**
   - Retry ML API calls (max 3 times)
   - Exponential backoff for rate limits

3. **Validation:**
   - Verify base64 data is valid
   - Check embedding dimensions match schema
   - Validate user_id exists

4. **Monitoring:**
   - Log processing times
   - Track success/failure rates
   - Alert on high error rates

---

## Security Considerations

1. **Authentication:**
   - All API endpoints require valid Supabase JWT
   - n8n webhooks should validate signatures (if configured)

2. **Data Privacy:**
   - Images are user-specific
   - Embeddings never shared between users
   - Search results filtered by user_id

3. **Rate Limiting:**
   - Implement rate limits on upload endpoint
   - Throttle search requests per user

4. **Data Validation:**
   - Sanitize file names
   - Validate MIME types
   - Check for malicious content

---

## Performance Optimization

1. **Batch Processing:**
   - Process multiple images in parallel
   - Use batch embedding APIs when available

2. **Caching:**
   - Cache frequently accessed embeddings
   - Use CDN for image URLs

3. **Database Indexing:**
   - Create index on embedding column (pgvector IVFFlat or HNSW)
   - Index on user_id for faster filtering

4. **Async Processing:**
   - Use background jobs for slow operations
   - Return immediate response to user

---

## Troubleshooting

### Webhook Not Triggering
- Verify environment variables are set correctly
- Check n8n workflow is active
- Ensure webhook URL is accessible
- Review n8n execution logs

### Embedding Generation Fails
- Check ML API credentials
- Verify image format is supported
- Ensure base64 decoding works
- Test with smaller images

### Search Returns No Results
- Verify embeddings are stored in database
- Check vector similarity function syntax
- Ensure user has uploaded photos
- Test with known matching queries

---

## Migration Notes

### Updating from Old Webhook Format

**Old Format (Deprecated):**
```json
{
  "event": "photos_uploaded",
  "uploaded_files": [
    {
      "publicUrl": "https://...",
      "originalName": "file.jpg"
    }
  ]
}
```

**New Format (Current):**
```json
{
  "user_id": "uuid",
  "images": [
    {
      "name": "file.jpg",
      "data": "base64...",
      "type": "image/jpeg",
      "size": 123456
    }
  ]
}
```

### Migration Steps:
1. Update n8n workflows to accept new format
2. Test with both formats during transition
3. Deploy API changes
4. Remove old webhook handlers
5. Update documentation

---

## Support & Resources

- **n8n Documentation:** https://docs.n8n.io
- **pgvector Documentation:** https://github.com/pgvector/pgvector
- **Supabase Vector Guide:** https://supabase.com/docs/guides/ai
- **CLIP Model:** https://github.com/openai/CLIP

For issues or questions, check the project README or contact the development team.
