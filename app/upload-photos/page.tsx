"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Sparkles, Upload, X, ImageIcon, Check, ArrowLeft } from "lucide-react"

interface UploadedImage {
  id: string
  file: File
  preview: string
}

export default function UploadPhotosPage() {
  const router = useRouter()
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadComplete, setUploadComplete] = useState(false)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    const newImages = files.map((file) => ({
      id: Math.random().toString(36).substring(7),
      file,
      preview: URL.createObjectURL(file),
    }))
    setUploadedImages([...uploadedImages, ...newImages])
  }

  const removeImage = (id: string) => {
    const image = uploadedImages.find((img) => img.id === id)
    if (image) {
      URL.revokeObjectURL(image.preview)
    }
    setUploadedImages(uploadedImages.filter((img) => img.id !== id))
  }

  const handleUpload = async () => {
    if (uploadedImages.length === 0) return

    setIsUploading(true)
    setUploadProgress(0)

    const formData = new FormData()
    uploadedImages.forEach((image) => {
      formData.append("files", image.file)
    })

    try {
      const response = await fetch("/api/photos/upload", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error("Upload failed")
      }

      const result = await response.json()

      // Simulate progress for better UX
      setUploadProgress(100)

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
      <main className="container mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold text-foreground">Upload Photos</h1>
          <p className="text-muted-foreground">
            Add photos to your collection. These will be available for creating albums with AI-powered semantic search.
          </p>
        </div>

        {!uploadComplete ? (
          <Card className="border-white/20 bg-white/60 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Select Photos</CardTitle>
              <CardDescription>
                Choose multiple photos to upload. Supported formats: JPG, PNG, WEBP
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Upload Area */}
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
                  <div className="flex min-h-[200px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/20 p-8 text-center transition-colors hover:border-muted-foreground/50 hover:bg-muted/30">
                    <Upload className="mb-4 h-12 w-12 text-muted-foreground" />
                    <p className="mb-2 text-lg font-medium text-foreground">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Upload as many photos as you'd like
                    </p>
                  </div>
                </div>
              )}

              {/* Preview Grid */}
              {uploadedImages.length > 0 && (
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">
                      {uploadedImages.length} photo{uploadedImages.length !== 1 ? "s" : ""} selected
                    </p>
                    {!isUploading && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          uploadedImages.forEach((img) => URL.revokeObjectURL(img.preview))
                          setUploadedImages([])
                        }}
                      >
                        Clear All
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
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
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upload Progress */}
              {isUploading && (
                <div className="space-y-4">
                  <Progress value={uploadProgress} className="h-2" />
                  <p className="text-center text-sm text-muted-foreground">
                    Uploading photos... {uploadProgress}%
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-4">
                <Button
                  onClick={handleUpload}
                  disabled={uploadedImages.length === 0 || isUploading}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700"
                  size="lg"
                >
                  <Upload className="mr-2 h-5 w-5" />
                  {isUploading ? "Uploading..." : `Upload ${uploadedImages.length} Photo${uploadedImages.length !== 1 ? "s" : ""}`}
                </Button>
              </div>
            </CardContent>
          </Card>
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
            <p>• AI analyzes each photo for semantic search capabilities</p>
            <p>• Use natural language to find and create albums from your photos</p>
            <p>• Your photos remain private and only accessible to you</p>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
