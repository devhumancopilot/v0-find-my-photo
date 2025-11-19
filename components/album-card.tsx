"use client"

import { useState } from "react"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FavoriteButton } from "@/components/favorite-button"
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog"
import { LoadingLink } from "@/components/loading-link"
import { ImageIcon, Clock, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

interface Album {
  id: number
  album_title: string
  cover_image_url: string
  photo_count: number
  created_at: string
  is_favorite: boolean | null
}

interface AlbumCardProps {
  album: Album
}

export function AlbumCard({ album }: AlbumCardProps) {
  const router = useRouter()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault() // Prevent navigation to album detail
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    setIsDeleting(true)

    try {
      const response = await fetch("/api/albums/delete", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ albumId: album.id }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete album")
      }

      toast.success("Album Deleted", {
        description: `${album.album_title} has been deleted. Your photos remain in your library.`,
      })

      setDeleteDialogOpen(false)

      // Refresh the page to show updated album list
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

  return (
    <>
      <Card className="group h-full flex flex-col overflow-hidden border-white/20 bg-white/60 backdrop-blur-sm transition-all hover:shadow-lg">
        <div className="relative flex-1 overflow-hidden">
          <img
            src={album.cover_image_url || "/placeholder.svg"}
            alt={album.album_title}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

          {/* Favorite Button - Top Right Corner */}
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

          {/* Delete Button - Top Left Corner (visible on hover) */}
          <div className="absolute top-3 left-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="destructive"
              size="icon"
              className="h-9 w-9 bg-red-600 hover:bg-red-700"
              onClick={handleDeleteClick}
              title="Delete album"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          {/* View Album Button */}
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

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        title="Delete Album?"
        description={`Are you sure you want to delete "${album.album_title}"? The ${album.photo_count} photo${album.photo_count !== 1 ? 's' : ''} in this album will remain in your library.`}
        isDeleting={isDeleting}
        itemType="album"
      />
    </>
  )
}
