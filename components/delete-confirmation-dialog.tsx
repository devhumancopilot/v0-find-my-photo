"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"

interface DeleteConfirmationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void | Promise<void>
  title: string
  description: string
  isDeleting?: boolean
  itemType?: "photo" | "album"
}

export function DeleteConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  isDeleting = false,
  itemType = "photo",
}: DeleteConfirmationDialogProps) {
  const handleConfirm = async () => {
    await onConfirm()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <DialogTitle className="text-xl">{title}</DialogTitle>
          </div>
          <DialogDescription className="text-left pt-2">
            {description}
          </DialogDescription>
        </DialogHeader>
        <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mt-2">
          <p className="text-sm text-amber-800 font-medium">
            ⚠️ Warning: This action cannot be undone
          </p>
          <p className="text-xs text-amber-700 mt-1">
            {itemType === "album"
              ? "The album will be permanently deleted. Photos in this album will remain in your library."
              : "This photo will be permanently deleted from your library and removed from all albums."}
          </p>
        </div>
        <DialogFooter className="mt-4 gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700"
          >
            {isDeleting ? (
              <>
                <span className="mr-2">Deleting...</span>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              </>
            ) : (
              `Yes, Delete ${itemType === "album" ? "Album" : "Photo"}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
