/**
 * API Route: Generate PDF for Album
 * POST /api/gelato/generate-pdf
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateAlbumPDF } from '@/lib/pdf/generator'
import { uploadPDFToStorage, generatePDFFileName } from '@/lib/storage/upload'

interface Photo {
  id: number
  name: string
  file_url: string
  caption: string | null
  position: number
  created_at: string
}

export async function POST(request: Request) {
  try {
    // Verify authentication
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { albumId, layoutTemplate } = body

    if (!albumId || !layoutTemplate) {
      return NextResponse.json(
        { error: 'Missing required fields: albumId, layoutTemplate' },
        { status: 400 }
      )
    }

    console.log(`[PDF Generator] Generating PDF for album ${albumId}`)

    // Fetch album data
    const { data: album, error: albumError } = await supabase
      .from('albums')
      .select('*')
      .eq('id', albumId)
      .eq('user_id', user.id)
      .single()

    if (albumError || !album) {
      return NextResponse.json(
        { error: 'Album not found or access denied' },
        { status: 404 }
      )
    }

    // Fetch album photos
    let albumPhotos: Photo[] = []

    if (album.photos && Array.isArray(album.photos) && album.photos.length > 0) {
      const photoIds = album.photos.map((id: string) => parseInt(id))

      const { data: photos, error: photosError } = await supabase
        .from('photos')
        .select('id, name, file_url, caption, position, created_at')
        .in('id', photoIds)
        .order('position', { ascending: true })

      if (photosError) {
        console.error('[PDF Generator] Error fetching photos:', photosError)
        return NextResponse.json(
          { error: 'Failed to fetch album photos' },
          { status: 500 }
        )
      }

      albumPhotos = photos || []
    }

    if (albumPhotos.length === 0) {
      return NextResponse.json(
        { error: 'Album has no photos' },
        { status: 400 }
      )
    }

    console.log(`[PDF Generator] Found ${albumPhotos.length} photos`)

    // Generate PDF
    console.log('[PDF Generator] Generating PDF with Puppeteer...')
    const pdfBuffer = await generateAlbumPDF({
      albumTitle: album.album_title || 'Untitled Album',
      photos: albumPhotos,
      layoutTemplate,
      createdAt: album.created_at,
    })

    console.log(`[PDF Generator] PDF generated, size: ${pdfBuffer.length} bytes`)

    // Check if client wants direct download or storage upload
    const returnType = body.returnType || 'download' // 'download' or 'upload'

    if (returnType === 'download') {
      // Return PDF directly for download
      const albumTitle = album.album_title || 'Untitled Album'
      const fileName = `${albumTitle.replace(/[^a-z0-9]/gi, '_')}_${layoutTemplate}.pdf`

      console.log(`[PDF Generator] Returning PDF for direct download`)

      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${fileName}"`,
          'Content-Length': pdfBuffer.length.toString(),
        },
      })
    } else {
      // Upload to Supabase Storage (for Gelato integration)
      const fileName = generatePDFFileName(albumId)
      console.log(`[PDF Generator] Uploading to storage: ${fileName}`)

      const { publicUrl, error: uploadError } = await uploadPDFToStorage(
        pdfBuffer,
        fileName
      )

      if (uploadError || !publicUrl) {
        console.error('[PDF Generator] Upload error:', uploadError)
        return NextResponse.json(
          { error: `Failed to upload PDF: ${uploadError}` },
          { status: 500 }
        )
      }

      console.log(`[PDF Generator] PDF uploaded successfully: ${publicUrl}`)

      return NextResponse.json({
        success: true,
        fileUrl: publicUrl,
        fileName,
        fileSize: pdfBuffer.length,
        photoCount: albumPhotos.length,
      })
    }
  } catch (error) {
    console.error('[PDF Generator] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate PDF',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
