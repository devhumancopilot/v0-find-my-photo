---
title: CLIP Inference API
emoji: 🖼️
colorFrom: blue
colorTo: purple
sdk: docker
pinned: false
license: mit
---

# CLIP Inference API 🖼️

A FastAPI service that provides CLIP (Contrastive Language-Image Pre-training) embeddings for images and text.

## 🚀 Features

- **Text Embeddings**: Convert text queries to 512-dimensional vectors
- **Image Embeddings**: Convert images to 512-dimensional vectors
- **Multimodal**: Text and images share the same embedding space
- **Normalized**: All embeddings are normalized for cosine similarity
- **Fast**: Optimized for inference with caching

## 📊 Model

- **Model**: `openai/clip-vit-base-patch32`
- **Dimensions**: 512
- **Architecture**: Vision Transformer (ViT-B/32)

## 🔌 API Endpoints

### Health Check
\`\`\`bash
GET /health
\`\`\`

### Text Embedding
\`\`\`bash
POST /embed/text
Content-Type: application/json

{
  "text": "a photo of a dog"
}
\`\`\`

**Response:**
\`\`\`json
{
  "embedding": [0.123, -0.456, ...],
  "dimensions": 512
}
\`\`\`

### Image Embedding
\`\`\`bash
POST /embed/image
Content-Type: application/json

{
  "image": "base64_encoded_image_data",
  "mime_type": "image/jpeg"
}
\`\`\`

**Response:**
\`\`\`json
{
  "embedding": [0.789, -0.234, ...],
  "dimensions": 512
}
\`\`\`

## 📖 Interactive Documentation

Visit `/docs` for interactive API documentation powered by Swagger UI.

## 🧪 Example Usage

### Python
\`\`\`python
import requests
import base64

# Text embedding
response = requests.post(
    "https://YOUR-SPACE-URL.hf.space/embed/text",
    json={"text": "a photo of a cat"}
)
embedding = response.json()["embedding"]

# Image embedding
with open("image.jpg", "rb") as f:
    image_base64 = base64.b64encode(f.read()).decode()

response = requests.post(
    "https://YOUR-SPACE-URL.hf.space/embed/image",
    json={"image": image_base64}
)
embedding = response.json()["embedding"]
\`\`\`

### JavaScript
\`\`\`javascript
// Text embedding
const response = await fetch('https://YOUR-SPACE-URL.hf.space/embed/text', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: 'a photo of a dog' })
});
const { embedding } = await response.json();

// Image embedding
const base64Image = btoa(imageData);
const response = await fetch('https://YOUR-SPACE-URL.hf.space/embed/image', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ image: base64Image })
});
const { embedding } = await response.json();
\`\`\`

## 🔒 CORS

CORS is enabled for all origins. In production, you should restrict this to your specific domain.

## ⚡ Performance

- **Cold Start**: ~30-60 seconds (first request after idle)
- **Warm Inference**: ~0.5-2 seconds per request
- **Device**: CPU (HF Spaces free tier)

## 📝 License

MIT License

## 🙏 Acknowledgments

- [OpenAI CLIP](https://github.com/openai/CLIP)
- [Hugging Face Transformers](https://huggingface.co/transformers/)
- [FastAPI](https://fastapi.tiangolo.com/)
