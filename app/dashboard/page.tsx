import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sparkles, Plus, ImageIcon, Clock, Heart, Settings, FolderOpen, Upload, Eye } from "lucide-react"
import { PhotoGallery } from "@/components/photo-gallery"
import { LogoutButton } from "@/components/logout-button"
import { FaceProfilesSection } from "@/components/face-profiles-section"
import { QueueNotificationBanner } from "@/components/queue-notification-banner"
import { FavoriteButton } from "@/components/favorite-button"
import { AlbumCard } from "@/components/album-card"
import { AlbumsCarousel } from "@/components/albums-carousel"
import { PhotosCarousel } from "@/components/photos-carousel"
import { LoadingLink } from "@/components/loading-link"

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect("/sign-in")
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

  // Check for pending photos in processing queue
  const { count: pendingQueueCount } = await supabase
    .from("photo_processing_queue")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "pending")

  const { count: processingQueueCount } = await supabase
    .from("photo_processing_queue")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "processing")

  // Fetch albums with resolved cover images
  const { data: rawAlbums } = await supabase
    .from("albums")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(6)

  // Resolve photo IDs to actual URLs for each album
  const albums = await Promise.all(
    (rawAlbums || []).map(async (album) => {
      // Get cover image URL by resolving the photo ID
      let coverImageUrl = "/placeholder.svg"
      if (album.cover_image_url) {
        try {
          const photoId = parseInt(album.cover_image_url)
          if (!isNaN(photoId)) {
            const { data: coverPhoto, error: photoError } = await supabase
              .from("photos")
              .select("file_url")
              .eq("id", photoId)
              .single()

            if (photoError) {
              console.error(`Failed to fetch cover photo for album ${album.id}:`, photoError)
            } else if (coverPhoto?.file_url) {
              coverImageUrl = coverPhoto.file_url
            } else {
              console.warn(`No file_url found for photo ID ${photoId} (album ${album.id})`)
            }
          }
        } catch (error) {
          console.error(`Error resolving cover image for album ${album.id}:`, error)
        }
      }

      // Calculate actual photo count from photos array
      const actualPhotoCount = album.photos ? album.photos.length : 0

      return {
        ...album,
        cover_image_url: coverImageUrl,
        photo_count: actualPhotoCount,
      }
    })
  )

  // Fetch all photos from the photos table
  const { data: photos, error: photosError } = await supabase
    .from("photos")
    .select("id, name, file_url, type, size, caption, created_at, data, is_favorite")
    .order("created_at", { ascending: false })

  // Get photo count for stats
  const { count: photoCount } = await supabase
    .from("photos")
    .select("*", { count: "exact", head: true })

  // Get favorite counts
  const { count: favoriteCount } = await supabase
    .from("photos")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_favorite", true)

  const { count: favoriteAlbumCount } = await supabase
    .from("albums")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_favorite", true)

  const totalFavorites = (favoriteCount || 0) + (favoriteAlbumCount || 0)

  const stats = [
    { label: "Total Albums", value: String(albums?.length || 0), icon: FolderOpen },
    { label: "Total Photos", value: String(photoCount || 0), icon: ImageIcon },
    { label: "Favorites", value: String(totalFavorites), icon: Heart },
  ]

  // Check if face detection is enabled
  const isFaceDetectionEnabled = process.env.ENABLE_FACE_DETECTION === "true"

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Header */}
      <header className="border-b border-white/20 bg-white/40 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-semibold text-foreground">Find My Photo</span>
          </Link>

          <div className="flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar>
                    <AvatarImage src={profile?.avatar_url || "/user-profile-avatar.png"} alt="User" />
                    <AvatarFallback>
                      {profile?.display_name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{profile?.display_name || "User"}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <Link href="/settings">
                  <DropdownMenuItem>
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                </Link>
                <DropdownMenuSeparator />
                <LogoutButton />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold text-foreground">Welcome back, {profile?.display_name || "there"}</h1>
          <p className="text-muted-foreground">Here's what's happening with your photo albums</p>
        </div>

        {/* Queue Notification Banner */}
        <QueueNotificationBanner
          pendingCount={pendingQueueCount || 0}
          processingCount={processingQueueCount || 0}
        />

        {/* Stats Cards */}
        <div className="mb-8 grid gap-4 md:grid-cols-3">
          {stats.map((stat) => (
            <Card key={stat.label} className="border-white/20 bg-white/60 backdrop-blur-sm">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600">
                  <stat.icon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Face Profiles Section - Only show if face detection is enabled */}
        {isFaceDetectionEnabled && (
          <div className="mb-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-foreground">Face Recognition</h2>
              <p className="text-sm text-muted-foreground">People detected in your photos</p>
            </div>
            <FaceProfilesSection />
          </div>
        )}

        {/* Quick Actions */}
        <div className="mb-8 grid gap-4 md:grid-cols-2">
          <Card className="border-white/20 bg-gradient-to-r from-blue-500 to-purple-600 text-white">
            <CardContent className="flex flex-col justify-between p-6">
              <div className="mb-4">
                <h3 className="mb-1 text-xl font-semibold">Upload Photos</h3>
                <p className="text-white/90">Add photos to your collection for AI-powered organization</p>
              </div>
              <Link href="/upload-photos">
                <Button size="lg" className="w-full bg-white text-purple-600 hover:bg-white/90">
                  <Upload className="mr-2 h-5 w-5" />
                  Upload Now
                </Button>
              </Link>
            </CardContent>
          </Card>
          <Card className="border-white/20 bg-gradient-to-r from-purple-500 to-pink-600 text-white">
            <CardContent className="flex flex-col justify-between p-6">
              <div className="mb-4">
                <h3 className="mb-1 text-xl font-semibold">Create Album</h3>
                <p className="text-white/90">Let AI help you discover the perfect photos from your collection</p>
              </div>
              <Link href="/create-album">
                <Button size="lg" className="w-full bg-white text-pink-600 hover:bg-white/90">
                  <Sparkles className="mr-2 h-5 w-5" />
                  Create Album
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Albums Section */}
        <div>
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Your Albums</h2>
              <p className="text-sm text-muted-foreground">Browse and manage your photo albums</p>
            </div>
            <LoadingLink
              href="/albums"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-white/60 px-4 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              loadingMessage="Loading albums..."
            >
              <Eye className="h-4 w-4" />
              See All
            </LoadingLink>
          </div>

          <AlbumsCarousel albums={albums || []} />
        </div>

        {/* Photos Section */}
        <div className="mt-12">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Your Photos</h2>
              <p className="text-sm text-muted-foreground">
                All photos in your collection {photoCount ? `(${photoCount} total)` : ""}
              </p>
            </div>
            <LoadingLink
              href="/photos"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-white/60 px-4 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              loadingMessage="Loading photos..."
            >
              <Eye className="h-4 w-4" />
              See All
            </LoadingLink>
          </div>

          {photosError && (
            <Card className="border-white/20 bg-white/60 backdrop-blur-sm">
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <p className="text-sm text-destructive">Error loading photos. Please try again later.</p>
              </CardContent>
            </Card>
          )}

          {!photosError && <PhotosCarousel photos={photos || []} />}
        </div>
      </main>
    </div>
  )
}
