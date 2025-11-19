"use client"

import { useState } from "react"
import { Heart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

interface FavoriteButtonProps {
  itemId: number
  itemType: "photo" | "album"
  initialIsFavorite?: boolean
  variant?: "default" | "outline" | "ghost"
  size?: "default" | "sm" | "lg" | "icon"
  showLabel?: boolean
  onToggle?: (isFavorite: boolean) => void
}

export function FavoriteButton({
  itemId,
  itemType,
  initialIsFavorite = false,
  variant = "outline",
  size = "sm",
  showLabel = true,
  onToggle,
}: FavoriteButtonProps) {
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault() // Prevent navigation if button is in a link
    e.stopPropagation() // Prevent triggering parent click events

    setIsLoading(true)

    try {
      const endpoint =
        itemType === "photo"
          ? `/api/favorites/photos/${itemId}`
          : `/api/favorites/albums/${itemId}`

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        throw new Error("Failed to update favorite")
      }

      const result = await response.json()
      const newFavoriteStatus = result.is_favorite

      setIsFavorite(newFavoriteStatus)

      // Call onToggle callback if provided
      if (onToggle) {
        onToggle(newFavoriteStatus)
      }

      // Show toast
      toast.success(
        newFavoriteStatus
          ? `Added to favorites`
          : `Removed from favorites`,
        {
          duration: 2000,
        }
      )

      // Refresh the page data
      router.refresh()
    } catch (error) {
      console.error("Error toggling favorite:", error)
      toast.error("Failed to update favorite", {
        description:
          error instanceof Error ? error.message : "Please try again",
        duration: 3000,
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleToggleFavorite}
      disabled={isLoading}
      className={`
        group transition-all duration-300
        ${isFavorite
          ? "bg-gradient-to-r from-red-500 to-pink-500 text-white border-0 shadow-lg shadow-red-500/30 hover:shadow-xl hover:shadow-red-500/50 hover:scale-105"
          : size === "icon"
            ? "text-white hover:text-white bg-black/40 hover:bg-black/60 backdrop-blur-sm"
            : "border-2 border-gray-300 hover:border-purple-400 hover:shadow-md hover:scale-105"
        }
        ${size === "icon" ? "" : "font-semibold"}
      `}
    >
      <Heart
        className={`${size === "icon" ? "h-4 w-4" : "mr-2 h-4 w-4"} transition-transform duration-300 group-hover:scale-110`}
        fill={isFavorite ? "currentColor" : "none"}
      />
      {showLabel && (size !== "icon") && (isFavorite ? "Favorited" : "Favorite")}
    </Button>
  )
}
