import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FavoriteButton } from "@/components/favorite-button"
import {
  Sparkles,
  ArrowLeft,
  ImageIcon,
  Calendar,
  Download,
  Share2,
  Edit,
  Trash2,
  Heart,
  Printer
} from "lucide-react"

interface AlbumPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function AlbumPage({ params }: AlbumPageProps) {
  // Await params before using its properties (Next.js 15 requirement)
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect("/sign-in")
  }

  // Fetch the album
  const { data: album, error: albumError } = await supabase
    .from("albums")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single()

  if (albumError || !album) {
    redirect("/dashboard")
  }

  // Resolve all photo IDs to actual photo data
  let albumPhotos: Array<{
    id: number
    name: string
    file_url: string
    caption: string | null
    position: number
    created_at: string
  }> = []

  if (album.photos && Array.isArray(album.photos) && album.photos.length > 0) {
    // Convert photo ID strings to integers
    const photoIds = album.photos.map((id: string) => parseInt(id))

    // Fetch all photos for this album
    const { data: photos } = await supabase
      .from("photos")
      .select("id, name, file_url, caption, position, created_at")
      .in("id", photoIds)
      .order("position", { ascending: true })

    albumPhotos = photos || []
  }

  // Resolve cover image URL
  let coverImageUrl = "/placeholder.svg"
  if (album.cover_image_url) {
    const { data: coverPhoto } = await supabase
      .from("photos")
      .select("file_url")
      .eq("id", parseInt(album.cover_image_url))
      .single()

    coverImageUrl = coverPhoto?.file_url || "/placeholder.svg"
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Header */}
      <header className="border-b border-white/20 bg-white/40 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-semibold text-foreground">Find My Photo</span>
          </Link>
          <Link href="/dashboard">
            <Button variant="ghost">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Album Header */}
        <div className="mb-8">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h1 className="mb-2 text-4xl font-bold text-foreground">{album.album_title || "Untitled Album"}</h1>
              {album.description && (
                <p className="text-lg text-muted-foreground">{album.description}</p>
              )}
              <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <ImageIcon className="h-4 w-4" />
                  {albumPhotos.length} {albumPhotos.length === 1 ? "photo" : "photos"}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Created {new Date(album.created_at).toLocaleDateString()}
                </span>
                <Badge variant={album.status === "active" ? "default" : "secondary"}>
                  {album.status}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <FavoriteButton
                itemId={album.id}
                itemType="album"
                initialIsFavorite={album.is_favorite || false}
                variant="outline"
                size="sm"
                showLabel={true}
              />
              <Button variant="outline" size="sm">
                <Share2 className="mr-2 h-4 w-4" />
                Share
              </Button>
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
              <Link href={`/albums/${id}/print`}>
                <Button variant="outline" size="sm">
                  <Printer className="mr-2 h-4 w-4" />
                  Preview for Print
                </Button>
              </Link>
              <Button variant="outline" size="sm">
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
              <Button variant="outline" size="sm" className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </div>
          </div>

          {/* Cover Image */}
          {coverImageUrl !== "/placeholder.svg" && (
            <Card className="overflow-hidden border-white/20 bg-white/60 backdrop-blur-sm">
              <div className="relative aspect-[21/9] overflow-hidden">
                <img
                  src={coverImageUrl}
                  alt={album.album_title || "Album cover"}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                <div className="absolute bottom-6 left-6">
                  <Badge className="bg-white/90 text-foreground">Cover Photo</Badge>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Photos Grid */}
        <div>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-foreground">Album Photos</h2>
            <p className="text-sm text-muted-foreground">
              {albumPhotos.length === 0
                ? "No photos in this album yet"
                : `Viewing all ${albumPhotos.length} photos`}
            </p>
          </div>

          {albumPhotos.length === 0 ? (
            <Card className="border-white/20 bg-white/60 backdrop-blur-sm">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="mb-2 text-xl font-semibold text-foreground">No photos yet</h3>
                <p className="mb-6 text-muted-foreground">This album doesn't have any photos</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {albumPhotos.map((photo) => (
                <Card
                  key={photo.id}
                  className="group overflow-hidden border-white/20 bg-white/60 backdrop-blur-sm transition-all hover:shadow-lg"
                >
                  <div className="relative aspect-square overflow-hidden">
                    <img
                      src={photo.file_url}
                      alt={photo.caption || photo.name}
                      className="h-full w-full object-cover transition-transform group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

                    {/* Photo Info Overlay */}
                    <div className="absolute bottom-0 left-0 right-0 translate-y-full p-3 transition-transform group-hover:translate-y-0">
                      {photo.caption && (
                        <p className="mb-2 line-clamp-2 text-sm text-white">{photo.caption}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-white/80">{photo.name}</span>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-white hover:bg-white/20">
                          <Heart className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Position Badge */}
                    <div className="absolute right-2 top-2">
                      <Badge className="bg-black/60 text-white">#{photo.position + 1}</Badge>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Album Info Card */}
        <Card className="mt-8 border-white/20 bg-white/60 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>Album Information</CardTitle>
            <CardDescription>Details about this album</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Album ID</dt>
                <dd className="mt-1 text-sm text-foreground">{album.id}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Status</dt>
                <dd className="mt-1">
                  <Badge variant={album.status === "active" ? "default" : "secondary"}>
                    {album.status}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Created</dt>
                <dd className="mt-1 text-sm text-foreground">
                  {new Date(album.created_at).toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Last Updated</dt>
                <dd className="mt-1 text-sm text-foreground">
                  {new Date(album.updated_at).toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Photo Count</dt>
                <dd className="mt-1 text-sm text-foreground">{albumPhotos.length}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Processing Status</dt>
                <dd className="mt-1">
                  <Badge variant={album.processing_status === "completed" ? "default" : "secondary"}>
                    {album.processing_status}
                  </Badge>
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
