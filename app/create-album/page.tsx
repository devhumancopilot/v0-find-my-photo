"use client"

import type React from "react"

import { useState, useRef } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Sparkles, ArrowLeft, ArrowRight, Loader2, ImageIcon, Calendar, Check, X, Upload, Trash2 } from "lucide-react"

type Step = 1 | 2 | 3

// Mock AI-suggested photos
const suggestedPhotos = [
  { id: 1, url: "/beach-sunset-golden-hour.jpg", selected: true },
  { id: 2, url: "/family-beach-playing.jpg", selected: true },
  { id: 3, url: "/beach-waves-closeup.jpg", selected: true },
  { id: 4, url: "/beach-umbrella-chairs.jpg", selected: false },
  { id: 5, url: "/beach-footprints-sand.jpg", selected: true },
  { id: 6, url: "/beach-palm-trees.jpg", selected: false },
  { id: 7, url: "/beach-seashells-collection.jpg", selected: true },
  { id: 8, url: "/beach-volleyball-game.jpg", selected: false },
  { id: 9, url: "/beach-picnic-setup.jpg", selected: true },
]

interface UploadedImage {
  id: string
  file: File
  preview: string
}

export default function CreateAlbumPage() {
  const [currentStep, setCurrentStep] = useState<Step>(1)
  const [isProcessing, setIsProcessing] = useState(false)
  const [albumTitle, setAlbumTitle] = useState("")
  const [albumDescription, setAlbumDescription] = useState("")
  const [selectedPhotos, setSelectedPhotos] = useState<number[]>([1, 2, 3, 5, 7, 9])
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const totalSteps = 3
  const progress = (currentStep / totalSteps) * 100

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    const newImages: UploadedImage[] = Array.from(files).map((file) => ({
      id: Math.random().toString(36).substring(7),
      file,
      preview: URL.createObjectURL(file),
    }))

    setUploadedImages((prev) => [...prev, ...newImages])
  }

  const handleRemoveImage = (id: string) => {
    setUploadedImages((prev) => {
      const image = prev.find((img) => img.id === id)
      if (image) {
        URL.revokeObjectURL(image.preview)
      }
      return prev.filter((img) => img.id !== id)
    })
  }

  const handleUploadImages = async () => {
    if (uploadedImages.length === 0) return

    setIsUploading(true)
    try {
      const formData = new FormData()
      uploadedImages.forEach((img) => {
        formData.append("files", img.file)
      })
      formData.append("albumTitle", albumTitle)
      formData.append("albumDescription", albumDescription)

      const response = await fetch("/api/webhooks/photos-uploaded", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error("Failed to upload images")
      }

      const data = await response.json()
      console.log("[v0] Images uploaded successfully:", data)

      // Clear uploaded images after successful upload
      uploadedImages.forEach((img) => URL.revokeObjectURL(img.preview))
      setUploadedImages([])
    } catch (error) {
      console.error("[v0] Upload error:", error)
      alert("Failed to upload images. Please try again.")
    } finally {
      setIsUploading(false)
    }
  }

  const handleNext = async () => {
    if (currentStep === 1) {
      if (uploadedImages.length > 0) {
        await handleUploadImages()
      }

      // Simulate AI processing
      setIsProcessing(true)
      setTimeout(() => {
        setIsProcessing(false)
        setCurrentStep(2)
      }, 2000)
    } else if (currentStep < 3) {
      setCurrentStep((prev) => (prev + 1) as Step)
    } else {
      // Create album
      window.location.href = "/dashboard"
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as Step)
    }
  }

  const togglePhotoSelection = (photoId: number) => {
    setSelectedPhotos((prev) => (prev.includes(photoId) ? prev.filter((id) => id !== photoId) : [...prev, photoId]))
  }

  const canProceed = currentStep === 1 ? albumDescription.trim().length > 0 : selectedPhotos.length > 0

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
          <Button variant="ghost" asChild>
            <Link href="/dashboard">
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Link>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-4xl">
          {/* Progress Bar */}
          <div className="mb-8">
            <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Step {currentStep} of {totalSteps}
              </span>
              <span>{Math.round(progress)}% complete</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Step 1: Describe Album */}
          {currentStep === 1 && (
            <Card className="border-white/20 bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-2xl">Describe Your Album</CardTitle>
                <CardDescription>
                  Tell us what kind of album you want to create, or upload your own photos.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 p-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Album Title (Optional)</Label>
                  <Input
                    id="title"
                    placeholder="e.g., Summer Vacation 2024"
                    value={albumTitle}
                    onChange={(e) => setAlbumTitle(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">What are you looking for?</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe the photos you want in this album. For example: 'Photos from my beach vacation last summer' or 'Pictures of my dog playing in the park'"
                    rows={6}
                    value={albumDescription}
                    onChange={(e) => setAlbumDescription(e.target.value)}
                    className="resize-none"
                  />
                  <p className="text-sm text-muted-foreground">{albumDescription.length}/500 characters</p>
                </div>

                <div className="rounded-lg border border-border bg-muted/50 p-4">
                  <h3 className="mb-3 font-semibold text-foreground">Quick Suggestions</h3>
                  <div className="flex flex-wrap gap-2">
                    {[
                      "Beach vacation photos",
                      "Family gatherings",
                      "Birthday celebrations",
                      "Pet photos",
                      "Nature and landscapes",
                      "Food and dining",
                    ].map((suggestion) => (
                      <Badge
                        key={suggestion}
                        variant="secondary"
                        className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                        onClick={() => setAlbumDescription(suggestion)}
                      >
                        {suggestion}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground">Or Upload Your Own Photos</h3>
                      <p className="text-sm text-muted-foreground">
                        Upload images to build your knowledge base for semantic search
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Choose Files
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </div>

                  {uploadedImages.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-foreground">
                          {uploadedImages.length} image{uploadedImages.length > 1 ? "s" : ""} ready to upload
                        </p>
                        {!isUploading && (
                          <Button size="sm" onClick={handleUploadImages} disabled={isUploading}>
                            {isUploading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Uploading...
                              </>
                            ) : (
                              <>
                                <Upload className="mr-2 h-4 w-4" />
                                Upload Now
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                        {uploadedImages.map((img) => (
                          <div key={img.id} className="group relative aspect-square overflow-hidden rounded-lg border">
                            <img
                              src={img.preview || "/placeholder.svg"}
                              alt={img.file.name}
                              className="h-full w-full object-cover"
                            />
                            <button
                              onClick={() => handleRemoveImage(img.id)}
                              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex w-full flex-col sm:flex-row items-center justify-between gap-3">
                  <Button variant="outline" className="flex-1 w-full bg-transparent" asChild>
                    <Link href="/dashboard" className="flex w-full items-center justify-center">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Cancel
                    </Link>
                  </Button>
                  <Button
                    onClick={handleNext}
                    disabled={!canProceed || isProcessing || isUploading}
                    className="flex-1 w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        AI is finding photos...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Find Photos
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Review AI Suggestions */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <Card className="border-white/20 bg-white/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-2xl">AI Found {suggestedPhotos.length} Photos</CardTitle>
                  <CardDescription>
                    Review the suggestions and select the photos you want to include. You can add or remove photos.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="mb-4 rounded-lg bg-primary/10 p-4">
                    <div className="mb-3 flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary">
                        <Sparkles className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{selectedPhotos.length} photos selected</p>
                        <p className="text-sm text-muted-foreground">Click photos to add or remove them</p>
                      </div>
                    </div>
                    <div className="flex w-full flex-col sm:flex-row items-center justify-between gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedPhotos(suggestedPhotos.map((p) => p.id))}
                        className="flex-1 w-full"
                      >
                        Select All
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedPhotos([])}
                        className="flex-1 w-full"
                      >
                        Deselect All
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {suggestedPhotos.map((photo) => (
                  <button
                    key={photo.id}
                    onClick={() => togglePhotoSelection(photo.id)}
                    className="group relative aspect-square overflow-hidden rounded-xl border-2 transition-all hover:shadow-lg"
                    style={{
                      borderColor: selectedPhotos.includes(photo.id) ? "hsl(var(--primary))" : "hsl(var(--border))",
                    }}
                  >
                    <img
                      src={photo.url || "/placeholder.svg"}
                      alt={`Photo ${photo.id}`}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                    <div
                      className={`absolute inset-0 transition-opacity ${
                        selectedPhotos.includes(photo.id) ? "bg-primary/20" : "bg-black/0 group-hover:bg-black/10"
                      }`}
                    />
                    {selectedPhotos.includes(photo.id) && (
                      <div className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-primary shadow-lg">
                        <Check className="h-5 w-5 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>

              <Card className="border-white/20 bg-white/80 backdrop-blur-sm">
                <CardContent className="p-4">
                  <div className="flex w-full flex-col sm:flex-row items-center justify-between gap-3">
                    <Button onClick={handleBack} variant="outline" className="flex-1 w-full bg-transparent">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                    <Button
                      onClick={handleNext}
                      disabled={!canProceed}
                      className="flex-1 w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700"
                    >
                      Continue
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 3: Finalize Album */}
          {currentStep === 3 && (
            <Card className="border-white/20 bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-2xl">Finalize Your Album</CardTitle>
                <CardDescription>Add final details and create your album</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 p-4">
                <div className="space-y-2">
                  <Label htmlFor="final-title">Album Title</Label>
                  <Input
                    id="final-title"
                    placeholder="Give your album a name"
                    value={albumTitle}
                    onChange={(e) => setAlbumTitle(e.target.value)}
                  />
                </div>

                <div className="rounded-lg border border-border bg-muted/50 p-4">
                  <h3 className="mb-3 font-semibold text-foreground">Album Summary</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <ImageIcon className="h-4 w-4" />
                      <span>{selectedPhotos.length} photos selected</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Created today</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
                      <Sparkles className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <h3 className="mb-1 font-semibold text-foreground">AI Tip</h3>
                      <p className="text-sm text-muted-foreground">
                        You can always edit this album later, add more photos, or let AI suggest additional images based
                        on your selection.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex w-full flex-col sm:flex-row items-center justify-between gap-3">
                  <Button onClick={handleBack} variant="outline" className="flex-1 w-full bg-transparent">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    onClick={handleNext}
                    className="flex-1 w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700"
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Create Album
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
