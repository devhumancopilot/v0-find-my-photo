"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { AlbumCard } from "@/components/album-card"
import { FolderOpen, ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

interface Album {
  id: number
  album_title: string
  cover_image_url: string
  photo_count: number
  created_at: string
  is_favorite: boolean | null
}

interface AlbumsCarouselProps {
  albums: Album[]
  isLoading?: boolean
}

export function AlbumsCarousel({ albums, isLoading = false }: AlbumsCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0)

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? albums.length - 1 : prev - 1))
  }

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === albums.length - 1 ? 0 : prev + 1))
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="relative">
        <Card className="border-white/20 bg-white/60 backdrop-blur-sm">
          <CardContent className="flex flex-col items-center justify-center py-24">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
            <p className="mt-4 text-sm text-muted-foreground">Loading albums...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Empty state
  if (albums.length === 0) {
    return (
      <Card className="border-white/20 bg-white/60 backdrop-blur-sm">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <FolderOpen className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mb-2 text-xl font-semibold text-foreground">No albums yet</h3>
          <p className="mb-6 text-muted-foreground">Create your first album to get started</p>
          <Link href="/create-album">
            <Button className="bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700">
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Album
            </Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  const getPreviousIndex = () => (currentIndex === 0 ? albums.length - 1 : currentIndex - 1)
  const getNextIndex = () => (currentIndex === albums.length - 1 ? 0 : currentIndex + 1)

  return (
    <div className="relative rounded-lg border border-white/20 bg-white/60 backdrop-blur-sm p-8">
      {/* Three Album Display */}
      <div className="flex items-center justify-center gap-6 overflow-hidden">
        {/* Previous Button */}
        <Button
          variant="outline"
          size="icon"
          onClick={handlePrevious}
          className="h-12 w-12 rounded-full bg-white/80 hover:bg-white flex-shrink-0 z-10"
          disabled={albums.length <= 1}
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>

        {/* Previous Album (faded, smaller) */}
        <div
          className="w-72 flex-shrink-0 cursor-pointer"
          onClick={handlePrevious}
          style={{
            transform: 'scale(0.85)',
            opacity: 0.4,
            transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '0.6'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '0.4'}
        >
          <AlbumCard album={albums[getPreviousIndex()]} />
        </div>

        {/* Center Album (highlighted, largest) */}
        <div
          className="w-96 flex-shrink-0 shadow-2xl"
          style={{
            transform: 'scale(1)',
            opacity: 1,
            transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          <AlbumCard album={albums[currentIndex]} />
        </div>

        {/* Next Album (faded, smaller) */}
        <div
          className="w-72 flex-shrink-0 cursor-pointer"
          onClick={handleNext}
          style={{
            transform: 'scale(0.85)',
            opacity: 0.4,
            transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '0.6'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '0.4'}
        >
          <AlbumCard album={albums[getNextIndex()]} />
        </div>

        {/* Next Button */}
        <Button
          variant="outline"
          size="icon"
          onClick={handleNext}
          className="h-12 w-12 rounded-full bg-white/80 hover:bg-white flex-shrink-0 z-10"
          disabled={albums.length <= 1}
        >
          <ChevronRight className="h-6 w-6" />
        </Button>
      </div>

      {/* Indicators */}
      <div className="mt-6 flex justify-center gap-2 flex-wrap px-4">
        {albums.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`h-2.5 rounded-full transition-all duration-300 ${
              index === currentIndex
                ? "w-8 bg-gradient-to-r from-blue-600 to-purple-600"
                : "w-2.5 bg-gray-300 hover:bg-gray-400"
            }`}
          />
        ))}
      </div>

      {/* Album count indicator */}
      <div className="mt-4 text-center">
        <p className="text-sm text-muted-foreground">
          {currentIndex + 1} / {albums.length}
        </p>
      </div>
    </div>
  )
}
