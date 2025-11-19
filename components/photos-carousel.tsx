"use client"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FavoriteButton } from "@/components/favorite-button"
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog"
import {
  ImageIcon,
  Calendar,
  FileText,
  HardDrive,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

interface Photo {
  id: number
  name: string
  file_url: string | null
  type: string | null
  size: number | null
  caption: string | null
  created_at: string
  data: string | null
  is_favorite?: boolean
}

interface PhotosCarouselProps {
  photos: Photo[]
  isLoading?: boolean
}

export function PhotosCarousel({ photos, isLoading = false }: PhotosCarouselProps) {
  const router = useRouter()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [photoToDelete, setPhotoToDelete] = useState<Photo | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [centeredPhotoIndex, setCenteredPhotoIndex] = useState<number>(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [photoScales, setPhotoScales] = useState<Record<number, number>>({})
  const animationFrameRef = useRef<number | undefined>(undefined)
  const resumeTimeoutRef = useRef<number | undefined>(undefined)
  const countdownIntervalRef = useRef<number | undefined>(undefined)

  // Calculate scale based on position
  const updatePhotoScales = () => {
    if (!scrollRef.current || !containerRef.current) return

    const container = containerRef.current
    const containerRect = container.getBoundingClientRect()
    const containerCenter = containerRect.left + containerRect.width / 2

    const photos = scrollRef.current.querySelectorAll('.photo-card')
    const newScales: Record<number, number> = {}
    let closestIndex = 0
    let closestDistance = Infinity

    photos.forEach((photo, index) => {
      const photoRect = photo.getBoundingClientRect()
      const photoCenter = photoRect.left + photoRect.width / 2

      // Calculate distance from center (0 = perfect center, increases as it moves away)
      const distance = Math.abs(containerCenter - photoCenter)
      const maxDistance = containerRect.width / 2 // Half viewport width

      // Track which photo is closest to center
      if (distance < closestDistance) {
        closestDistance = distance
        closestIndex = index
      }

      // Calculate scale: 1.0 at center, 0.75 at edges
      const normalizedDistance = Math.min(distance / maxDistance, 1)
      const scale = 1.0 - (normalizedDistance * 0.25) // Scale from 1.0 to 0.75

      // Calculate opacity: 1.0 at center, 0.6 at edges
      const opacity = 1.0 - (normalizedDistance * 0.4) // Opacity from 1.0 to 0.6

      newScales[index] = scale

      // Apply the transform directly for smoother animation
      const element = photo as HTMLElement
      element.style.transform = `scale(${scale})`
      element.style.opacity = opacity.toString()
    })

    setPhotoScales(newScales)
    // Update centered photo index (map back to original photo index)
    setCenteredPhotoIndex(closestIndex % photos.length)
  }

  // Update scales on animation frame
  useEffect(() => {
    const animate = () => {
      updatePhotoScales()
      animationFrameRef.current = requestAnimationFrame(animate)
    }

    animationFrameRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (resumeTimeoutRef.current) {
        window.clearTimeout(resumeTimeoutRef.current)
      }
      if (countdownIntervalRef.current) {
        window.clearInterval(countdownIntervalRef.current)
      }
    }
  }, [photos.length])

  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return "Unknown"
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return "Unknown date"
    }
  }

  const handleDeleteClick = (photo: Photo, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent triggering photo click
    setPhotoToDelete(photo)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!photoToDelete) return

    setIsDeleting(true)

    try {
      const response = await fetch("/api/photos/delete", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ photoId: photoToDelete.id }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete photo")
      }

      toast.success("Photo Deleted", {
        description: `${photoToDelete.name} has been permanently deleted.`,
      })

      setDeleteDialogOpen(false)
      setPhotoToDelete(null)

      // Refresh the page to show updated photo list
      router.refresh()
    } catch (error) {
      console.error("Delete photo error:", error)
      toast.error("Delete Failed", {
        description: error instanceof Error ? error.message : "Failed to delete photo. Please try again.",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const handlePhotoClick = (index: number, e: React.MouseEvent) => {
    // Don't do anything if clicking on buttons
    if ((e.target as HTMLElement).closest('button')) {
      return
    }

    if (!scrollRef.current || !containerRef.current) return

    // Get the clicked photo element
    const photoElements = scrollRef.current.querySelectorAll('.photo-card')
    const clickedElement = photoElements[index] as HTMLElement
    if (!clickedElement) return

    // Pause animation
    setIsPaused(true)
    setCountdown(5)

    // Start countdown timer
    if (countdownIntervalRef.current) {
      window.clearInterval(countdownIntervalRef.current)
    }
    countdownIntervalRef.current = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          if (countdownIntervalRef.current) {
            window.clearInterval(countdownIntervalRef.current)
          }
          return null
        }
        return prev - 1
      })
    }, 1000)

    // Calculate the offset needed to center the clicked photo
    const containerRect = containerRef.current.getBoundingClientRect()
    const photoRect = clickedElement.getBoundingClientRect()
    const containerCenter = containerRect.left + containerRect.width / 2
    const photoCenter = photoRect.left + photoRect.width / 2
    const offsetNeeded = containerCenter - photoCenter

    // Get current transform and add the centering offset
    const currentTransform = window.getComputedStyle(scrollRef.current).transform
    let currentX = 0

    if (currentTransform && currentTransform !== 'none') {
      const matrix = currentTransform.match(/matrix\((.+)\)/)
      if (matrix) {
        const values = matrix[1].split(', ')
        currentX = parseFloat(values[4]) || 0
      }
    }

    // Apply the new transform to center the photo
    scrollRef.current.style.transform = `translateX(${currentX + offsetNeeded}px)`
    scrollRef.current.style.transition = 'transform 0.5s ease-out'

    // Clear any existing timeout
    if (resumeTimeoutRef.current) {
      window.clearTimeout(resumeTimeoutRef.current)
    }

    // Auto-resume after 5 seconds
    resumeTimeoutRef.current = window.setTimeout(() => {
      setCountdown(null)
      if (scrollRef.current) {
        // Get the current transform position
        const currentTransform = window.getComputedStyle(scrollRef.current).transform
        let currentX = 0

        if (currentTransform && currentTransform !== 'none') {
          const matrix = currentTransform.match(/matrix\((.+)\)/)
          if (matrix) {
            const values = matrix[1].split(', ')
            currentX = parseFloat(values[4]) || 0
          }
        }

        // Calculate animation progress based on current position
        const MIN_ITEMS_FOR_SMOOTH_ANIMATION = 30
        const SECONDS_PER_ITEM = 4  // Consistent speed
        const animationItemCount = Math.max(photos.length, MIN_ITEMS_FOR_SMOOTH_ANIMATION)
        const animationDuration = animationItemCount * SECONDS_PER_ITEM
        const totalDistance = animationItemCount * 432

        // Normalize currentX to be within one animation cycle
        // Since we have infinite loop, get position within single cycle
        const normalizedX = ((Math.abs(currentX) % totalDistance) / totalDistance)

        // Set negative animation-delay to start from current position
        // This makes the animation continue from where we paused
        const delay = -(normalizedX * animationDuration)
        scrollRef.current.style.animationDelay = `${delay}s`
        scrollRef.current.style.transition = ''
        scrollRef.current.style.transform = '' // Remove inline transform, let animation take over
      }
      setIsPaused(false)
    }, 5000)
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="relative">
        <Card className="border-white/20 bg-white/60 backdrop-blur-sm">
          <CardContent className="flex flex-col items-center justify-center py-24">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
            <p className="mt-4 text-sm text-muted-foreground">Loading photos...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Empty state
  if (photos.length === 0) {
    return (
      <Card className="border-white/20 bg-white/60 backdrop-blur-sm">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <ImageIcon className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mb-2 text-xl font-semibold text-foreground">No photos yet</h3>
          <p className="text-muted-foreground">Upload your first photos to get started</p>
        </CardContent>
      </Card>
    )
  }

  // Duplicate photos to reach minimum count for smooth animation
  // Target: ~30 items minimum for consistent smooth scrolling
  const MIN_ITEMS_FOR_SMOOTH_ANIMATION = 30
  const duplicateCount = Math.max(2, Math.ceil(MIN_ITEMS_FOR_SMOOTH_ANIMATION / photos.length))
  const duplicatedPhotos = Array(duplicateCount).fill(photos).flat()

  // Animation should move through at least 30 items worth of distance for smooth scrolling
  // This ensures the same speed regardless of actual item count
  const SECONDS_PER_ITEM = 4  // Consistent speed (same as 30+ items)
  const animationItemCount = Math.max(photos.length, MIN_ITEMS_FOR_SMOOTH_ANIMATION)
  const animationDuration = animationItemCount * SECONDS_PER_ITEM
  const animationDistance = animationItemCount * 432 // Move through 30 items minimum

  return (
    <>
      <div className="relative overflow-hidden rounded-lg border border-white/20 bg-white/60 backdrop-blur-sm p-8">
        {/* Continuous flowing carousel */}
        <div ref={containerRef} className="relative overflow-hidden py-12">
          <div
            ref={scrollRef}
            className={`flex gap-8 items-center justify-start ${isPaused ? '' : 'animate-scroll'}`}
            style={{
              width: 'max-content',
              paddingLeft: 'calc(50% - 200px)',
              paddingRight: 'calc(50% - 200px)',
            }}
          >
            {duplicatedPhotos.map((photo, index) => {
              const scale = photoScales[index] || 0.75
              const isCenter = scale > 0.9 // Consider it center if scale is > 0.9

              return (
                <div
                  key={`${photo.id}-${index}`}
                  data-index={index}
                  className="photo-card flex-shrink-0 transition-all duration-300 ease-out cursor-pointer"
                  style={{
                    width: '400px',
                  }}
                  onClick={(e) => handlePhotoClick(index, e)}
                >
                  <Card className={`group overflow-hidden border-white/20 backdrop-blur-sm transition-all duration-300 ${
                    isCenter
                      ? 'bg-white/90 shadow-2xl'
                      : 'bg-white/70 shadow-md'
                  }`}>
                    {/* Image Display */}
                    <div className="relative aspect-video overflow-hidden bg-muted">
                      {/* Blurred Background */}
                      {photo.file_url && (
                        <div
                          className="absolute inset-0 bg-cover bg-center"
                          style={{
                            backgroundImage: `url(${photo.file_url})`,
                            filter: "blur(40px)",
                            transform: "scale(1.1)",
                          }}
                        />
                      )}
                      {/* Main Image */}
                      {photo.file_url ? (
                        <img
                          src={photo.file_url}
                          alt={photo.name || "Photo"}
                          className="relative h-full w-full object-contain z-10"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            target.style.display = "none"
                            if (target.nextSibling) {
                              ;(target.nextSibling as HTMLElement).style.display = "flex"
                            }
                          }}
                        />
                      ) : null}
                      <div
                        className="absolute inset-0 hidden items-center justify-center bg-muted z-10"
                        style={{ display: photo.file_url ? "none" : "flex" }}
                      >
                        <div className="text-center">
                          <ImageIcon className="mx-auto mb-2 h-12 w-12 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">No preview</p>
                        </div>
                      </div>
                      {/* Interactive buttons - Only show for center photo */}
                      {isCenter && (
                        <>
                          {/* Favorite Button */}
                          <div className="absolute left-3 top-3 z-20">
                            <FavoriteButton
                              itemId={photo.id}
                              itemType="photo"
                              initialIsFavorite={photo.is_favorite || false}
                              variant="ghost"
                              size="icon"
                              showLabel={false}
                            />
                          </div>
                          {/* Type Badge */}
                          {photo.type && (
                            <div className="absolute right-3 top-3 z-20">
                              <Badge variant="secondary" className="bg-black/60 text-white backdrop-blur-sm">
                                {photo.type.split("/")[1]?.toUpperCase() || photo.type}
                              </Badge>
                            </div>
                          )}
                          {/* Delete Button */}
                          <div className="absolute bottom-3 right-3 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="destructive"
                              size="icon"
                              className="h-9 w-9 bg-red-600 hover:bg-red-700"
                              onClick={(e) => handleDeleteClick(photo, e)}
                              title="Delete photo"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Photo Metadata - Only show for center photo */}
                    {isCenter && (
                      <CardContent className="p-5 space-y-3">
                        <div>
                          <h3 className="font-semibold text-lg text-foreground truncate" title={photo.name}>
                            {photo.name}
                          </h3>
                        </div>
                        {photo.caption && (
                          <div className="flex items-start gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-muted-foreground line-clamp-2" title={photo.caption}>
                              {photo.caption}
                            </p>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <HardDrive className="h-4 w-4" />
                            <span>{formatFileSize(photo.size)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <span>{formatDate(photo.created_at).split(',')[0]}</span>
                          </div>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                </div>
              )
            })}
          </div>
        </div>

        {/* Indicators */}
        <div className="mt-6 flex justify-center gap-2 flex-wrap px-4">
          {photos.map((_, index) => (
            <div
              key={index}
              className={`h-2.5 rounded-full transition-all duration-300 ${
                index === centeredPhotoIndex
                  ? "w-8 bg-gradient-to-r from-blue-600 to-purple-600"
                  : "w-2.5 bg-gray-300"
              }`}
            />
          ))}
        </div>

        {/* Photo count indicator */}
        <div className="mt-4 text-center">
          <p className="text-sm text-muted-foreground">
            {centeredPhotoIndex + 1} / {photos.length}
            {isPaused && countdown !== null && (
              <span className="ml-2 text-blue-600 font-medium">
                (Paused - Resumes in {countdown}s)
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        title="Delete Photo?"
        description={`Are you sure you want to delete "${photoToDelete?.name}"? This will permanently remove the photo from your library and all albums.`}
        isDeleting={isDeleting}
        itemType="photo"
      />

      <style jsx>{`
        @keyframes scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(calc(-${animationDistance}px));
          }
        }

        .animate-scroll {
          animation: scroll ${animationDuration}s linear infinite;
        }
      `}</style>
    </>
  )
}
