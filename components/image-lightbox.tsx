"use client"

import { useEffect } from "react"
import { createPortal } from "react-dom"
import { X, ZoomIn, ZoomOut } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ImageLightboxProps {
  isOpen: boolean
  onClose: () => void
  imageUrl: string
  imageName: string
}

export function ImageLightbox({ isOpen, onClose, imageUrl, imageName }: ImageLightboxProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape)
      document.body.style.overflow = "hidden"
    }

    return () => {
      document.removeEventListener("keydown", handleEscape)
      document.body.style.overflow = "unset"
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Modal Container */}
      <div
        className="relative bg-white rounded-xl shadow-2xl max-w-7xl max-h-[95vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4 z-20 h-10 w-10 rounded-full bg-black/10 text-black hover:bg-black/20"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </Button>

        {/* Image Container */}
        <div className="flex-1 flex items-center justify-center p-8 overflow-hidden">
          <img
            src={imageUrl}
            alt={imageName}
            className="max-w-full max-h-[80vh] object-contain rounded-lg"
          />
        </div>

        {/* Image Name */}
        <div className="px-8 pb-6 pt-4 border-t bg-gray-50">
          <p className="text-lg font-semibold text-center text-foreground">{imageName}</p>
        </div>
      </div>
    </div>,
    document.body
  )
}
