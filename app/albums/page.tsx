import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sparkles, Plus, Settings, ArrowLeft, FolderOpen } from "lucide-react"
import { LogoutButton } from "@/components/logout-button"
import { AlbumCard } from "@/components/album-card"

export default async function AlbumsPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect("/sign-in")
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

  // Fetch all albums with resolved cover images
  const { data: rawAlbums } = await supabase
    .from("albums")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

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
        {/* Page Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="outline" size="icon" className="bg-white/60">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-foreground">All Albums</h1>
              <p className="text-muted-foreground">
                {albums.length > 0 ? `${albums.length} album${albums.length === 1 ? '' : 's'}` : 'No albums yet'}
              </p>
            </div>
          </div>
          <Link href="/create-album">
            <Button className="bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700">
              <Plus className="mr-2 h-4 w-4" />
              Create Album
            </Button>
          </Link>
        </div>

        {/* Albums Collage */}
        {albums.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 auto-rows-[200px] gap-4">
            {albums.map((album, index) => {
              // Create a dynamic pattern with medium minimum size (2×2 minimum)
              const pattern = index % 5
              const getGridClass = () => {
                switch (pattern) {
                  case 0: return 'col-span-3 row-span-3' // Extra large
                  case 1: return 'col-span-2 row-span-2' // Medium square
                  case 2: return 'col-span-2 row-span-3' // Large tall
                  case 3: return 'col-span-2 row-span-2' // Medium square
                  case 4: return 'col-span-3 row-span-2' // Large wide
                  default: return 'col-span-2 row-span-2'
                }
              }

              return (
                <div
                  key={album.id}
                  className={`${getGridClass()} overflow-hidden`}
                >
                  <AlbumCard album={album} />
                </div>
              )
            })}
          </div>
        ) : (
          <Card className="border-white/20 bg-white/60 backdrop-blur-sm">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-purple-100">
                <FolderOpen className="h-10 w-10 text-blue-600" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-foreground">No albums yet</h3>
              <p className="mb-6 max-w-md text-sm text-muted-foreground">
                Create your first album to organize your photos with AI-powered search
              </p>
              <Link href="/create-album">
                <Button className="bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Album
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
