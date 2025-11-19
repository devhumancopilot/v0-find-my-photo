"""
CLIP Inference API for Hugging Face Spaces
A FastAPI service that provides CLIP embeddings for images and text

Deploy this to Hugging Face Spaces with SDK: Docker
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import CLIPProcessor, CLIPModel
from PIL import Image
import torch
import base64
import io
import logging
from typing import List

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI
app = FastAPI(
    title="CLIP Inference API",
    description="Generate CLIP embeddings for images and text",
    version="1.0.0"
)

# Add CORS middleware to allow requests from your Vercel app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict this to your domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables
model = None
processor = None
device = None

# Request/Response models
class TextEmbeddingRequest(BaseModel):
    text: str

class ImageEmbeddingRequest(BaseModel):
    image: str  # base64 encoded image
    mime_type: str = "image/jpeg"

class EmbeddingResponse(BaseModel):
    embedding: List[float]
    dimensions: int

class HealthResponse(BaseModel):
    model_config = {"protected_namespaces": ()}  # Allow model_ prefix

    status: str
    model_loaded: bool
    device: str
    model_name: str

@app.on_event("startup")
async def load_model():
    """Load CLIP model on startup"""
    global model, processor, device

    logger.info("=" * 60)
    logger.info("Loading CLIP model...")
    logger.info("=" * 60)

    try:
        # Use CPU (HF Spaces free tier)
        device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"Using device: {device}")

        # Load model
        model_name = "openai/clip-vit-base-patch32"
        logger.info(f"Loading model: {model_name}")

        processor = CLIPProcessor.from_pretrained(model_name)
        model = CLIPModel.from_pretrained(model_name).to(device)
        model.eval()  # Set to evaluation mode

        logger.info("✅ CLIP model loaded successfully!")
        logger.info(f"Model parameters: ~{sum(p.numel() for p in model.parameters()) / 1e6:.1f}M")
        logger.info("=" * 60)

    except Exception as e:
        logger.error(f"❌ Failed to load CLIP model: {e}")
        raise

@app.get("/", tags=["Info"])
async def root():
    """Root endpoint with API information"""
    return {
        "service": "CLIP Inference API",
        "version": "1.0.0",
        "model": "openai/clip-vit-base-patch32",
        "dimensions": 512,
        "endpoints": {
            "health": "GET /health",
            "embed_text": "POST /embed/text",
            "embed_image": "POST /embed/image"
        },
        "docs": "/docs"
    }

@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy" if model is not None else "unhealthy",
        "model_loaded": model is not None,
        "device": str(device) if device else "unknown",
        "model_name": "openai/clip-vit-base-patch32"
    }

@app.post("/embed/text", response_model=EmbeddingResponse, tags=["Embeddings"])
async def embed_text(request: TextEmbeddingRequest):
    """
    Generate text embedding using CLIP

    - **text**: The text to embed (e.g., "a photo of a dog")

    Returns a 512-dimensional embedding vector normalized for cosine similarity
    """
    if model is None or processor is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    try:
        text = request.text
        logger.info(f"[TEXT] Embedding: '{text[:50]}...'")

        # Process text
        with torch.no_grad():
            # Process text with padding and truncation for robustness
            inputs = processor(
                text=[text],
                return_tensors="pt",
                padding=True,
                truncation=True,
                max_length=77  # CLIP's max context length
            ).to(device)

            text_features = model.get_text_features(**inputs)

            # Normalize for cosine similarity
            text_features = text_features / text_features.norm(dim=-1, keepdim=True)

            embedding = text_features.cpu().numpy()[0].tolist()

        logger.info(f"[TEXT] ✅ Generated {len(embedding)}D embedding")

        return {
            "embedding": embedding,
            "dimensions": len(embedding)
        }

    except Exception as e:
        logger.error(f"[TEXT] ❌ Error: {e}")
        raise HTTPException(status_code=500, detail=f"Embedding generation failed: {str(e)}")

@app.post("/embed/image", response_model=EmbeddingResponse, tags=["Embeddings"])
async def embed_image(request: ImageEmbeddingRequest):
    """
    Generate image embedding using CLIP

    - **image**: Base64 encoded image data
    - **mime_type**: Image MIME type (optional, default: image/jpeg)

    Returns a 512-dimensional embedding vector normalized for cosine similarity
    """
    if model is None or processor is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    try:
        base64_image = request.image
        logger.info(f"[IMAGE] Processing image (~{len(base64_image) // 1024}KB base64)")

        # Decode base64 image
        try:
            image_bytes = base64.b64decode(base64_image)
            image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
            logger.info(f"[IMAGE] Image size: {image.size}")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid image data: {str(e)}")

        # Process image
        with torch.no_grad():
            # Process single image - ensure it's treated as a batch of 1
            inputs = processor(
                images=[image],  # Pass as list for proper batching
                return_tensors="pt"
            ).to(device)

            image_features = model.get_image_features(**inputs)

            # Normalize for cosine similarity
            image_features = image_features / image_features.norm(dim=-1, keepdim=True)

            embedding = image_features.cpu().numpy()[0].tolist()

        logger.info(f"[IMAGE] ✅ Generated {len(embedding)}D embedding")

        return {
            "embedding": embedding,
            "dimensions": len(embedding)
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[IMAGE] ❌ Error: {e}")
        raise HTTPException(status_code=500, detail=f"Embedding generation failed: {str(e)}")

# For Hugging Face Spaces, you can also add a simple UI endpoint
@app.get("/test", tags=["Testing"])
async def test_page():
    """Simple test page"""
    return {
        "message": "Use the /docs endpoint to test the API interactively",
        "example_text": {
            "endpoint": "/embed/text",
            "method": "POST",
            "body": {"text": "a photo of a dog"}
        },
        "example_image": {
            "endpoint": "/embed/image",
            "method": "POST",
            "body": {"image": "base64_encoded_image_data"}
        }
    }

if __name__ == "__main__":
    import uvicorn
    # For local testing
    uvicorn.run(app, host="0.0.0.0", port=7860)
