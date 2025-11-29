"use client"

import { useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Loader2, AlertTriangle } from "lucide-react"

interface MonthGroup {
  month: string
  count: number
}

interface BulkDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemType: "photo" | "album"
  totalCount: number
  monthGroups: MonthGroup[]
  onConfirm: () => Promise<void>
  photosInAlbumsCount?: number
}

export function BulkDeleteDialog({
  open,
  onOpenChange,
  itemType,
  totalCount,
  monthGroups,
  onConfirm,
  photosInAlbumsCount = 0,
}: BulkDeleteDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleConfirm = async () => {
    setIsDeleting(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } catch (error) {
      console.error('Delete error:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  const itemLabel = itemType === "photo" ? "photo" : "album"
  const itemLabelPlural = itemType === "photo" ? "photos" : "albums"

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-xl">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            Delete {totalCount} {totalCount === 1 ? itemLabel : itemLabelPlural}?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 pt-2">
              <p className="text-base">
                This action cannot be undone. {itemType === "photo" ? "This will permanently delete the selected photos from your account and remove them from storage." : "The albums will be deleted, but photos in those albums will be preserved."}
              </p>

              {/* Month breakdown */}
              {monthGroups.length > 0 && (
                <div className="rounded-lg border border-muted bg-muted/20 p-3">
                  <p className="mb-2 text-sm font-semibold">
                    This will affect:
                  </p>
                  <ul className="space-y-1 text-sm">
                    {monthGroups.map((group) => (
                      <li key={group.month} className="flex justify-between">
                        <span className="text-muted-foreground">{group.month}:</span>
                        <span className="font-medium">
                          {group.count} {group.count === 1 ? itemLabel : itemLabelPlural}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Warning for photos in albums */}
              {itemType === "photo" && photosInAlbumsCount > 0 && (
                <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
                  <div className="text-sm">
                    <p className="font-semibold text-amber-900">Warning:</p>
                    <p className="text-amber-800">
                      {photosInAlbumsCount} {photosInAlbumsCount === 1 ? "photo belongs" : "photos belong"} to albums and will be removed from those albums.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              handleConfirm()
            }}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              `Delete ${totalCount} ${totalCount === 1 ? itemLabel : itemLabelPlural}`
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
