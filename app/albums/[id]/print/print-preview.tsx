"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowLeft, Printer, Grid3x3, Grid2x2, LayoutGrid, Image as ImageIcon } from "lucide-react"

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
    <div className="print-page page-break">
      <div className="flex h-full flex-col items-center justify-center p-12 text-center">
        {/* Decorative top border */}
        <div className="mb-12 w-32 border-t-4 border-gray-800"></div>

        {/* Main Title */}
        <div className="mb-16">
          <h1 className="mb-6 font-serif text-6xl font-bold tracking-tight text-gray-900">
            {albumTitle}
          </h1>
          <div className="mx-auto h-1 w-24 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>
        </div>

        {/* Album Details */}
        <div className="mb-16 space-y-6">
          <div className="flex items-center justify-center gap-3">
            <ImageIcon className="h-6 w-6 text-gray-600" />
            <p className="text-xl font-light text-gray-700">
              {photoCount} {photoCount === 1 ? 'Photograph' : 'Photographs'}
            </p>
          </div>

          <div className="flex items-center justify-center gap-3">
            <div className="h-1.5 w-1.5 rounded-full bg-gray-400"></div>
            <p className="text-lg font-light text-gray-600">
              Created {formattedDate}
            </p>
          </div>
        </div>

        {/* Decorative element */}
        <div className="mb-12 flex items-center gap-4">
          <div className="h-px w-16 bg-gray-300"></div>
          <div className="flex gap-2">
            <div className="h-2 w-2 rounded-full bg-blue-400"></div>
            <div className="h-2 w-2 rounded-full bg-purple-400"></div>
            <div className="h-2 w-2 rounded-full bg-pink-400"></div>
          </div>
          <div className="h-px w-16 bg-gray-300"></div>
        </div>

        {/* Footer text */}
        <div className="mt-auto">
          <p className="font-serif text-sm italic text-gray-500">
            A curated collection of memories
          </p>
          <p className="mt-2 text-xs text-gray-400">
            © {currentYear} Find My Photo
          </p>
        </div>

        {/* Decorative bottom border */}
        <div className="mt-12 w-32 border-t-4 border-gray-800"></div>
      </div>
    </div>
  )
}

// Single Photo Per Page Layout Component
function SinglePhotoPerPageLayout({ photos, albumTitle }: { photos: Photo[]; albumTitle: string }) {
  return (
    <>
      {photos.map((photo, index) => (
        <div key={photo.id} className="print-page page-break">
          <div className="flex h-full flex-col items-center justify-center p-8">
            <img
              src={photo.file_url}
              alt={photo.name}
              className="max-h-[90vh] w-auto object-contain"
            />
            <div className="mt-6 flex w-full items-center justify-between border-t border-gray-200 pt-3">
              <p className="text-xs text-gray-400">{albumTitle}</p>
              <p className="text-xs text-gray-400">
                Photo {index + 1} of {photos.length}
              </p>
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
        <div key={pageIndex} className="print-page page-break">
          {/* Simple Page Header */}
          <div className="mb-6 flex items-center justify-between border-b border-gray-200 pb-3">
            <p className="text-xs text-gray-500">{albumTitle}</p>
            <p className="text-xs text-gray-500">
              Page {pageIndex + 1} of {pages.length}
            </p>
          </div>

          {/* Photo Grid */}
          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns: `repeat(${columns}, 1fr)`,
              gridTemplateRows: `repeat(${columns}, 1fr)`,
            }}
          >
            {pagePhotos.map((photo) => (
              <div key={photo.id} className="relative overflow-hidden rounded-lg border-2 border-gray-200">
                <div className="aspect-square">
                  <img
                    src={photo.file_url}
                    alt={photo.name}
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Page Footer */}
          <div className="mt-6 text-center text-xs text-gray-400">
            Printed on {new Date().toLocaleDateString()}
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

  // Split photos into pages
  for (let i = 0; i < photos.length; i += photosPerPage) {
    pages.push(photos.slice(i, i + photosPerPage))
  }

  return (
    <>
      {pages.map((pagePhotos, pageIndex) => (
        <div key={pageIndex} className="print-page page-break">
          {/* Simple Page Header */}
          <div className="mb-6 flex items-center justify-between border-b border-gray-200 pb-3">
            <p className="text-xs text-gray-500">{albumTitle}</p>
            <p className="text-xs text-gray-500">
              Page {pageIndex + 1} of {pages.length}
            </p>
          </div>

          {/* Collage Grid - asymmetric layout */}
          <div className="grid grid-cols-3 grid-rows-3 gap-4" style={{ height: "85vh" }}>
            {pagePhotos.map((photo, index) => {
              // Create varied sizes for visual interest
              const sizeClasses = [
                "col-span-2 row-span-2", // Large
                "col-span-1 row-span-1", // Small
                "col-span-1 row-span-2", // Tall
                "col-span-2 row-span-1", // Wide
                "col-span-1 row-span-1", // Small
                "col-span-1 row-span-1", // Small
              ]

              return (
                <div
                  key={photo.id}
                  className={`relative overflow-hidden rounded-lg border-2 border-gray-200 ${sizeClasses[index] || "col-span-1 row-span-1"}`}
                >
                  <img
                    src={photo.file_url}
                    alt={photo.name}
                    className="h-full w-full object-cover"
                  />
                </div>
              )
            })}
          </div>

          {/* Page Footer */}
          <div className="mt-6 text-center text-xs text-gray-400">
            Printed on {new Date().toLocaleDateString()}
          </div>
        </div>
      ))}
    </>
  )
}

export default function PrintPreview({ photos, albumTitle, albumId, layoutTemplate, createdAt }: PrintPreviewProps) {
  // State for selected template - initialize with the suggested template
  const [selectedTemplate, setSelectedTemplate] = useState(layoutTemplate)

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print()
    }
  }

  return (
    <>
      {/* Print-specific styles */}
      <style jsx global>{`
        @media print {
          body {
            margin: 0;
            padding: 0;
          }

          .no-print {
            display: none !important;
          }

          .print-page {
            page-break-after: always;
            page-break-inside: avoid;
            min-height: 100vh;
            padding: 1in;
          }

          .print-page:last-child {
            page-break-after: auto;
          }

          @page {
            size: letter portrait;
            margin: 0.5in;
          }
        }

        @media screen {
          .print-page {
            min-height: 100vh;
            padding: 2rem;
            background: white;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            margin-bottom: 2rem;
          }

          .page-break {
            border-bottom: 2px dashed #ccc;
          }
        }
      `}</style>

      {/* Screen-only header with navigation and print button */}
      <div className="no-print sticky top-0 z-50 border-b border-gray-200 bg-white shadow-sm">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <Link href={`/albums/${albumId}`}>
            <Button variant="ghost">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Album
            </Button>
          </Link>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-600">
              {photos.length} photos
            </div>
            <Button onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              Print Album
            </Button>
          </div>
        </div>
      </div>

      {/* Template Selector - Screen only */}
      <div className="no-print bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 py-8">
        <div className="container mx-auto px-4">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Choose a Print Layout</h2>
            <p className="text-sm text-gray-600">Select a template to preview how your album will look when printed</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {TEMPLATE_OPTIONS.map((template) => {
              const Icon = template.icon
              const isSelected = selectedTemplate === template.id

              return (
                <Card
                  key={template.id}
                  className={`cursor-pointer transition-all hover:shadow-lg ${
                    isSelected
                      ? "border-2 border-blue-500 bg-blue-50 shadow-md"
                      : "border border-gray-200 bg-white hover:border-blue-300"
                  }`}
                  onClick={() => setSelectedTemplate(template.id)}
                >
                  <div className="p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <Icon className={`h-8 w-8 ${isSelected ? "text-blue-600" : "text-gray-600"}`} />
                      {isSelected && (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500">
                          <svg
                            className="h-4 w-4 text-white"
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
                    <h3 className={`mb-2 font-semibold ${isSelected ? "text-blue-900" : "text-gray-800"}`}>
                      {template.name}
                    </h3>
                    <p className={`text-xs ${isSelected ? "text-blue-700" : "text-gray-600"}`}>
                      {template.description}
                    </p>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      </div>

      {/* Print Preview Content */}
      <div className="bg-gray-100 py-8 print:bg-white print:p-0">
        <div className="container mx-auto px-4 print:p-0">
          {/* Preview Label - Screen only */}
          <div className="no-print mb-6 text-center">
            <h3 className="text-xl font-bold text-gray-800">Preview</h3>
            <p className="text-sm text-gray-600">
              This is how your album will look when printed. Scroll down to see all pages.
            </p>
          </div>

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
    </>
  )
}
