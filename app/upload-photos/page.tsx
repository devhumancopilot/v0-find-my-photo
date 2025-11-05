"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Sparkles, Upload, X, ImageIcon, Check, ArrowLeft, Image as ImageIconLucide, CheckCircle } from "lucide-react"
import { GooglePhotosPicker } from "@/components/google-photos-picker"

interface UploadedImage {
  id: string
  file: File
  preview: string
  source: 'manual'
}

interface GooglePhoto {
  id: string
  baseUrl: string
  mimeType: string
  filename?: string
  source: 'google_photos'
}

// Browser-compatible base64 encoding function
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export default function UploadPhotosPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([])
  const [googlePhotos, setGooglePhotos] = useState<GooglePhoto[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadComplete, setUploadComplete] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Check for OAuth callback success
  useEffect(() => {
    const success = searchParams.get('success')
    if (success === 'google_photos_connected') {
      setSuccessMessage('Google Photos connected successfully! You can now select photos.')
      // Clear the URL parameter
      window.history.replaceState({}, '', '/upload-photos')
    }
  }, [searchParams])

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    const newImages = files.map((file) => ({
      id: Math.random().toString(36).substring(7),
      file,
      preview: URL.createObjectURL(file),
      source: 'manual' as const,
    }))
    setUploadedImages([...uploadedImages, ...newImages])
  }

  const handleGooglePhotosSelected = useCallback((photos: Array<{ id: string; baseUrl: string; mimeType: string; filename?: string }>) => {
    const newGooglePhotos = photos.map((photo) => ({
      ...photo,
      source: 'google_photos' as const,
    }))
    setGooglePhotos(newGooglePhotos)
  }, [])

  const removeImage = (id: string) => {
    const image = uploadedImages.find((img) => img.id === id)
    if (image) {
      URL.revokeObjectURL(image.preview)
    }
    setUploadedImages(uploadedImages.filter((img) => img.id !== id))
  }

  const removeGooglePhoto = (id: string) => {
    setGooglePhotos(googlePhotos.filter((photo) => photo.id !== id))
  }

  const totalPhotos = uploadedImages.length + googlePhotos.length

  const handleUpload = async () => {
    if (totalPhotos === 0) return

    setIsUploading(true)
    setUploadProgress(0)

    try {
      let uploadedCount = 0
      const allPayloads: Array<{
        name: string
        data: string
        type: string
        size: number
      }> = []

      // Convert manual files to base64 payloads
      if (uploadedImages.length > 0) {
        for (const image of uploadedImages) {
          const fileBuffer = await image.file.arrayBuffer()
          // Use browser-compatible base64 encoding instead of Node.js Buffer
          const base64Data = arrayBufferToBase64(fileBuffer)

          const payload = {
            name: image.file.name,
            data: base64Data,
            type: image.file.type,
            size: image.file.size,
          }

          console.log(`Converted device photo to base64:`, {
            name: payload.name,
            type: payload.type,
            size: payload.size,
            base64Length: payload.data.length,
          })

          allPayloads.push(payload)

          uploadedCount++
          setUploadProgress((uploadedCount / totalPhotos) * 100)
        }
      }

      // Convert Google Photos to base64 payloads
      if (googlePhotos.length > 0) {
        for (const photo of googlePhotos) {
          try {
            // Fetch the full-size image from Google Photos via our proxy
            // Use =d parameter to download the original quality
            const proxyUrl = `/api/google-photos/proxy-image?url=${encodeURIComponent(photo.baseUrl)}&size=d`

            console.log(`Fetching Google Photo ${photo.id} for upload...`)
            const imageResponse = await fetch(proxyUrl)

            if (!imageResponse.ok) {
              console.error(`Failed to fetch Google Photo ${photo.id}:`, imageResponse.status, imageResponse.statusText)
              continue
            }

            const imageBuffer = await imageResponse.arrayBuffer()
            // Use browser-compatible base64 encoding instead of Node.js Buffer
            const base64Data = arrayBufferToBase64(imageBuffer)

            const payload = {
              name: photo.filename || `google-photo-${photo.id}.jpg`,
              data: base64Data,
              type: photo.mimeType,
              size: imageBuffer.byteLength,
            }

            console.log(`Converted Google Photo ${photo.id} to base64:`, {
              name: payload.name,
              type: payload.type,
              size: payload.size,
              base64Length: payload.data.length,
            })

            allPayloads.push(payload)

            uploadedCount++
            setUploadProgress((uploadedCount / totalPhotos) * 100)
          } catch (error) {
            console.error(`Error processing Google Photo ${photo.id}:`, error)
            // Continue with other photos
          }
        }
      }

      // Send all photos through the webhook
      if (allPayloads.length > 0) {
        console.log(`Sending ${allPayloads.length} photos to webhook:`, {
          totalPhotos: allPayloads.length,
          devicePhotos: uploadedImages.length,
          googlePhotos: googlePhotos.length,
          payloadStructure: allPayloads.map((p) => ({
            name: p.name,
            type: p.type,
            size: p.size,
            hasBase64Data: !!p.data,
            base64Length: p.data.length,
          })),
        })

        const response = await fetch("/api/webhooks/photos-upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            images: allPayloads,
          }),
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error("Upload failed:", response.status, errorText)
          throw new Error("Upload failed")
        }

        const result = await response.json()
        console.log("Upload successful:", result)
      }

      // Clean up object URLs
      uploadedImages.forEach((image) => {
        URL.revokeObjectURL(image.preview)
      })

      setUploadComplete(true)

      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        router.push("/dashboard")
      }, 2000)
    } catch (error) {
      console.error("Upload error:", error)
      alert("Failed to upload photos. Please try again.")
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Header */}
      <header className="border-b border-white/20 bg-white/40 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-semibold text-foreground">Find My Photo</span>
          </Link>

          <Link href="/dashboard">
            <Button variant="ghost">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold text-foreground">Upload Photos</h1>
          <p className="text-muted-foreground">
            Add photos to your collection. These will be available for creating albums with AI-powered semantic search.
          </p>
        </div>

        {successMessage && (
          <Alert className="mb-6 border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">{successMessage}</AlertDescription>
          </Alert>
        )}

        {!uploadComplete ? (
          <div className="space-y-6">
            {/* Horizontal Layout: Manual Upload and Google Photos */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Manual Upload Section */}
              <Card className="border-white/20 bg-white/60 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Upload from Device
                  </CardTitle>
                  <CardDescription>
                    Choose photos from your device
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!isUploading && (
                    <div className="relative">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleFileSelect}
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        disabled={isUploading}
                      />
                      <div className="flex min-h-[200px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/20 p-6 text-center transition-colors hover:border-muted-foreground/50 hover:bg-muted/30">
                        <Upload className="mb-3 h-10 w-10 text-muted-foreground" />
                        <p className="mb-1 text-base font-medium text-foreground">
                          Click to upload
                        </p>
                        <p className="text-xs text-muted-foreground">
                          JPG, PNG, WEBP
                        </p>
                        {uploadedImages.length > 0 && (
                          <p className="mt-3 text-sm font-semibold text-blue-600">
                            {uploadedImages.length} photo{uploadedImages.length !== 1 ? "s" : ""} selected
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Google Photos Picker Section */}
              <Card className="border-white/20 bg-white/60 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ImageIconLucide className="h-5 w-5" />
                    Import from Google Photos
                  </CardTitle>
                  <CardDescription>
                    Connect and select photos
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex min-h-[200px] flex-col items-center justify-center">
                    <GooglePhotosPicker
                      onPhotosSelected={handleGooglePhotosSelected}
                      showSelectedCount={false}
                    />
                    {googlePhotos.length > 0 && (
                      <p className="mt-3 text-sm font-semibold text-blue-600">
                        {googlePhotos.length} photo{googlePhotos.length !== 1 ? "s" : ""} selected
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Combined Preview Section at Bottom */}
            {(uploadedImages.length > 0 || googlePhotos.length > 0) && (
              <Card className="border-white/20 bg-white/60 backdrop-blur-sm">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Selected Photos</CardTitle>
                      <CardDescription>
                        {totalPhotos} photo{totalPhotos !== 1 ? "s" : ""} ready to upload
                        {uploadedImages.length > 0 && ` • ${uploadedImages.length} from device`}
                        {googlePhotos.length > 0 && ` • ${googlePhotos.length} from Google Photos`}
                      </CardDescription>
                    </div>
                    {!isUploading && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          uploadedImages.forEach((img) => URL.revokeObjectURL(img.preview))
                          setUploadedImages([])
                          setGooglePhotos([])
                        }}
                      >
                        Clear All
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
                    {/* Manual Upload Preview Images */}
                    {uploadedImages.map((image) => (
                      <div key={image.id} className="group relative aspect-square overflow-hidden rounded-lg">
                        <img
                          src={image.preview}
                          alt="Preview"
                          className="h-full w-full object-cover"
                        />
                        {!isUploading && (
                          <button
                            onClick={() => removeImage(image.id)}
                            className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                        <div className="absolute bottom-2 left-2 rounded bg-purple-600 px-2 py-1 text-xs text-white">
                          Device
                        </div>
                      </div>
                    ))}

                    {/* Google Photos Preview Images */}
                    {googlePhotos.map((photo) => (
                      <div key={photo.id} className="group relative aspect-square overflow-hidden rounded-lg bg-muted/20">
                        {photo.baseUrl ? (
                          <img
                            src={`/api/google-photos/proxy-image?url=${encodeURIComponent(photo.baseUrl)}&size=w400-h400`}
                            alt={photo.filename || "Google Photo"}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              console.error('Failed to load Google Photo via proxy:', photo.id, photo.baseUrl);
                              // Show error placeholder
                              e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400"%3E%3Crect fill="%23ddd" width="400" height="400"/%3E%3Ctext fill="%23999" font-family="sans-serif" font-size="16" x="50%25" y="50%25" text-anchor="middle" dominant-baseline="middle"%3ELoading Error%3C/text%3E%3C/svg%3E';
                            }}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-muted/40">
                            <p className="text-xs text-muted-foreground">No preview</p>
                          </div>
                        )}
                        {!isUploading && (
                          <button
                            onClick={() => removeGooglePhoto(photo.id)}
                            className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                        <div className="absolute bottom-2 left-2 rounded bg-blue-600 px-2 py-1 text-xs text-white">
                          Google Photos
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Upload Progress */}
            {isUploading && (
              <Card className="border-white/20 bg-white/60 backdrop-blur-sm">
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <Progress value={uploadProgress} className="h-2" />
                    <p className="text-center text-sm text-muted-foreground">
                      Uploading photos... {Math.round(uploadProgress)}%
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Action Buttons */}
            {totalPhotos > 0 && !isUploading && (
              <Card className="border-white/20 bg-white/60 backdrop-blur-sm">
                <CardContent className="pt-6">
                  <div className="flex flex-col gap-4">
                    <div className="text-center">
                      <p className="text-lg font-semibold text-foreground">
                        Ready to upload {totalPhotos} photo{totalPhotos !== 1 ? "s" : ""}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {uploadedImages.length > 0 && `${uploadedImages.length} from device`}
                        {uploadedImages.length > 0 && googlePhotos.length > 0 && " • "}
                        {googlePhotos.length > 0 && `${googlePhotos.length} from Google Photos`}
                      </p>
                    </div>
                    <Button
                      onClick={handleUpload}
                      disabled={isUploading}
                      className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700"
                      size="lg"
                    >
                      <Upload className="mr-2 h-5 w-5" />
                      {isUploading ? "Uploading..." : `Upload All Photos`}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <Card className="border-white/20 bg-white/60 backdrop-blur-sm">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-foreground">Upload Complete!</h3>
              <p className="mb-6 text-muted-foreground">
                Your photos have been uploaded and are being processed for semantic search.
              </p>
              <div className="flex gap-4">
                <Link href="/dashboard">
                  <Button variant="outline">Go to Dashboard</Button>
                </Link>
                <Link href="/create-album">
                  <Button className="bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700">
                    <Sparkles className="mr-2 h-4 w-4" />
                    Create Album
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info Card */}
        <Card className="mt-8 border-white/20 bg-white/60 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ImageIcon className="h-5 w-5" />
              How It Works
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• Photos are securely stored in your personal collection</p>
            <p>• Import photos from Google Photos or upload from your device</p>
            <p>• AI analyzes each photo for semantic search capabilities</p>
            <p>• Use natural language to find and create albums from your photos</p>
            <p>• Your photos remain private and only accessible to you</p>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
