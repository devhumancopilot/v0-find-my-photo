"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { getBackendAPIURL, getAuthHeaders } from "@/lib/config"
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"

interface AlbumActionsProps {
  albumId: number
  albumTitle: string
  photoCount: number
}

export function AlbumActions({ albumId, albumTitle, photoCount }: AlbumActionsProps) {
  const router = useRouter()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    setIsDeleting(true)

    try {
      const authHeaders = await getAuthHeaders()
      const response = await fetch(getBackendAPIURL("/api/albums/delete"), {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({ albumId }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete album")
      }

      toast.success("Album Deleted", {
        description: `${albumTitle} has been deleted. Your photos remain in your library.`,
      })

      setDeleteDialogOpen(false)

      // Redirect to dashboard after successful deletion
      router.push("/dashboard")
      router.refresh()
    } catch (error) {
      console.error("Delete album error:", error)
      toast.error("Delete Failed", {
        description: error instanceof Error ? error.message : "Failed to delete album. Please try again.",
      })
      setIsDeleting(false)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="text-destructive"
        onClick={handleDeleteClick}
      >
        <Trash2 className="mr-2 h-4 w-4" />
        Delete
      </Button>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        title="Delete Album?"
        description={`Are you sure you want to delete "${albumTitle}"? The ${photoCount} photo${photoCount !== 1 ? 's' : ''} in this album will remain in your library.`}
        isDeleting={isDeleting}
        itemType="album"
      />
    </>
  )
}
