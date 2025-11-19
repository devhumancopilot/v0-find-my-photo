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
import { Sparkles, Settings, Upload, ArrowLeft, ImageIcon } from "lucide-react"
import { LogoutButton } from "@/components/logout-button"
import { PhotoGallery } from "@/components/photo-gallery"

export default async function PhotosPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect("/sign-in")
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

  // Fetch all photos from the photos table
  const { data: photos, error: photosError } = await supabase
    .from("photos")
    .select("id, name, file_url, type, size, caption, created_at, data, is_favorite")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  // Get photo count
  const photoCount = photos?.length || 0

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
              <h1 className="text-3xl font-bold text-foreground">All Photos</h1>
              <p className="text-muted-foreground">
                {photoCount > 0 ? `${photoCount} photo${photoCount === 1 ? '' : 's'}` : 'No photos yet'}
              </p>
            </div>
          </div>
          <Link href="/upload-photos">
            <Button className="bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700">
              <Upload className="mr-2 h-4 w-4" />
              Upload Photos
            </Button>
          </Link>
        </div>

        {/* Photos Display */}
        {photosError && (
          <Card className="border-white/20 bg-white/60 backdrop-blur-sm">
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-sm text-destructive">Error loading photos. Please try again later.</p>
            </CardContent>
          </Card>
        )}

        {!photosError && photoCount > 0 && (
          <div className="rounded-lg border border-white/20 bg-white/60 p-6 backdrop-blur-sm">
            <PhotoGallery photos={photos || []} />
          </div>
        )}

        {!photosError && photoCount === 0 && (
          <Card className="border-white/20 bg-white/60 backdrop-blur-sm">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-purple-100">
                <ImageIcon className="h-10 w-10 text-blue-600" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-foreground">No photos yet</h3>
              <p className="mb-6 max-w-md text-sm text-muted-foreground">
                Upload your first photos to start organizing them with AI-powered search
              </p>
              <Link href="/upload-photos">
                <Button className="bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700">
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Your First Photos
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
