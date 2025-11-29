"use client"

import { useState, useMemo } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { BulkDeleteDialog } from "@/components/bulk-delete-dialog"
import { FavoriteButton } from "@/components/favorite-button"
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog"
import { LoadingLink } from "@/components/loading-link"
import { getBackendAPIURL, getAuthHeaders } from "@/lib/config"
import {
  ImageIcon, Clock, Trash2, CheckSquare, Square, Trash
} from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { format } from "date-fns"

interface Album {
  id: number
  album_title: string
  cover_image_url: string
  photo_count: number
  created_at: string
  is_favorite: boolean | null
}

interface MonthGroup {
  month: string
  count: number
}

interface AlbumsWithBulkDeleteProps {
  albums: Album[]
}

export function AlbumsWithBulkDelete({ albums }: AlbumsWithBulkDeleteProps) {
  const router = useRouter()
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedAlbums, setSelectedAlbums] = useState<Set<number>>(new Set())
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [albumToDelete, setAlbumToDelete] = useState<Album | null>(null)
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Group albums by month
  const albumsByMonth = useMemo(() => {
    const grouped = albums.reduce((acc, album) => {
      const monthKey = format(new Date(album.created_at), 'MMMM yyyy')
      if (!acc[monthKey]) {
        acc[monthKey] = []
      }
      acc[monthKey].push(album)
      return acc
    }, {} as Record<string, Album[]>)
    return grouped
  }, [albums])

  const monthKeys = Object.keys(albumsByMonth)

  // Calculate month groups for dialog
  const monthGroups: MonthGroup[] = useMemo(() => {
    return monthKeys.map(month => ({
      month,
      count: albumsByMonth[month].filter(a => selectedAlbums.has(a.id)).length
    })).filter(g => g.count > 0)
  }, [monthKeys, albumsByMonth, selectedAlbums])

  const handleToggleSelectionMode = () => {
    setSelectionMode(!selectionMode)
    setSelectedAlbums(new Set())
  }

  const handleToggleAlbum = (albumId: number) => {
    const newSelection = new Set(selectedAlbums)
    if (newSelection.has(albumId)) {
      newSelection.delete(albumId)
    } else {
      newSelection.add(albumId)
    }
    setSelectedAlbums(newSelection)
  }

  const handleSelectAllMonth = (month: string) => {
    const monthAlbums = albumsByMonth[month]
    const newSelection = new Set(selectedAlbums)
    const allSelected = monthAlbums.every(a => newSelection.has(a.id))

    if (allSelected) {
      // Deselect all in this month
      monthAlbums.forEach(a => newSelection.delete(a.id))
    } else {
      // Select all in this month
      monthAlbums.forEach(a => newSelection.add(a.id))
    }
    setSelectedAlbums(newSelection)
  }

  const handleDeleteClick = (album: Album, e: React.MouseEvent) => {
    e.preventDefault()
    setAlbumToDelete(album)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!albumToDelete) return

    setIsDeleting(true)

    try {
      const authHeaders = await getAuthHeaders()
      const response = await fetch(getBackendAPIURL("/api/albums/delete"), {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({ albumId: albumToDelete.id }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete album")
      }

      toast.success("Album Deleted", {
        description: `${albumToDelete.album_title} has been deleted. Your photos remain in your library.`,
      })

      setDeleteDialogOpen(false)
      setAlbumToDelete(null)
      router.refresh()
    } catch (error) {
      console.error("Delete album error:", error)
      toast.error("Delete Failed", {
        description: error instanceof Error ? error.message : "Failed to delete album. Please try again.",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleBulkDelete = async () => {
    const albumIds = Array.from(selectedAlbums)

    try {
      const authHeaders = await getAuthHeaders()
      const response = await fetch(getBackendAPIURL("/api/albums/bulk-delete"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({ albumIds }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete albums")
      }

      const result = await response.json()

      toast.success("Albums Deleted", {
        description: `Successfully deleted ${result.deleted_count} album${result.deleted_count === 1 ? '' : 's'}. ${result.photos_preserved} photo${result.photos_preserved === 1 ? '' : 's'} preserved.`,
      })

      setSelectedAlbums(new Set())
      setSelectionMode(false)
      router.refresh()
    } catch (error) {
      console.error("Bulk delete error:", error)
      toast.error("Delete Failed", {
        description: error instanceof Error ? error.message : "Failed to delete albums. Please try again.",
      })
    }
  }

  if (albums.length === 0) {
    return null // Parent component handles empty state
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
                Select Albums
              </>
            )}
          </Button>

          {selectionMode && selectedAlbums.size > 0 && (
            <>
              <Badge variant="secondary" className="text-sm">
                {selectedAlbums.size} selected
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
          {albums.length} album{albums.length === 1 ? '' : 's'}
        </div>
      </div>

      {/* Albums by Month */}
      {monthKeys.map((monthKey) => {
        const monthAlbums = albumsByMonth[monthKey]
        const allMonthSelected = monthAlbums.every(a => selectedAlbums.has(a.id))

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
                      Select All ({monthAlbums.length})
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Albums Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 auto-rows-[200px] gap-4">
              {monthAlbums.map((album, index) => {
                const isSelected = selectedAlbums.has(album.id)
                const pattern = index % 5
                const getGridClass = () => {
                  switch (pattern) {
                    case 0: return 'col-span-3 row-span-3'
                    case 1: return 'col-span-2 row-span-2'
                    case 2: return 'col-span-2 row-span-3'
                    case 3: return 'col-span-2 row-span-2'
                    case 4: return 'col-span-3 row-span-2'
                    default: return 'col-span-2 row-span-2'
                  }
                }

                return (
                  <div
                    key={album.id}
                    className={`${getGridClass()} overflow-hidden`}
                  >
                    <Card
                      className={`group h-full flex flex-col overflow-hidden border-white/20 bg-white/60 backdrop-blur-sm transition-all hover:shadow-lg ${
                        isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : ''
                      }`}
                    >
                      <div className="relative flex-1 overflow-hidden">
                        <img
                          src={album.cover_image_url || "/placeholder.svg"}
                          alt={album.album_title}
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

                        {/* Selection Checkbox */}
                        {selectionMode && (
                          <div className="absolute left-3 top-3 z-20">
                            <div
                              className="flex h-8 w-8 items-center justify-center rounded-md bg-white/90 shadow-md cursor-pointer"
                              onClick={() => handleToggleAlbum(album.id)}
                            >
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => handleToggleAlbum(album.id)}
                                className="h-5 w-5"
                              />
                            </div>
                          </div>
                        )}

                        {/* Favorite Button */}
                        {!selectionMode && (
                          <div className="absolute top-3 right-3 z-10">
                            <FavoriteButton
                              itemId={album.id}
                              itemType="album"
                              initialIsFavorite={album.is_favorite || false}
                              variant="ghost"
                              size="icon"
                              showLabel={false}
                            />
                          </div>
                        )}

                        {/* Delete Button */}
                        {!selectionMode && (
                          <div className="absolute top-3 left-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="destructive"
                              size="icon"
                              className="h-9 w-9 bg-red-600 hover:bg-red-700"
                              onClick={(e) => handleDeleteClick(album, e)}
                              title="Delete album"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}

                        {/* View Album Button */}
                        {!selectionMode && (
                          <div className="absolute bottom-4 left-4 right-4 translate-y-4 opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100">
                            <LoadingLink
                              href={`/albums/${album.id}`}
                              className="inline-block w-full"
                              loadingMessage="Loading album..."
                            >
                              <Button size="sm" className="w-full bg-white text-foreground hover:bg-white/90">
                                View Album
                              </Button>
                            </LoadingLink>
                          </div>
                        )}
                      </div>

                      <CardHeader className="flex-shrink-0">
                        <CardTitle className="text-lg truncate">{album.album_title}</CardTitle>
                        <CardDescription className="flex items-center gap-4 text-sm">
                          <span className="flex items-center gap-1">
                            <ImageIcon className="h-4 w-4" />
                            {album.photo_count} photos
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {new Date(album.created_at).toLocaleDateString()}
                          </span>
                        </CardDescription>
                      </CardHeader>
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
        title="Delete Album?"
        description={`Are you sure you want to delete "${albumToDelete?.album_title}"? The ${albumToDelete?.photo_count || 0} photo${(albumToDelete?.photo_count || 0) !== 1 ? 's' : ''} in this album will remain in your library.`}
        isDeleting={isDeleting}
        itemType="album"
      />

      {/* Bulk Delete Dialog */}
      <BulkDeleteDialog
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
        itemType="album"
        totalCount={selectedAlbums.size}
        monthGroups={monthGroups}
        onConfirm={handleBulkDelete}
      />
    </div>
  )
}
