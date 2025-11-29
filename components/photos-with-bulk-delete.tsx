"use client"

import { useState, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { BulkDeleteDialog } from "@/components/bulk-delete-dialog"
import { FavoriteButton } from "@/components/favorite-button"
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog"
import { ImageLightbox } from "@/components/image-lightbox"
import { getBackendAPIURL, getAuthHeaders } from "@/lib/config"
import {
  ImageIcon, Calendar, FileText, HardDrive, Trash2, Maximize2,
  CheckSquare, Square, Trash
} from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { format } from "date-fns"

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

interface MonthGroup {
  month: string
  count: number
}

interface PhotosWithBulkDeleteProps {
  photos: Photo[]
}

export function PhotosWithBulkDelete({ photos }: PhotosWithBulkDeleteProps) {
  const router = useRouter()
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedPhotos, setSelectedPhotos] = useState<Set<number>>(new Set())
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [photoToDelete, setPhotoToDelete] = useState<Photo | null>(null)
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null)

  // Group photos by month
  const photosByMonth = useMemo(() => {
    const grouped = photos.reduce((acc, photo) => {
      const monthKey = format(new Date(photo.created_at), 'MMMM yyyy')
      if (!acc[monthKey]) {
        acc[monthKey] = []
      }
      acc[monthKey].push(photo)
      return acc
    }, {} as Record<string, Photo[]>)
    return grouped
  }, [photos])

  const monthKeys = Object.keys(photosByMonth)

  // Calculate month groups for dialog
  const monthGroups: MonthGroup[] = useMemo(() => {
    return monthKeys.map(month => ({
      month,
      count: photosByMonth[month].filter(p => selectedPhotos.has(p.id)).length
    })).filter(g => g.count > 0)
  }, [monthKeys, photosByMonth, selectedPhotos])

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

  const handleToggleSelectionMode = () => {
    setSelectionMode(!selectionMode)
    setSelectedPhotos(new Set())
  }

  const handleTogglePhoto = (photoId: number) => {
    const newSelection = new Set(selectedPhotos)
    if (newSelection.has(photoId)) {
      newSelection.delete(photoId)
    } else {
      newSelection.add(photoId)
    }
    setSelectedPhotos(newSelection)
  }

  const handleSelectAllMonth = (month: string) => {
    const monthPhotos = photosByMonth[month]
    const newSelection = new Set(selectedPhotos)
    const allSelected = monthPhotos.every(p => newSelection.has(p.id))

    if (allSelected) {
      // Deselect all in this month
      monthPhotos.forEach(p => newSelection.delete(p.id))
    } else {
      // Select all in this month
      monthPhotos.forEach(p => newSelection.add(p.id))
    }
    setSelectedPhotos(newSelection)
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

  const handleBulkDelete = async () => {
    const photoIds = Array.from(selectedPhotos)

    try {
      const authHeaders = await getAuthHeaders()
      const response = await fetch(getBackendAPIURL("/api/photos/bulk-delete"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({ photoIds }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete photos")
      }

      const result = await response.json()

      toast.success("Photos Deleted", {
        description: `Successfully deleted ${result.deleted_count} photo${result.deleted_count === 1 ? '' : 's'}.`,
      })

      setSelectedPhotos(new Set())
      setSelectionMode(false)
      router.refresh()
    } catch (error) {
      console.error("Bulk delete error:", error)
      toast.error("Delete Failed", {
        description: error instanceof Error ? error.message : "Failed to delete photos. Please try again.",
      })
    }
  }

  // Calculate photos in albums count
  const photosInAlbumsCount = useMemo(() => {
    return photos.filter(p => selectedPhotos.has(p.id) && p.data).length
  }, [photos, selectedPhotos])

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
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 rounded-lg border border-white/20 bg-white/60 p-4 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <Button
            variant={selectionMode ? "default" : "outline"}
            onClick={handleToggleSelectionMode}
            className={selectionMode ? "bg-blue-600 hover:bg-blue-700" : ""}
          >
            {selectionMode ? (
              <>
                <CheckSquare className="mr-2 h-4 w-4" />
                Exit Selection
              </>
            ) : (
              <>
                <Square className="mr-2 h-4 w-4" />
                Select Photos
              </>
            )}
          </Button>

          {selectionMode && selectedPhotos.size > 0 && (
            <>
              <Badge variant="secondary" className="text-sm">
                {selectedPhotos.size} selected
              </Badge>
              <Button
                variant="destructive"
                onClick={() => setBulkDeleteDialogOpen(true)}
                className="bg-red-600 hover:bg-red-700"
              >
                <Trash className="mr-2 h-4 w-4" />
                Delete Selected
              </Button>
            </>
          )}
        </div>

        <div className="text-sm text-muted-foreground">
          {photos.length} photo{photos.length === 1 ? '' : 's'}
        </div>
      </div>

      {/* Photos by Month */}
      {monthKeys.map((monthKey) => {
        const monthPhotos = photosByMonth[monthKey]
        const allMonthSelected = monthPhotos.every(p => selectedPhotos.has(p.id))
        const someMonthSelected = monthPhotos.some(p => selectedPhotos.has(p.id))

        return (
          <div key={monthKey} className="space-y-4">
            {/* Month Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-foreground">{monthKey}</h2>
              {selectionMode && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSelectAllMonth(monthKey)}
                  className="gap-2"
                >
                  {allMonthSelected ? (
                    <>
                      <CheckSquare className="h-4 w-4" />
                      Deselect All
                    </>
                  ) : (
                    <>
                      <Square className="h-4 w-4" />
                      Select All ({monthPhotos.length})
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Photos Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 auto-rows-[200px] gap-4">
              {monthPhotos.map((photo, index) => {
                const isSelected = selectedPhotos.has(photo.id)
                const pattern = index % 6
                const getGridClass = () => {
                  switch (pattern) {
                    case 0: return 'col-span-3 row-span-3'
                    case 1: return 'col-span-2 row-span-2'
                    case 2: return 'col-span-2 row-span-3'
                    case 3: return 'col-span-2 row-span-2'
                    case 4: return 'col-span-3 row-span-2'
                    case 5: return 'col-span-2 row-span-2'
                    default: return 'col-span-2 row-span-2'
                  }
                }

                return (
                  <div
                    key={photo.id}
                    className={`${getGridClass()} overflow-hidden`}
                  >
                    <Card
                      className={`group h-full flex flex-col overflow-hidden border-white/20 bg-white/60 backdrop-blur-sm transition-all hover:shadow-lg ${
                        isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : ''
                      }`}
                    >
                      {/* Image Display */}
                      <div className="relative flex-1 overflow-hidden bg-muted">
                        {photo.file_url ? (
                          <img
                            src={photo.file_url}
                            alt={photo.name || "Photo"}
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.style.display = "none"
                              if (target.nextSibling) {
                                (target.nextSibling as HTMLElement).style.display = "flex"
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

                        {/* Selection Checkbox */}
                        {selectionMode && (
                          <div className="absolute left-2 top-2 z-20">
                            <div
                              className="flex h-8 w-8 items-center justify-center rounded-md bg-white/90 shadow-md cursor-pointer"
                              onClick={() => handleTogglePhoto(photo.id)}
                            >
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => handleTogglePhoto(photo.id)}
                                className="h-5 w-5"
                              />
                            </div>
                          </div>
                        )}

                        {/* Favorite Button */}
                        {!selectionMode && (
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
                        )}

                        {/* Type Badge */}
                        {photo.type && (
                          <div className="absolute right-2 top-2">
                            <Badge variant="secondary" className="bg-black/60 text-white backdrop-blur-sm">
                              {photo.type.split("/")[1]?.toUpperCase() || photo.type}
                            </Badge>
                          </div>
                        )}

                        {/* View Full Image Button */}
                        {!selectionMode && (
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
                        )}

                        {/* Delete Button */}
                        {!selectionMode && (
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
                        )}
                      </div>

                      {/* Photo Metadata */}
                      <CardContent className="flex-shrink-0 p-3 space-y-2">
                        <div>
                          <h3 className="font-semibold text-sm text-foreground truncate" title={photo.name}>
                            {photo.name}
                          </h3>
                        </div>

                        {photo.caption && (
                          <div className="flex items-start gap-1.5">
                            <FileText className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-muted-foreground line-clamp-2" title={photo.caption}>
                              {photo.caption}
                            </p>
                          </div>
                        )}

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
          </div>
        )
      })}

      {/* Single Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        title="Delete Photo?"
        description={`Are you sure you want to delete "${photoToDelete?.name}"? This will permanently remove the photo from your library and all albums.`}
        isDeleting={isDeleting}
        itemType="photo"
      />

      {/* Bulk Delete Dialog */}
      <BulkDeleteDialog
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
        itemType="photo"
        totalCount={selectedPhotos.size}
        monthGroups={monthGroups}
        onConfirm={handleBulkDelete}
        photosInAlbumsCount={photosInAlbumsCount}
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
    </div>
  )
}
