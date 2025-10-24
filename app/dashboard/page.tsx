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
import { Sparkles, Plus, ImageIcon, Clock, Heart, Settings, User, FolderOpen, Upload } from "lucide-react"
import { PhotoGallery } from "@/components/photo-gallery"
import { LogoutButton } from "@/components/logout-button"

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
        const { data: coverPhoto } = await supabase
          .from("photos")
          .select("file_url")
          .eq("id", parseInt(album.cover_image_url))
          .single()

        coverImageUrl = coverPhoto?.file_url || "/placeholder.svg"
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
    .select("id, name, file_url, type, size, caption, created_at, data")
    .order("created_at", { ascending: false })

  // Get photo count for stats
  const { count: photoCount } = await supabase
    .from("photos")
    .select("*", { count: "exact", head: true })

  const stats = [
    { label: "Total Albums", value: String(albums?.length || 0), icon: FolderOpen },
    { label: "Total Photos", value: String(photoCount || 0), icon: ImageIcon },
    { label: "Favorites", value: "0", icon: Heart },
  ]

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
            <Link href="/upload-photos">
              <Button variant="outline" className="bg-white/60">
                <Upload className="mr-2 h-4 w-4" />
                Upload Photos
              </Button>
            </Link>
            <Link href="/create-album">
              <Button className="bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700">
                <Plus className="mr-2 h-4 w-4" />
                Create Album
              </Button>
            </Link>

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
                <DropdownMenuItem>
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
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
            <Button variant="outline" className="bg-white/60">
              View All
            </Button>
          </div>

          {albums && albums.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {albums.map((album) => (
                <Card
                  key={album.id}
                  className="group overflow-hidden border-white/20 bg-white/60 backdrop-blur-sm transition-all hover:shadow-lg"
                >
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <img
                      src={album.cover_image_url || "/placeholder.svg"}
                      alt={album.album_title}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                    <div className="absolute bottom-4 left-4 right-4 translate-y-4 opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100">
                      <Link href={`/albums/${album.id}`}>
                        <Button size="sm" className="w-full bg-white text-foreground hover:bg-white/90">
                          View Album
                        </Button>
                      </Link>
                    </div>
                  </div>
                  <CardHeader>
                    <CardTitle className="text-lg">{album.album_title}</CardTitle>
                    <CardDescription className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1">
                        <ImageIcon className="h-4 w-4" />
                        {album.photo_count} photos
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {new Date(album.created_at).toLocaleDateString()}
                      </span>
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          ) : (
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
          )}
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
            <Link href="/upload-photos">
              <Button variant="outline" className="bg-white/60">
                <Upload className="mr-2 h-4 w-4" />
                Upload More
              </Button>
            </Link>
          </div>

          {photosError && (
            <Card className="border-white/20 bg-white/60 backdrop-blur-sm">
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <p className="text-sm text-destructive">Error loading photos. Please try again later.</p>
              </CardContent>
            </Card>
          )}

          {!photosError && <PhotoGallery photos={photos || []} />}
        </div>
      </main>
    </div>
  )
}
