"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FavoriteButton } from "@/components/favorite-button"
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog"
import { ImageLightbox } from "@/components/image-lightbox"
import { ImageIcon, Calendar, FileText, HardDrive, Trash2, Maximize2 } from "lucide-react"
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

interface PhotoGalleryProps {
  photos: Photo[]
}

export function PhotoGallery({ photos }: PhotoGalleryProps) {
  const router = useRouter()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [photoToDelete, setPhotoToDelete] = useState<Photo | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null)

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

  const handleViewFullImage = (photo: Photo) => {
    setLightboxPhoto(photo)
    setLightboxOpen(true)
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

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 auto-rows-[200px] gap-4">
        {photos.map((photo, index) => {
          // Create a dynamic pattern with medium minimum size (2×2 minimum)
          const pattern = index % 6
          const getGridClass = () => {
            switch (pattern) {
              case 0: return 'col-span-3 row-span-3' // Extra large square
              case 1: return 'col-span-2 row-span-2' // Medium square
              case 2: return 'col-span-2 row-span-3' // Large tall
              case 3: return 'col-span-2 row-span-2' // Medium square
              case 4: return 'col-span-3 row-span-2' // Large wide
              case 5: return 'col-span-2 row-span-2' // Medium square
              default: return 'col-span-2 row-span-2'
            }
          }

          return (
            <div
              key={photo.id}
              className={`${getGridClass()} overflow-hidden`}
            >
              <Card className="group h-full flex flex-col overflow-hidden border-white/20 bg-white/60 backdrop-blur-sm transition-all hover:shadow-lg">
                {/* Image Display */}
                <div className="relative flex-1 overflow-hidden bg-muted">
                  {photo.file_url ? (
                    <img
                      src={photo.file_url}
                      alt={photo.name || "Photo"}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      onError={(e) => {
                        // Fallback if image fails to load
                        const target = e.target as HTMLImageElement
                        target.style.display = "none"
                        if (target.nextSibling) {
                          ;(target.nextSibling as HTMLElement).style.display = "flex"
                        }
                      }}
                    />
                  ) : null}
                  <div
                    className="absolute inset-0 hidden items-center justify-center bg-muted"
                    style={{ display: photo.file_url ? "none" : "flex" }}
                  >
                    <div className="text-center">
                      <ImageIcon className="mx-auto mb-2 h-12 w-12 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">No preview</p>
                    </div>
                  </div>
                  {/* Favorite Button - Top Left Corner */}
                  <div className="absolute left-2 top-2 z-10">
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
                    <div className="absolute right-2 top-2">
                      <Badge variant="secondary" className="bg-black/60 text-white backdrop-blur-sm">
                        {photo.type.split("/")[1]?.toUpperCase() || photo.type}
                      </Badge>
                    </div>
                  )}
                  {/* View Full Image Button - Bottom Left Corner */}
                  <div className="absolute bottom-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-9 w-9 bg-white/90 text-foreground hover:bg-white"
                      onClick={() => handleViewFullImage(photo)}
                      title="View full image"
                    >
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Delete Button - Bottom Right Corner */}
                  <div className="absolute bottom-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="destructive"
                      size="icon"
                      className="h-9 w-9 bg-red-600 hover:bg-red-700"
                      onClick={() => handleDeleteClick(photo)}
                      title="Delete photo"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Photo Metadata */}
                <CardContent className="flex-shrink-0 p-3 space-y-2">
                  {/* Name */}
                  <div>
                    <h3 className="font-semibold text-sm text-foreground truncate" title={photo.name}>
                      {photo.name}
                    </h3>
                  </div>

                  {/* Caption */}
                  {photo.caption && (
                    <div className="flex items-start gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-muted-foreground line-clamp-2" title={photo.caption}>
                        {photo.caption}
                      </p>
                    </div>
                  )}

                  {/* File Size and Date */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <HardDrive className="h-3.5 w-3.5" />
                      <span>{formatFileSize(photo.size)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{formatDate(photo.created_at).split(',')[0]}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )
        })}
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

      {/* Image Lightbox */}
      {lightboxPhoto && (
        <ImageLightbox
          isOpen={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
          imageUrl={lightboxPhoto.file_url || "/placeholder.svg"}
          imageName={lightboxPhoto.name}
        />
      )}
    </>
  )
}
