"use client"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { AlbumCard } from "@/components/album-card"
import { FolderOpen } from "lucide-react"
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
  const [isPaused, setIsPaused] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [centeredAlbumIndex, setCenteredAlbumIndex] = useState<number>(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [albumScales, setAlbumScales] = useState<Record<number, number>>({})
  const animationFrameRef = useRef<number | undefined>(undefined)
  const resumeTimeoutRef = useRef<number | undefined>(undefined)
  const countdownIntervalRef = useRef<number | undefined>(undefined)

  // Calculate scale based on position
  const updateAlbumScales = () => {
    if (!scrollRef.current || !containerRef.current) return

    const container = containerRef.current
    const containerRect = container.getBoundingClientRect()
    const containerCenter = containerRect.left + containerRect.width / 2

    const albumElements = scrollRef.current.querySelectorAll('.album-card')
    const newScales: Record<number, number> = {}
    let closestIndex = 0
    let closestDistance = Infinity

    albumElements.forEach((album, index) => {
      const albumRect = album.getBoundingClientRect()
      const albumCenter = albumRect.left + albumRect.width / 2

      // Calculate distance from center (0 = perfect center, increases as it moves away)
      const distance = Math.abs(containerCenter - albumCenter)
      const maxDistance = containerRect.width / 2 // Half viewport width

      // Track which album is closest to center
      if (distance < closestDistance) {
        closestDistance = distance
        closestIndex = index
      }

      // Calculate scale: 1.0 at center, 0.75 at edges
      const normalizedDistance = Math.min(distance / maxDistance, 1)
      const scale = 1.0 - (normalizedDistance * 0.25) // Scale from 1.0 to 0.75

      // Calculate opacity: 1.0 at center, 0.6 at edges
      const opacity = 1.0 - (normalizedDistance * 0.4) // Opacity from 1.0 to 0.6

      newScales[index] = scale

      // Apply the transform directly for smoother animation
      const element = album as HTMLElement
      element.style.transform = `scale(${scale})`
      element.style.opacity = opacity.toString()
    })

    setAlbumScales(newScales)
    // Update centered album index (map back to original album index)
    setCenteredAlbumIndex(closestIndex % albums.length)
  }

  // Update scales on animation frame
  useEffect(() => {
    const animate = () => {
      updateAlbumScales()
      animationFrameRef.current = requestAnimationFrame(animate)
    }

    animationFrameRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (resumeTimeoutRef.current) {
        window.clearTimeout(resumeTimeoutRef.current)
      }
      if (countdownIntervalRef.current) {
        window.clearInterval(countdownIntervalRef.current)
      }
    }
  }, [albums.length])

  const handleAlbumClick = (index: number, e: React.MouseEvent) => {
    // Don't do anything if clicking on buttons or links
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('a')) {
      return
    }

    if (!scrollRef.current || !containerRef.current) return

    // Get the clicked album element
    const albumElements = scrollRef.current.querySelectorAll('.album-card')
    const clickedElement = albumElements[index] as HTMLElement
    if (!clickedElement) return

    // Pause animation
    setIsPaused(true)
    setCountdown(5)

    // Start countdown timer
    if (countdownIntervalRef.current) {
      window.clearInterval(countdownIntervalRef.current)
    }
    countdownIntervalRef.current = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          if (countdownIntervalRef.current) {
            window.clearInterval(countdownIntervalRef.current)
          }
          return null
        }
        return prev - 1
      })
    }, 1000)

    // Calculate the offset needed to center the clicked album
    const containerRect = containerRef.current.getBoundingClientRect()
    const albumRect = clickedElement.getBoundingClientRect()
    const containerCenter = containerRect.left + containerRect.width / 2
    const albumCenter = albumRect.left + albumRect.width / 2
    const offsetNeeded = containerCenter - albumCenter

    // Get current transform and add the centering offset
    const currentTransform = window.getComputedStyle(scrollRef.current).transform
    let currentX = 0

    if (currentTransform && currentTransform !== 'none') {
      const matrix = currentTransform.match(/matrix\((.+)\)/)
      if (matrix) {
        const values = matrix[1].split(', ')
        currentX = parseFloat(values[4]) || 0
      }
    }

    // Apply the new transform to center the album
    scrollRef.current.style.transform = `translateX(${currentX + offsetNeeded}px)`
    scrollRef.current.style.transition = 'transform 0.5s ease-out'

    // Clear any existing timeout
    if (resumeTimeoutRef.current) {
      window.clearTimeout(resumeTimeoutRef.current)
    }

    // Auto-resume after 5 seconds
    resumeTimeoutRef.current = window.setTimeout(() => {
      setCountdown(null)
      if (scrollRef.current) {
        // Get the current transform position
        const currentTransform = window.getComputedStyle(scrollRef.current).transform
        let currentX = 0

        if (currentTransform && currentTransform !== 'none') {
          const matrix = currentTransform.match(/matrix\((.+)\)/)
          if (matrix) {
            const values = matrix[1].split(', ')
            currentX = parseFloat(values[4]) || 0
          }
        }

        // Calculate animation progress based on current position
        const MIN_ITEMS_FOR_SMOOTH_ANIMATION = 30
        const SECONDS_PER_ITEM = 4  // Consistent speed
        const animationItemCount = Math.max(albums.length, MIN_ITEMS_FOR_SMOOTH_ANIMATION)
        const animationDuration = animationItemCount * SECONDS_PER_ITEM
        const totalDistance = animationItemCount * 432

        // Normalize currentX to be within one animation cycle
        // Since we have infinite loop, get position within single cycle
        const normalizedX = ((Math.abs(currentX) % totalDistance) / totalDistance)

        // Set negative animation-delay to start from current position
        // This makes the animation continue from where we paused
        const delay = -(normalizedX * animationDuration)
        scrollRef.current.style.animationDelay = `${delay}s`
        scrollRef.current.style.transition = ''
        scrollRef.current.style.transform = '' // Remove inline transform, let animation take over
      }
      setIsPaused(false)
    }, 5000)
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

  // Duplicate albums to reach minimum count for smooth animation
  // Target: ~30 items minimum for consistent smooth scrolling
  const MIN_ITEMS_FOR_SMOOTH_ANIMATION = 30
  const duplicateCount = Math.max(2, Math.ceil(MIN_ITEMS_FOR_SMOOTH_ANIMATION / albums.length))
  const duplicatedAlbums = Array(duplicateCount).fill(albums).flat()

  // Animation should move through at least 30 items worth of distance for smooth scrolling
  // This ensures the same speed regardless of actual item count
  const SECONDS_PER_ITEM = 4  // Consistent speed (same as 30+ items)
  const animationItemCount = Math.max(albums.length, MIN_ITEMS_FOR_SMOOTH_ANIMATION)
  const animationDuration = animationItemCount * SECONDS_PER_ITEM
  const animationDistance = animationItemCount * 432 // Move through 30 items minimum

  return (
    <>
      <div className="relative overflow-hidden rounded-lg border border-white/20 bg-white/60 backdrop-blur-sm p-8">
        {/* Continuous flowing carousel */}
        <div ref={containerRef} className="relative overflow-hidden py-12">
          <div
            ref={scrollRef}
            className={`flex gap-8 items-center justify-start ${isPaused ? '' : 'animate-scroll'}`}
            style={{
              width: 'max-content',
              paddingLeft: 'calc(50% - 200px)',
              paddingRight: 'calc(50% - 200px)',
            }}
          >
            {duplicatedAlbums.map((album, index) => {
              const scale = albumScales[index] || 0.75
              const isCenter = scale > 0.9 // Consider it center if scale is > 0.9

              return (
                <div
                  key={`${album.id}-${index}`}
                  data-index={index}
                  className="album-card flex-shrink-0 transition-all duration-300 ease-out cursor-pointer"
                  style={{
                    width: '400px',
                  }}
                  onClick={(e) => handleAlbumClick(index, e)}
                >
                  <AlbumCard album={album} />
                </div>
              )
            })}
          </div>
        </div>

        {/* Indicators */}
        <div className="mt-6 flex justify-center gap-2 flex-wrap px-4">
          {albums.map((_, index) => (
            <div
              key={index}
              className={`h-2.5 rounded-full transition-all duration-300 ${
                index === centeredAlbumIndex
                  ? "w-8 bg-gradient-to-r from-blue-600 to-purple-600"
                  : "w-2.5 bg-gray-300"
              }`}
            />
          ))}
        </div>

        {/* Album count indicator */}
        <div className="mt-4 text-center">
          <p className="text-sm text-muted-foreground">
            {centeredAlbumIndex + 1} / {albums.length}
            {isPaused && countdown !== null && (
              <span className="ml-2 text-blue-600 font-medium">
                (Paused - Resumes in {countdown}s)
              </span>
            )}
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(calc(-${animationDistance}px));
          }
        }

        .animate-scroll {
          animation: scroll ${animationDuration}s linear infinite;
        }
      `}</style>
    </>
  )
}
