"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getBackendAPIURL, getAuthHeaders } from "@/lib/config"
import { Badge } from "@/components/ui/badge"
import { FavoriteButton } from "@/components/favorite-button"
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog"
import {
  ImageIcon,
  Calendar,
  FileText,
  HardDrive,
  Trash2,
  ChevronLeft,
  ChevronRight,
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
  const [currentIndex, setCurrentIndex] = useState(0)

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1))
  }

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1))
  }

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

  const handleDeleteClick = (photo: Photo) => {
    setPhotoToDelete(photo)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!photoToDelete) return

    setIsDeleting(true)

    try {
      const authHeaders = await getAuthHeaders()
      const response = await fetch(getBackendAPIURL("/api/photos/delete"), {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
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

  const getPreviousIndex = () => (currentIndex === 0 ? photos.length - 1 : currentIndex - 1)
  const getNextIndex = () => (currentIndex === photos.length - 1 ? 0 : currentIndex + 1)

  const currentPhoto = photos[currentIndex]
  const previousPhoto = photos[getPreviousIndex()]
  const nextPhoto = photos[getNextIndex()]

  return (
    <>
      <div className="relative rounded-lg border border-white/20 bg-white/60 backdrop-blur-sm p-8">
        {/* Three Photo Display */}
        <div className="flex items-center justify-center gap-6 overflow-hidden">
          {/* Previous Button */}
          <Button
            variant="outline"
            size="icon"
            onClick={handlePrevious}
            className="h-12 w-12 rounded-full bg-white/80 hover:bg-white flex-shrink-0 z-10"
            disabled={photos.length <= 1}
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>

          {/* Previous Photo (faded, smaller) */}
          <div
            className="w-64 flex-shrink-0 cursor-pointer"
            onClick={handlePrevious}
            style={{
              transform: 'scale(0.85)',
              opacity: 0.4,
              transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.6'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.4'}
          >
            <Card className="overflow-hidden border-white/20 backdrop-blur-sm bg-white/70">
              <div className="relative aspect-video overflow-hidden bg-muted">
                {previousPhoto.file_url && (
                  <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{
                      backgroundImage: `url(${previousPhoto.file_url})`,
                      filter: "blur(40px)",
                      transform: "scale(1.1)",
                    }}
                  />
                )}
                {previousPhoto.file_url ? (
                  <img
                    src={previousPhoto.file_url}
                    alt={previousPhoto.name || "Photo"}
                    className="relative h-full w-full object-contain z-10"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted z-10">
                    <ImageIcon className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Center Photo (highlighted, largest) */}
          <div
            className="w-96 flex-shrink-0"
            style={{
              transform: 'scale(1)',
              opacity: 1,
              transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          >
            <Card className="group overflow-hidden border-white/20 backdrop-blur-sm bg-white/90 shadow-2xl">
              {/* Image Display */}
              <div className="relative aspect-video overflow-hidden bg-muted">
                {/* Blurred Background */}
                {currentPhoto.file_url && (
                  <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{
                      backgroundImage: `url(${currentPhoto.file_url})`,
                      filter: "blur(40px)",
                      transform: "scale(1.1)",
                    }}
                  />
                )}
                {/* Main Image */}
                {currentPhoto.file_url ? (
                  <img
                    src={currentPhoto.file_url}
                    alt={currentPhoto.name || "Photo"}
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
                  style={{ display: currentPhoto.file_url ? "none" : "flex" }}
                >
                  <div className="text-center">
                    <ImageIcon className="mx-auto mb-2 h-12 w-12 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No preview</p>
                  </div>
                </div>
                {/* Interactive buttons */}
                <>
                  {/* Favorite Button */}
                  <div className="absolute left-3 top-3 z-20">
                    <FavoriteButton
                      itemId={currentPhoto.id}
                      itemType="photo"
                      initialIsFavorite={currentPhoto.is_favorite || false}
                      variant="ghost"
                      size="icon"
                      showLabel={false}
                    />
                  </div>
                  {/* Type Badge */}
                  {currentPhoto.type && (
                    <div className="absolute right-3 top-3 z-20">
                      <Badge variant="secondary" className="bg-black/60 text-white backdrop-blur-sm">
                        {currentPhoto.type.split("/")[1]?.toUpperCase() || currentPhoto.type}
                      </Badge>
                    </div>
                  )}
                  {/* Delete Button */}
                  <div className="absolute bottom-3 right-3 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="destructive"
                      size="icon"
                      className="h-9 w-9 bg-red-600 hover:bg-red-700"
                      onClick={() => handleDeleteClick(currentPhoto)}
                      title="Delete photo"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              </div>

              {/* Photo Metadata */}
              <CardContent className="p-5 space-y-3">
                <div>
                  <h3 className="font-semibold text-lg text-foreground truncate" title={currentPhoto.name}>
                    {currentPhoto.name}
                  </h3>
                </div>
                {currentPhoto.caption && (
                  <div className="flex items-start gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-muted-foreground line-clamp-2" title={currentPhoto.caption}>
                      {currentPhoto.caption}
                    </p>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-4 w-4" />
                    <span>{formatFileSize(currentPhoto.size)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>{formatDate(currentPhoto.created_at).split(',')[0]}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Next Photo (faded, smaller) */}
          <div
            className="w-64 flex-shrink-0 cursor-pointer"
            onClick={handleNext}
            style={{
              transform: 'scale(0.85)',
              opacity: 0.4,
              transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.6'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.4'}
          >
            <Card className="overflow-hidden border-white/20 backdrop-blur-sm bg-white/70">
              <div className="relative aspect-video overflow-hidden bg-muted">
                {nextPhoto.file_url && (
                  <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{
                      backgroundImage: `url(${nextPhoto.file_url})`,
                      filter: "blur(40px)",
                      transform: "scale(1.1)",
                    }}
                  />
                )}
                {nextPhoto.file_url ? (
                  <img
                    src={nextPhoto.file_url}
                    alt={nextPhoto.name || "Photo"}
                    className="relative h-full w-full object-contain z-10"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted z-10">
                    <ImageIcon className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Next Button */}
          <Button
            variant="outline"
            size="icon"
            onClick={handleNext}
            className="h-12 w-12 rounded-full bg-white/80 hover:bg-white flex-shrink-0 z-10"
            disabled={photos.length <= 1}
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        </div>

        {/* Indicators */}
        <div className="mt-6 flex justify-center gap-2 flex-wrap px-4">
          {photos.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`h-2.5 rounded-full transition-all duration-300 ${
                index === currentIndex
                  ? "w-8 bg-gradient-to-r from-blue-600 to-purple-600"
                  : "w-2.5 bg-gray-300 hover:bg-gray-400"
              }`}
            />
          ))}
        </div>

        {/* Photo count indicator */}
        <div className="mt-4 text-center">
          <p className="text-sm text-muted-foreground">
            {currentIndex + 1} / {photos.length}
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
    </>
  )
}
