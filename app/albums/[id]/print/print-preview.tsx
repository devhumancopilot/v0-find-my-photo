"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowLeft, Printer, Grid3x3, Grid2x2, LayoutGrid, Image as ImageIcon, Package, ZoomIn, ZoomOut, Download, Loader2 } from "lucide-react"
import { PrintOrderDialog } from "@/components/print-order-dialog"
import { toast } from "sonner"
import { getBackendAPIURL, getAuthHeaders } from "@/lib/config"

interface Photo {
  id: number
  name: string
  file_url: string
  caption: string | null
  position: number
  created_at: string
}

interface PrintPreviewProps {
  photos: Photo[]
  albumTitle: string
  albumId: string
  layoutTemplate: string
  createdAt: string
  isPDFMode?: boolean
}

// Template options configuration
const TEMPLATE_OPTIONS = [
  {
    id: "single-per-page",
    name: "Single Photo Per Page",
    description: "One large photo per page - best for showcasing individual photos",
    icon: ImageIcon,
  },
  {
    id: "grid-2x2",
    name: "2×2 Grid",
    description: "4 photos per page in a square grid - balanced layout",
    icon: Grid2x2,
  },
  {
    id: "grid-3x3",
    name: "3×3 Grid",
    description: "9 photos per page - compact layout for many photos",
    icon: Grid3x3,
  },
  {
    id: "grid-4x4",
    name: "4×4 Grid",
    description: "16 photos per page - maximum density layout",
    icon: LayoutGrid,
  },
  {
    id: "collage",
    name: "Collage",
    description: "6 photos per page with varied sizes - artistic layout",
    icon: LayoutGrid,
  },
]

// Premium Cover Page Component
function PremiumCoverPage({
  albumTitle,
  photoCount,
  createdAt
}: {
  albumTitle: string
  photoCount: number
  createdAt: string
}) {
  const currentYear = new Date().getFullYear()
  const formattedDate = new Date(createdAt).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })

  return (
    <div className="page-wrapper">
      <div className="print-page page-break bg-gradient-to-br from-gray-50 via-white to-gray-50">
        <div className="flex h-full flex-col items-center justify-center text-center">
          {/* Main Content - Centered */}
          <div className="relative z-10 space-y-10">
            {/* Decorative top ornament */}
            <div className="flex items-center justify-center gap-2">
              <div className="h-px w-16 bg-gradient-to-r from-transparent via-gray-400 to-transparent"></div>
              <div className="flex gap-1">
                <div className="h-1 w-1 rounded-full bg-blue-500"></div>
                <div className="h-1 w-1 rounded-full bg-purple-500"></div>
                <div className="h-1 w-1 rounded-full bg-pink-500"></div>
              </div>
              <div className="h-px w-16 bg-gradient-to-r from-transparent via-gray-400 to-transparent"></div>
            </div>

            {/* Main Title */}
            <div className="space-y-6">
              <h1 className="font-serif text-6xl font-bold tracking-wide text-gray-900 leading-tight">
                {albumTitle}
              </h1>
              <div className="mx-auto h-1 w-32 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 shadow-lg shadow-purple-500/20"></div>
            </div>

            {/* Album Details */}
            <div className="space-y-6 py-8">
              <div className="flex items-center justify-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-purple-100">
                  <ImageIcon className="h-5 w-5 text-purple-600" />
                </div>
                <p className="text-2xl font-light tracking-wide text-gray-700">
                  {photoCount} {photoCount === 1 ? 'Photograph' : 'Photographs'}
                </p>
              </div>

              <div className="flex items-center justify-center gap-2">
                <div className="h-px w-24 bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
              </div>

              <p className="text-lg font-light tracking-wide text-gray-600">
                {formattedDate}
              </p>
            </div>

            {/* Decorative bottom ornament */}
            <div className="flex items-center justify-center gap-2">
              <div className="h-px w-16 bg-gradient-to-r from-transparent via-gray-400 to-transparent"></div>
              <div className="flex gap-1">
                <div className="h-1 w-1 rounded-full bg-blue-500"></div>
                <div className="h-1 w-1 rounded-full bg-purple-500"></div>
                <div className="h-1 w-1 rounded-full bg-pink-500"></div>
              </div>
              <div className="h-px w-16 bg-gradient-to-r from-transparent via-gray-400 to-transparent"></div>
            </div>
          </div>

          {/* Footer - Absolute positioned at bottom */}
          <div className="absolute bottom-16 left-0 right-0 text-center space-y-2">
            <p className="font-serif text-base italic text-gray-500 tracking-wide">
              A curated collection of memories
            </p>
            <p className="text-xs text-gray-400 tracking-widest uppercase">
              © {currentYear} Find My Photo
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// Single Photo Per Page Layout Component
function SinglePhotoPerPageLayout({ photos, albumTitle }: { photos: Photo[]; albumTitle: string }) {
  return (
    <>
      {photos.map((photo, index) => (
        <div key={photo.id} className="page-wrapper">
          <div className="print-page page-break">
            <div className="h-full flex flex-col">
              {/* Main content area - text wraps around image */}
              <div className="flex-1 relative">
                {/* Image - Upper Left with float for text wrapping */}
                <div className="float-left mr-8 mb-6">
                  <div className="relative">
                    <img
                      src={photo.file_url}
                      alt={photo.name}
                      className="h-[500px] w-[420px] object-cover rounded-lg shadow-2xl"
                      style={{
                        objectPosition: 'center'
                      }}
                    />
                    {/* Decorative frame */}
                    <div className="absolute -inset-2 border border-gray-300 rounded-lg -z-10 opacity-40"></div>
                  </div>
                </div>

                {/* Text content - Lower Right area, wraps around image */}
                <div className="text-right pt-48">
                  {/* Photo title */}
                  <h2 className="mb-4 text-2xl font-serif font-bold text-gray-900 tracking-wide">
                    {photo.name}
                  </h2>

                  {/* Decorative divider */}
                  <div className="mb-4 flex items-center justify-end gap-2">
                    <div className="h-px w-12 bg-gradient-to-l from-purple-400 to-transparent"></div>
                    <div className="h-1 w-1 rounded-full bg-purple-400"></div>
                  </div>

                  {/* Caption text - wraps around image */}
                  {photo.caption && (
                    <div className="mb-8 text-justify">
                      <p className="font-serif text-base text-gray-700 leading-relaxed">
                        "{photo.caption}"
                      </p>
                    </div>
                  )}
                </div>

                {/* Clear float to prevent overflow */}
                <div className="clear-both"></div>
              </div>

              {/* Photo metadata - Compact footer at bottom */}
              <div className="mt-auto pt-3 border-t border-gray-300 flex-shrink-0">
                <div className="flex items-center justify-between text-[11px] text-gray-600">
                  <span className="font-medium">
                    Photograph {index + 1} of {photos.length}
                  </span>
                  <span className="text-gray-400">•</span>
                  <span className="italic">
                    {new Date(photo.created_at).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </span>
                </div>
              </div>

              {/* Album title - Footer, aligned with page */}
              <div className="mt-2 pt-2 border-t border-gray-200 flex-shrink-0">
                <p className="text-[10px] text-gray-400 tracking-widest uppercase font-medium text-center">
                  {albumTitle}
                </p>
              </div>
            </div>
          </div>
        </div>
      ))}
    </>
  )
}

// Grid Layout Component (supports 2x2, 3x3, 4x4)
function GridLayout({ photos, albumTitle, columns }: { photos: Photo[]; albumTitle: string; columns: number }) {
  const photosPerPage = columns * columns
  const pages: Photo[][] = []

  // Split photos into pages
  for (let i = 0; i < photos.length; i += photosPerPage) {
    pages.push(photos.slice(i, i + photosPerPage))
  }

  return (
    <>
      {pages.map((pagePhotos, pageIndex) => (
        <div key={pageIndex} className="page-wrapper">
          <div className="print-page page-break">
            <div className="h-full flex flex-col">
              {/* Photo Grid - Uniform sized images with proper spacing */}
              <div
                className="grid gap-3 mb-4"
                style={{
                  gridTemplateColumns: `repeat(${columns}, 1fr)`,
                  gridTemplateRows: `repeat(${columns}, 1fr)`,
                  flex: '1 1 0',
                  minHeight: 0,
                }}
              >
                {pagePhotos.map((photo) => (
                  <div key={photo.id} className="relative overflow-hidden rounded-lg border border-gray-200 shadow-md">
                    <div className="aspect-square">
                      <img
                        src={photo.file_url}
                        alt={photo.name}
                        className="h-full w-full object-cover transition-transform hover:scale-105"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Page Footer - Compact footer at bottom */}
              <div className="mt-auto pt-3 border-t border-gray-300 flex-shrink-0">
                <div className="flex items-center justify-between text-[11px] text-gray-600">
                  <span className="font-medium">
                    Page {pageIndex + 1} of {pages.length}
                  </span>
                  <span className="italic text-gray-400">
                    {new Date().toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Album title - Footer */}
              <div className="mt-2 pt-2 border-t border-gray-200 flex-shrink-0">
                <p className="text-[10px] text-gray-400 tracking-widest uppercase font-medium text-center">
                  {albumTitle}
                </p>
              </div>
            </div>
          </div>
        </div>
      ))}
    </>
  )
}

// Collage Layout Component (mixed sizes for visual variety)
function CollageLayout({ photos, albumTitle }: { photos: Photo[]; albumTitle: string }) {
  const photosPerPage = 6
  const pages: Photo[][] = []

  // State to store image aspect ratios
  const [imageAspectRatios, setImageAspectRatios] = useState<Record<number, number>>({})

  // Split photos into pages
  for (let i = 0; i < photos.length; i += photosPerPage) {
    pages.push(photos.slice(i, i + photosPerPage))
  }

  // Preload images and detect their dimensions
  useEffect(() => {
    const aspectRatios: Record<number, number> = {}
    let loadedCount = 0

    photos.forEach((photo) => {
      const img = new Image()
      img.onload = () => {
        // Calculate aspect ratio (width / height)
        aspectRatios[photo.id] = img.width / img.height
        loadedCount++

        // Update state when all images are loaded
        if (loadedCount === photos.length) {
          setImageAspectRatios(aspectRatios)
        }
      }
      img.onerror = () => {
        // Default to square aspect ratio if image fails to load
        aspectRatios[photo.id] = 1
        loadedCount++

        if (loadedCount === photos.length) {
          setImageAspectRatios(aspectRatios)
        }
      }
      img.src = photo.file_url
    })
  }, [photos])

  // Grid tracking: 3x3 grid represented as boolean array
  type GridCell = boolean // true = occupied, false = available
  type Grid = GridCell[][]

  // Helper: Create empty 3x3 grid
  const createEmptyGrid = (): Grid => {
    return Array(3).fill(null).map(() => Array(3).fill(false))
  }

  // Helper: Check if a container can fit at position (row, col)
  const canFitContainer = (grid: Grid, row: number, col: number, rowSpan: number, colSpan: number): boolean => {
    // Check boundaries
    if (row + rowSpan > 3 || col + colSpan > 3) return false

    // Check if all required cells are available
    for (let r = row; r < row + rowSpan; r++) {
      for (let c = col; c < col + colSpan; c++) {
        if (grid[r][c]) return false // Cell is occupied
      }
    }
    return true
  }

  // Helper: Mark cells as occupied
  const occupyCells = (grid: Grid, row: number, col: number, rowSpan: number, colSpan: number): void => {
    for (let r = row; r < row + rowSpan; r++) {
      for (let c = col; c < col + colSpan; c++) {
        grid[r][c] = true
      }
    }
  }

  // Helper: Find next available position for a container
  const findAvailablePosition = (grid: Grid, rowSpan: number, colSpan: number): { row: number; col: number } | null => {
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        if (canFitContainer(grid, row, col, rowSpan, colSpan)) {
          return { row, col }
        }
      }
    }
    return null // No available position
  }

  // Helper: Determine best container size for an image based on aspect ratio
  const getBestContainerSize = (aspectRatio: number): { rowSpan: number; colSpan: number; priority: number } => {
    // Priority: higher number = try this size first
    if (aspectRatio < 0.7) {
      // Very portrait (tall and narrow)
      return { rowSpan: 2, colSpan: 1, priority: 3 } // Tall container
    } else if (aspectRatio > 1.6) {
      // Very landscape (wide)
      return { rowSpan: 1, colSpan: 2, priority: 3 } // Wide container
    } else if (aspectRatio >= 0.85 && aspectRatio <= 1.15) {
      // Nearly square
      return { rowSpan: 2, colSpan: 2, priority: 2 } // Large square container
    } else if (aspectRatio > 1.15 && aspectRatio <= 1.6) {
      // Moderately landscape
      return { rowSpan: 1, colSpan: 2, priority: 2 } // Wide container
    } else if (aspectRatio < 0.85 && aspectRatio >= 0.7) {
      // Moderately portrait
      return { rowSpan: 2, colSpan: 1, priority: 2 } // Tall container
    } else {
      // Default
      return { rowSpan: 1, colSpan: 1, priority: 1 } // Small container
    }
  }

  // Queue-based allocation: Process images one by one
  const allocatePhotosToContainers = (pagePhotos: Photo[]) => {
    // If aspect ratios aren't loaded yet, use simple allocation
    if (Object.keys(imageAspectRatios).length === 0) {
      return pagePhotos.slice(0, 6).map((photo, index) => ({
        photo,
        sizeClass: "col-span-1 row-span-1",
        position: { row: Math.floor(index / 3), col: index % 3 }
      }))
    }

    const grid = createEmptyGrid()
    const allocations: Array<{ photo: Photo; sizeClass: string; position: { row: number; col: number } }> = []
    const totalImages = Math.min(pagePhotos.length, 6)

    // Process images in order (queue-based)
    for (let i = 0; i < pagePhotos.length && allocations.length < 6; i++) {
      const photo = pagePhotos[i]
      const aspectRatio = imageAspectRatios[photo.id] || 1
      const remainingImages = totalImages - allocations.length

      // Count free cells in grid
      let freeCells = 0
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          if (!grid[r][c]) freeCells++
        }
      }

      // Get best container size for this image
      let { rowSpan, colSpan } = getBestContainerSize(aspectRatio)

      // Be conservative with large containers if we need to fit many images
      // Limit 2x2 containers if we have more than 2 images left and limited space
      if (rowSpan === 2 && colSpan === 2 && remainingImages > 2 && freeCells < 7) {
        // Downgrade to smaller container to ensure we can fit more images
        if (aspectRatio > 1.2) {
          rowSpan = 1
          colSpan = 2 // Wide
        } else if (aspectRatio < 0.8) {
          rowSpan = 2
          colSpan = 1 // Tall
        } else {
          rowSpan = 1
          colSpan = 1 // Small
        }
      }

      // Try to place the container
      let position = findAvailablePosition(grid, rowSpan, colSpan)
      let finalRowSpan = rowSpan
      let finalColSpan = colSpan

      // If the preferred size doesn't fit, try smaller sizes
      if (!position) {
        // Try fallback sizes in order of preference (always include 1x1 as final fallback)
        const fallbacks = [
          { rowSpan: 1, colSpan: 2 }, // Wide
          { rowSpan: 2, colSpan: 1 }, // Tall
          { rowSpan: 1, colSpan: 1 }, // Small (guaranteed to fit if any space)
        ]

        for (const fallback of fallbacks) {
          // Skip if it's the same as what we already tried
          if (fallback.rowSpan === rowSpan && fallback.colSpan === colSpan) continue

          position = findAvailablePosition(grid, fallback.rowSpan, fallback.colSpan)
          if (position) {
            finalRowSpan = fallback.rowSpan
            finalColSpan = fallback.colSpan
            break
          }
        }
      }

      // Place the image if we found a position
      if (position) {
        occupyCells(grid, position.row, position.col, finalRowSpan, finalColSpan)
        allocations.push({
          photo,
          sizeClass: `col-span-${finalColSpan} row-span-${finalRowSpan}`,
          position
        })
      }

      // If we still couldn't place it after trying all fallbacks, the grid is full
      // This should rarely happen as 1x1 should always fit if there's any free cell
    }

    return allocations
  }

  return (
    <>
      {pages.map((pagePhotos, pageIndex) => {
        // Get smart allocation for this page's photos
        const allocatedPhotos = allocatePhotosToContainers(pagePhotos)

        return (
          <div key={pageIndex} className="page-wrapper">
            <div className="print-page page-break">
              <div className="h-full flex flex-col">
                {/* Collage Grid - smart queue-based layout */}
                <div
                  className="grid grid-cols-3 grid-rows-3 gap-3 mb-4"
                  style={{
                    flex: '1 1 0',
                    minHeight: 0,
                  }}
                >
                  {allocatedPhotos.map(({ photo, sizeClass, position }) => {
                    const aspectRatio = imageAspectRatios[photo.id] || 1

                    // Extract row and col span from sizeClass
                    const colSpanMatch = sizeClass.match(/col-span-(\d+)/)
                    const rowSpanMatch = sizeClass.match(/row-span-(\d+)/)
                    const colSpan = colSpanMatch ? parseInt(colSpanMatch[1]) : 1
                    const rowSpan = rowSpanMatch ? parseInt(rowSpanMatch[1]) : 1

                    return (
                      <div
                        key={photo.id}
                        className={`relative rounded-lg border border-gray-200 shadow-md overflow-hidden flex items-center justify-center p-2`}
                        style={{
                          gridColumn: `${position.col + 1} / span ${colSpan}`,
                          gridRow: `${position.row + 1} / span ${rowSpan}`,
                        }}
                      >
                        {/* Blurred background image */}
                        <div
                          className="absolute inset-0 bg-cover bg-center"
                          style={{
                            backgroundImage: `url(${photo.file_url})`,
                            filter: 'blur(20px)',
                            transform: 'scale(1.1)',
                            opacity: 0.6,
                          }}
                        />

                        {/* Main image on top */}
                        <img
                          src={photo.file_url}
                          alt={photo.name}
                          className="relative max-w-full max-h-full w-auto h-auto object-contain rounded transition-transform hover:scale-105 z-10"
                        />
                      </div>
                    )
                  })}
                </div>

                {/* Page Footer - Compact footer at bottom */}
                <div className="mt-auto pt-3 border-t border-gray-300 flex-shrink-0">
                  <div className="flex items-center justify-between text-[11px] text-gray-600">
                    <span className="font-medium">
                      Page {pageIndex + 1} of {pages.length}
                    </span>
                    <span className="italic text-gray-400">
                      {new Date().toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Album title - Footer */}
                <div className="mt-2 pt-2 border-t border-gray-200 flex-shrink-0">
                  <p className="text-[10px] text-gray-400 tracking-widest uppercase font-medium text-center">
                    {albumTitle}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </>
  )
}

export default function PrintPreview({ photos, albumTitle, albumId, layoutTemplate, createdAt, isPDFMode = false }: PrintPreviewProps) {
  // State for selected template - initialize with the suggested template
  const [selectedTemplate, setSelectedTemplate] = useState(layoutTemplate)
  const [orderDialogOpen, setOrderDialogOpen] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(75) // Default 75% zoom
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  const [isPDFReady, setIsPDFReady] = useState(false)
  const pdfContentRef = useRef<HTMLDivElement>(null)

  // Wait for images and styles to load before marking as PDF-ready
  useEffect(() => {
    if (!isPDFMode) return

    const waitForReady = async () => {
      // Wait for all images to load
      const images = Array.from(document.images)
      await Promise.all(
        images.map(
          (img) =>
            new Promise((resolve) => {
              if (img.complete) {
                resolve(null)
              } else {
                img.onload = () => resolve(null)
                img.onerror = () => resolve(null)
              }
            })
        )
      )

      // Additional delay to ensure CSS is fully applied
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Mark as ready
      setIsPDFReady(true)
      console.log('[Print Preview] PDF ready')
    }

    waitForReady()
  }, [isPDFMode])

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print()
    }
  }

  const handleDownloadPDF = async () => {
    setIsGeneratingPDF(true)

    try {
      toast.info('Generating PDF', {
        description: 'Please wait while we create your high-quality album PDF with advanced vision rendering...',
      })

      console.log('[PDF] Starting server-side WYSIWYG PDF generation with Puppeteer...')

      // Call backend API to generate PDF using Puppeteer
      const authHeaders = await getAuthHeaders()
      const response = await fetch(
        getBackendAPIURL(`/api/album/${albumId}/generate-pdf`),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders,
          },
          body: JSON.stringify({
            layoutTemplate: selectedTemplate,
          }),
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to generate PDF')
      }

      // Download the PDF blob
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${albumTitle.replace(/[^a-z0-9]/gi, '_')}_${selectedTemplate}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      console.log('[PDF] PDF downloaded successfully')

      toast.success('PDF Downloaded', {
        description: 'Your album PDF has been generated with print-quality rendering!',
      })
    } catch (error) {
      console.error('PDF generation error:', error)
      toast.error('PDF Generation Failed', {
        description: error instanceof Error ? error.message : 'Failed to generate PDF. Please try again.',
      })
    } finally {
      setIsGeneratingPDF(false)
    }
  }

  return (
    <>
      {/* Print Order Dialog */}
      <PrintOrderDialog
        open={orderDialogOpen}
        onOpenChange={setOrderDialogOpen}
        albumId={albumId}
        albumTitle={albumTitle}
        photoCount={photos.length}
        layoutTemplate={selectedTemplate}
      />

      {/* Print-specific styles */}
      <style jsx global>{`
        /* Page break helpers for html2pdf */
        .page-wrapper {
          page-break-after: always;
          page-break-inside: avoid;
          break-after: always;
          break-inside: avoid;
        }

        .page-wrapper:last-child {
          page-break-after: auto;
          break-after: auto;
        }

        .print-page {
          page-break-inside: avoid;
          break-inside: avoid;
        }

        @media print {
          body {
            margin: 0;
            padding: 0;
          }

          .no-print {
            display: none !important;
          }

          /* Reset main container for print */
          .flex.h-\\[calc\\(100vh-73px\\)\\] {
            height: auto !important;
          }

          /* Reset page wrapper for print */
          .page-wrapper {
            width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            position: static !important;
          }

          /* Reset print-page styles for actual printing */
          .print-page {
            page-break-after: always;
            page-break-inside: avoid;
            min-height: 100vh;
            padding: 0.75in !important;
            width: 100% !important;
            height: auto !important;
            transform: none !important;
            position: static !important;
            box-shadow: none !important;
            border: none !important;
            outline: none !important;
            border-radius: 0 !important;
            background: white !important;
            overflow: visible !important;
          }

          .print-page:last-child {
            page-break-after: auto;
          }

          /* Ensure images print properly */
          .print-page img {
            max-width: 100% !important;
            height: auto !important;
            page-break-inside: avoid;
          }

          /* Reset pages wrapper for print */
          .pages-wrapper {
            display: block !important;
            padding: 0 !important;
          }

          /* Reset preview area for print */
          .overflow-x-hidden {
            overflow: visible !important;
          }

          .overflow-y-auto {
            overflow: visible !important;
          }

          .bg-gray-200 {
            background: white !important;
          }

          @page {
            size: letter portrait;
            margin: 0.5in;
          }
        }

        @media screen {
          /* Page wrapper provides layout dimensions for wrapping */
          .page-wrapper {
            width: calc(850px * var(--zoom-level, 1));
            height: calc(1100px * var(--zoom-level, 1));
            flex-shrink: 0;
            margin: 12px;
            position: relative;
          }

          /* Actual page uses fixed dimensions with visual scaling */
          .pages-wrapper .print-page {
            width: 850px;
            height: 1100px;
            padding: 80px;
            background: white;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05);
            border-radius: 4px;
            overflow: hidden;
            font-size: 1rem;
            transform: scale(var(--zoom-level, 1));
            transform-origin: top left;
            position: absolute;
            top: 0;
            left: 0;
            /* Premium border frame - double border effect */
            border: 2px solid rgba(229, 231, 235, 0.5);
            outline: 1px solid rgba(209, 213, 219, 0.3);
            outline-offset: -16px;
          }

          .pages-wrapper .print-page:hover {
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.08);
          }

          /* Images fit within pages naturally */
          .pages-wrapper .print-page img {
            max-width: 100%;
            height: auto;
          }

          .page-break {
            /* Remove the dashed border for cleaner look */
            border-bottom: none;
          }

          /* Pages wrapper - automatically wraps based on zoom level and space */
          .pages-wrapper {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            align-items: flex-start;
            gap: 24px;
            width: 100%;
          }
        }
      `}</style>

      {/* Screen-only header with navigation and action buttons */}
      {!isPDFMode && (
      <div className="no-print sticky top-0 z-50 border-b border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between px-6 py-4">
          <Link href={`/albums/${albumId}`}>
            <Button variant="ghost">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Album
            </Button>
          </Link>

          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-600">
              {photos.length} photos • {albumTitle}
            </div>
            <Button
              onClick={() => setOrderDialogOpen(true)}
              className="group relative overflow-hidden bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/50 hover:scale-105 border-0"
            >
              {/* Shimmer effect */}
              <span className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/30 to-transparent" />

              {/* Hover gradient overlay */}
              <span className="absolute inset-0 bg-gradient-to-r from-pink-600 via-purple-600 to-blue-600 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

              {/* Pulse animation */}
              <span className="absolute -inset-1 animate-pulse-slow rounded-lg bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 opacity-30 blur-md" />

              <Package className="relative mr-2 h-4 w-4 transition-transform duration-300 group-hover:scale-110" />
              <span className="relative font-semibold">Order Physical Album</span>
            </Button>
            <Button
              onClick={handleDownloadPDF}
              disabled={isGeneratingPDF}
              variant="default"
              className="bg-green-600 hover:bg-green-700 text-white font-semibold transition-all duration-300 hover:scale-105 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGeneratingPDF ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating PDF...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Download as PDF
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
      )}

      {/* Main Content Area: Sidebar + Preview */}
      <div className={isPDFMode ? "flex h-screen" : "flex h-[calc(100vh-73px)]"}>
        {/* Left Sidebar - Controls */}
        {!isPDFMode && (
        <div className="no-print w-80 flex-shrink-0 overflow-y-auto border-r border-gray-200 bg-white p-4">
          {/* Zoom Controls Section */}
          <div className="mb-6">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-700">
              Zoom Level
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setZoomLevel(Math.max(50, zoomLevel - 10))}
                  disabled={zoomLevel <= 50}
                  className="h-8 w-8 p-0"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </Button>

                <span className="text-base font-bold text-gray-900">
                  {zoomLevel}%
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setZoomLevel(Math.min(100, zoomLevel + 10))}
                  disabled={zoomLevel >= 100}
                  className="h-8 w-8 p-0"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
              </div>

              <input
                type="range"
                min="50"
                max="100"
                step="5"
                value={zoomLevel}
                onChange={(e) => setZoomLevel(Number(e.target.value))}
                className="w-full cursor-pointer"
              />

              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant={zoomLevel === 50 ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setZoomLevel(50)}
                >
                  50%
                </Button>
                <Button
                  variant={zoomLevel === 75 ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setZoomLevel(75)}
                >
                  75%
                </Button>
                <Button
                  variant={zoomLevel === 100 ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setZoomLevel(100)}
                >
                  100%
                </Button>
              </div>
            </div>
          </div>

          {/* Template Selector Section */}
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-700">
              Print Layout
            </h3>
            <div className="space-y-1.5">
              {TEMPLATE_OPTIONS.map((template) => {
                const Icon = template.icon
                const isSelected = selectedTemplate === template.id

                return (
                  <Card
                    key={template.id}
                    className={`cursor-pointer transition-all ${
                      isSelected
                        ? "border-2 border-blue-500 bg-blue-50 shadow-md"
                        : "border border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm"
                    }`}
                    onClick={() => setSelectedTemplate(template.id)}
                  >
                    <div className="p-2">
                      <div className="mb-1 flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${isSelected ? "text-blue-600" : "text-gray-600"}`} />
                        <h4 className={`flex-1 text-xs font-semibold ${isSelected ? "text-blue-900" : "text-gray-800"}`}>
                          {template.name}
                        </h4>
                        {isSelected && (
                          <div className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500">
                            <svg
                              className="h-2.5 w-2.5 text-white"
                              fill="none"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path d="M5 13l4 4L19 7"></path>
                            </svg>
                          </div>
                        )}
                      </div>
                      <p className={`text-[11px] leading-tight ${isSelected ? "text-blue-700" : "text-gray-600"}`}>
                        {template.description}
                      </p>
                    </div>
                  </Card>
                )
              })}
            </div>
          </div>
        </div>
        )}

        {/* Right Side - Preview Area */}
        <div
          ref={pdfContentRef}
          className={isPDFMode ? "flex-1 overflow-visible bg-white" : "flex-1 overflow-x-hidden overflow-y-auto bg-gray-200 print:bg-white print:p-0"}
        >
          <div className="w-full p-8 print:p-0">
            {/* Pages wrapper - pages wrap automatically based on zoom */}
            <div
              className="pages-wrapper print:p-0"
              data-pdf-ready={isPDFReady ? "true" : undefined}
              style={{
                // Pass zoom level as CSS variable for pages to use
                ['--zoom-level' as any]: isPDFMode ? 1 : zoomLevel / 100,
              }}
            >
          {/* Render appropriate layout based on selected template */}
          {photos.length === 0 ? (
            <div className="flex min-h-screen items-center justify-center">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-800">No photos to print</h2>
                <p className="mt-2 text-gray-600">This album doesn't contain any photos yet.</p>
                <Link href={`/albums/${albumId}`} className="mt-4 inline-block">
                  <Button>Return to Album</Button>
                </Link>
              </div>
            </div>
          ) : (
            <>
              {/* Premium Cover Page - Always appears first */}
              <PremiumCoverPage
                albumTitle={albumTitle}
                photoCount={photos.length}
                createdAt={createdAt}
              />

              {/* Photo Pages - Based on selected template */}
              {selectedTemplate === "single-per-page" ? (
                <SinglePhotoPerPageLayout photos={photos} albumTitle={albumTitle} />
              ) : selectedTemplate === "grid-2x2" ? (
                <GridLayout photos={photos} albumTitle={albumTitle} columns={2} />
              ) : selectedTemplate === "grid-3x3" ? (
                <GridLayout photos={photos} albumTitle={albumTitle} columns={3} />
              ) : selectedTemplate === "grid-4x4" ? (
                <GridLayout photos={photos} albumTitle={albumTitle} columns={4} />
              ) : selectedTemplate === "collage" ? (
                <CollageLayout photos={photos} albumTitle={albumTitle} />
              ) : (
                <GridLayout photos={photos} albumTitle={albumTitle} columns={2} />
              )}
            </>
          )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
