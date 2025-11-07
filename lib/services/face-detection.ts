/**
 * Face Detection Service
 * Uses face-api.js for face detection and recognition
 */

import path from "path"

// Note: Using CPU backend (no @tensorflow/tfjs-node required)
// If you need GPU acceleration, install @tensorflow/tfjs-node separately

let modelsLoaded = false
let modelLoadPromise: Promise<void> | null = null
let faceapi: any = null

/**
 * Initialize face-api with proper polyfills for Node.js
 */
async function initFaceAPI() {
  if (faceapi) {
    return faceapi
  }

  try {
    // Polyfill TextEncoder/TextDecoder for Node.js BEFORE importing face-api
    const util = await import("util")
    if (typeof global.TextEncoder === "undefined") {
      global.TextEncoder = util.TextEncoder as any
    }
    if (typeof global.TextDecoder === "undefined") {
      global.TextDecoder = util.TextDecoder as any
    }

    // Dynamically import face-api and canvas
    const faceapiModule = await import("@vladmandic/face-api")
    const canvasModule = await import("canvas")

    faceapi = faceapiModule

    // Monkey patch for Node.js environment
    faceapi.env.monkeyPatch({
      Canvas: canvasModule.Canvas,
      Image: canvasModule.Image,
      ImageData: canvasModule.ImageData,
    } as any)

    console.log("[FaceAPI] Initialized successfully")
    return faceapi
  } catch (error) {
    console.error("[FaceAPI] Failed to initialize:", error)
    throw new Error(`Face detection initialization failed: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

/**
 * Load face-api models (only once)
 * Models are loaded from public/models/ directory
 */
export async function loadModels(): Promise<void> {
  // If models are already loaded, return immediately
  if (modelsLoaded) {
    return
  }

  // If loading is in progress, wait for it
  if (modelLoadPromise) {
    return modelLoadPromise
  }

  // Start loading models
  modelLoadPromise = (async () => {
    try {
      // Initialize face-api first
      await initFaceAPI()

      const modelPath = path.join(process.cwd(), "public", "models")

      console.log("[FaceAPI] Loading models from:", modelPath)

      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromDisk(modelPath),
        faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath),
        faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath),
        // Optional: Age/Gender and Expressions
        // faceapi.nets.ageGenderNet.loadFromDisk(modelPath),
        // faceapi.nets.faceExpressionNet.loadFromDisk(modelPath),
      ])

      modelsLoaded = true
      console.log("[FaceAPI] Models loaded successfully")
    } catch (error) {
      console.error("[FaceAPI] Failed to load models:", error)
      modelLoadPromise = null
      throw error
    }
  })()

  return modelLoadPromise
}

export interface DetectedFace {
  box: {
    x: number
    y: number
    width: number
    height: number
  }
  descriptor: number[] // 128-dimensional face embedding
  confidence: number
  age?: number
  gender?: string
  genderProbability?: number
  expressions?: Record<string, number>
}

/**
 * Detect all faces in an image and extract embeddings
 * @param imageBuffer - Image buffer (JPEG, PNG, etc.)
 * @returns Array of detected faces with embeddings
 */
export async function detectFaces(imageBuffer: Buffer): Promise<DetectedFace[]> {
  try {
    // Load models if not already loaded
    await loadModels()

    // Import canvas dynamically
    const { Image } = await import("canvas")

    // Load image into canvas
    const img = new Image()
    img.src = imageBuffer

    console.log("[FaceAPI] Detecting faces in image...")

    // Detect faces with landmarks and descriptors
    const detections = await faceapi
      .detectAllFaces(img as any, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
      .withFaceLandmarks()
      .withFaceDescriptors()
    // Optional: Add age/gender and expressions
    // .withAgeAndGender()
    // .withFaceExpressions()

    console.log("[FaceAPI] Detected", detections.length, "faces")

    // Handle case where no faces are detected
    if (!detections || detections.length === 0) {
      console.log("[FaceAPI] No faces detected in image")
      return []
    }

    // Map to our format
    return detections.map((detection) => {
      const result: DetectedFace = {
        box: {
          x: Math.round(detection.detection.box.x),
          y: Math.round(detection.detection.box.y),
          width: Math.round(detection.detection.box.width),
          height: Math.round(detection.detection.box.height),
        },
        descriptor: Array.from(detection.descriptor),
        confidence: detection.detection.score,
      }

      // Add optional fields if available
      // if (detection.age) result.age = Math.round(detection.age)
      // if (detection.gender) {
      //   result.gender = detection.gender
      //   result.genderProbability = detection.genderProbability
      // }
      // if (detection.expressions) {
      //   result.expressions = detection.expressions
      // }

      return result
    })
  } catch (error) {
    console.error("[FaceAPI] Face detection error:", error)
    throw new Error(`Face detection failed: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

/**
 * Calculate Euclidean distance between two face descriptors
 * Lower distance = more similar faces
 *
 * Distance interpretation:
 * - 0.0 = Identical faces
 * - < 0.6 = Same person (recommended threshold)
 * - 0.6 - 1.0 = Different people
 * - > 1.0 = Very different
 *
 * @param descriptor1 - First face descriptor (128D)
 * @param descriptor2 - Second face descriptor (128D)
 * @returns Distance between 0.0 (identical) and ~1.5 (very different)
 */
export async function calculateDistance(descriptor1: number[], descriptor2: number[]): Promise<number> {
  if (descriptor1.length !== 128 || descriptor2.length !== 128) {
    throw new Error("Face descriptors must be 128-dimensional")
  }

  // Initialize face-api if needed
  if (!faceapi) {
    await initFaceAPI()
  }

  return faceapi.euclideanDistance(descriptor1, descriptor2)
}

/**
 * Convert Euclidean distance to cosine similarity
 * Cosine similarity is between 0 (different) and 1 (identical)
 *
 * @param distance - Euclidean distance
 * @returns Similarity score (0.0 to 1.0)
 */
export function distanceToSimilarity(distance: number): number {
  // Rough conversion (not exact, but useful)
  // Distance 0 = Similarity 1.0
  // Distance 0.6 = Similarity 0.4
  // Distance 1.0+ = Similarity 0.0
  return Math.max(0, 1 - distance)
}

/**
 * Check if two faces match based on distance threshold
 *
 * @param descriptor1 - First face descriptor
 * @param descriptor2 - Second face descriptor
 * @param threshold - Distance threshold (default: 0.6)
 * @returns True if faces match (same person)
 */
export async function areFacesMatching(
  descriptor1: number[],
  descriptor2: number[],
  threshold: number = 0.6
): Promise<boolean> {
  const distance = await calculateDistance(descriptor1, descriptor2)
  return distance < threshold
}

/**
 * Find best matching face from a list of candidates
 *
 * @param queryDescriptor - Face descriptor to match
 * @param candidates - Array of candidate face descriptors with IDs
 * @param threshold - Distance threshold (default: 0.6)
 * @returns Best match or null if no match found
 */
export async function findBestMatch(
  queryDescriptor: number[],
  candidates: Array<{ id: number; descriptor: number[]; name: string }>,
  threshold: number = 0.6
): Promise<{ id: number; name: string; distance: number; similarity: number } | null> {
  let bestMatch: { id: number; name: string; distance: number; similarity: number } | null = null
  let minDistance = threshold // Only consider matches below threshold

  for (const candidate of candidates) {
    const distance = await calculateDistance(queryDescriptor, candidate.descriptor)

    if (distance < minDistance) {
      minDistance = distance
      bestMatch = {
        id: candidate.id,
        name: candidate.name,
        distance,
        similarity: distanceToSimilarity(distance),
      }
    }
  }

  return bestMatch
}

/**
 * Validate face descriptor format
 */
export function isValidDescriptor(descriptor: any): descriptor is number[] {
  return Array.isArray(descriptor) && descriptor.length === 128 && descriptor.every((n) => typeof n === "number")
}
