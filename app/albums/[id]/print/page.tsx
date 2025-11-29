import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import PrintPreview from "./print-preview"

interface PrintPageProps {
  params: Promise<{
    id: string
  }>
  searchParams: Promise<{
    layout?: string
    pdf?: string
    token?: string // Bearer token for Puppeteer auth
  }>
}

// Layout template selection logic based on photo count
function selectLayoutTemplate(photoCount: number): string {
  if (photoCount <= 3) return "single-per-page"
  if (photoCount <= 8) return "grid-2x2"
  if (photoCount <= 16) return "grid-3x3"
  return "grid-4x4"
}

interface Photo {
  id: number
  name: string
  file_url: string
  caption: string | null
  position: number
  created_at: string
}

export default async function PrintPage({ params, searchParams }: PrintPageProps) {
  // Await params before using its properties (Next.js 15 requirement)
  const { id } = await params
  const { layout, pdf, token } = await searchParams

  // Support both cookie-based auth (normal users) and token-based auth (Puppeteer)
  let supabase
  if (token) {
    // Puppeteer accessing with Bearer token
    console.log('[Print Page] Using Bearer token authentication for Puppeteer')
    supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    )
  } else {
    // Normal user accessing with cookies
    supabase = await createClient()
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    console.error('[Print Page] Auth error:', authError)
    redirect("/sign-in")
  }

  // Fetch the album (same logic as main album page)
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
  let albumPhotos: Photo[] = []

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

  // Use layout from query param if provided, otherwise select based on photo count
  const layoutTemplate = layout || selectLayoutTemplate(albumPhotos.length)
  const albumTitle = album.album_title || "Untitled Album"
  const isPDFMode = pdf === 'true'

  return (
    <PrintPreview
      photos={albumPhotos}
      albumTitle={albumTitle}
      albumId={id}
      layoutTemplate={layoutTemplate}
      createdAt={album.created_at}
      isPDFMode={isPDFMode}
    />
  )
}
