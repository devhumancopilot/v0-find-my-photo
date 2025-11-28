"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Sparkles, ArrowLeft, ArrowRight, Loader2, ImageIcon, Calendar, Check, X, Upload } from "lucide-react"
import { useSearchStream } from "@/hooks/use-search-stream"
import { SearchProgressLoader } from "@/components/search-progress-loader"
import { getBackendAPIURL, getAuthHeaders } from "@/lib/config"

type Step = 1 | 2 | 3

// Type for photos returned from n8n
interface SuggestedPhoto {
  id: number
  name: string
  file_url: string
  caption: string
  similarity: number
}

export default function CreateAlbumPage() {
  const [currentStep, setCurrentStep] = useState<Step>(1)
  const [isProcessing, setIsProcessing] = useState(false)
  const [albumTitle, setAlbumTitle] = useState("")
  const [albumDescription, setAlbumDescription] = useState("")
  const [suggestedPhotos, setSuggestedPhotos] = useState<SuggestedPhoto[]>([])
  const [selectedPhotos, setSelectedPhotos] = useState<number[]>([])

  // Use streaming hook for real-time progress
  const { isSearching, progress: searchProgress, result: searchResult, error: searchError, startSearch } = useSearchStream()

  const totalSteps = 3
  const progress = (currentStep / totalSteps) * 100

  // Watch for search results and auto-advance to step 2
  useEffect(() => {
    if (searchResult && searchResult.photos && Array.isArray(searchResult.photos)) {
      console.log("[v0] ✅ Search complete! Setting suggested photos:", searchResult.photos.length)
      setSuggestedPhotos(searchResult.photos)

      // Auto-select all photos by default
      const photoIds = searchResult.photos.map((photo: SuggestedPhoto) => photo.id)
      console.log("[v0] Auto-selecting photo IDs:", photoIds)
      setSelectedPhotos(photoIds)

      if (searchResult.photos.length === 0) {
        console.warn("[v0] ⚠️ No photos returned from search")
        alert("No matching photos found. Try a different search query.")
      } else {
        console.log("[v0] Moving to step 2")
        setCurrentStep(2)
      }
    }
  }, [searchResult]) // Re-run when searchResult changes

  // Watch for search errors
  useEffect(() => {
    if (searchError) {
      console.error("[v0] ❌ Search error:", searchError)
      alert("Failed to find photos: " + searchError)
    }
  }, [searchError])

  const handleNext = async () => {
    if (currentStep === 1) {
      // Trigger AI semantic search via streaming API
      // Results will be handled by useEffect when searchResult updates
      await startSearch({
        query: albumDescription,
        albumTitle: albumTitle,
      })
    } else if (currentStep === 2) {
      // Move from Step 2 to Step 3
      setCurrentStep(3)
    } else if (currentStep === 3) {
      // Finalize album - send to n8n via backend
      setIsProcessing(true)
      try {
        const authHeaders = await getAuthHeaders()
        const response = await fetch(getBackendAPIURL("/api/webhooks/album-finalized"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders,
          },
          body: JSON.stringify({
            albumTitle: albumTitle,
            photoIds: selectedPhotos, // Array of photo IDs like [14, 15, 16]
            description: albumDescription,
            coverPhotoId: selectedPhotos[0] || null, // First selected photo as cover
          }),
        })

        if (!response.ok) {
          throw new Error("Failed to create album")
        }

        const data = await response.json()
        console.log("[v0] Album created:", data)

        // Redirect to dashboard on success
        window.location.href = "/dashboard"
      } catch (error) {
        console.error("[v0] Album creation error:", error)
        alert("Failed to create album. Please try again.")
        setIsProcessing(false)
      }
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

  const canProceed = currentStep === 1 ? albumDescription.trim().length > 0 && !isSearching : selectedPhotos.length > 0

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

                {/* Show progress loader when searching */}
                {isSearching && searchProgress && (
                  <SearchProgressLoader progress={searchProgress} className="mb-6" />
                )}

                <div className="flex w-full flex-col sm:flex-row items-center justify-between gap-3">
                  <Button variant="outline" className="flex-1 w-full bg-transparent" asChild disabled={isSearching}>
                    <Link href="/dashboard" className="flex w-full items-center justify-center">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Cancel
                    </Link>
                  </Button>
                  <Button
                    onClick={handleNext}
                    disabled={!canProceed || isSearching}
                    className="flex-1 w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700"
                  >
                    {isSearching ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Finding Photos...
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

              {suggestedPhotos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <ImageIcon className="mb-4 h-12 w-12 text-muted-foreground" />
                  <h3 className="mb-2 text-lg font-semibold text-foreground">No photos found</h3>
                  <p className="text-sm text-muted-foreground">
                    Try adjusting your search criteria or upload photos manually
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {suggestedPhotos.map((photo) => (
                    <button
                      key={photo.id}
                      onClick={() => togglePhotoSelection(photo.id)}
                      className="group relative aspect-square overflow-hidden rounded-xl border-2 transition-all hover:shadow-lg"
                      style={{
                        borderColor: selectedPhotos.includes(photo.id) ? "hsl(var(--primary))" : "hsl(var(--border))",
                      }}
                      title={photo.caption}
                    >
                      <img
                        src={photo.file_url}
                        alt={photo.caption || photo.name}
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
                      {/* Show similarity score */}
                      <div className="absolute bottom-2 left-2 rounded-md bg-black/70 px-2 py-1 text-xs text-white">
                        {Math.round(photo.similarity * 100)}% match
                      </div>
                    </button>
                  ))}
                </div>
              )}

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

                <div className="space-y-3">
                  <div className="flex w-full flex-col sm:flex-row items-center justify-between gap-3">
                    <Button
                      onClick={handleBack}
                      variant="outline"
                      className="flex-1 w-full bg-transparent"
                      disabled={isProcessing}
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                    <Button
                      onClick={handleNext}
                      disabled={isProcessing}
                      className="flex-1 w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating Album...
                        </>
                      ) : (
                        <>
                          <Check className="mr-2 h-4 w-4" />
                          Create Album
                        </>
                      )}
                    </Button>
                  </div>
                  {isProcessing && (
                    <p className="text-xs text-center text-blue-600 font-medium">
                      Organizing your {selectedPhotos.length} photo{selectedPhotos.length !== 1 ? 's' : ''} into a beautiful album. Almost done!
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
