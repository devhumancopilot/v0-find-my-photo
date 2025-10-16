"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ImageIcon, Calendar, FileText, HardDrive } from "lucide-react"

interface Photo {
  id: number
  name: string
  file_url: string | null
  type: string | null
  size: number | null
  caption: string | null
  created_at: string
  data: string | null
}

interface PhotoGalleryProps {
  photos: Photo[]
}

export function PhotoGallery({ photos }: PhotoGalleryProps) {
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
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {photos.map((photo) => (
        <Card
          key={photo.id}
          className="group overflow-hidden border-white/20 bg-white/60 backdrop-blur-sm transition-all hover:shadow-lg"
        >
          {/* Image Display */}
          <div className="relative aspect-square overflow-hidden bg-muted">
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
            {/* Type Badge */}
            {photo.type && (
              <div className="absolute right-2 top-2">
                <Badge variant="secondary" className="bg-black/60 text-white backdrop-blur-sm">
                  {photo.type.split("/")[1]?.toUpperCase() || photo.type}
                </Badge>
              </div>
            )}
          </div>

          {/* Photo Metadata */}
          <CardContent className="p-4 space-y-3">
            {/* Name */}
            <div>
              <h3 className="font-semibold text-foreground truncate" title={photo.name}>
                {photo.name}
              </h3>
            </div>

            {/* Caption */}
            {photo.caption && (
              <div className="flex items-start gap-2">
                <FileText className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <p className="text-sm text-muted-foreground line-clamp-2" title={photo.caption}>
                  {photo.caption}
                </p>
              </div>
            )}

            {/* File Size */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <HardDrive className="h-4 w-4" />
              <span>{formatFileSize(photo.size)}</span>
            </div>

            {/* Created Date */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>{formatDate(photo.created_at)}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
