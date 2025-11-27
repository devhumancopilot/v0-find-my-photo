/**
 * API Route: Generate WYSIWYG PDF for Album
 * POST /api/album/[albumId]/generate-pdf
 *
 * Generates a PDF by rendering the actual print preview page,
 * ensuring "what you see is what you get" output
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { generateAlbumPDFFromPreview } from '@/lib/pdf/generator'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ albumId: string }> }
) {
  try {
    // Await params before using its properties (Next.js 15 requirement)
    const { albumId } = await params

    // Verify authentication - support both cookie-based (proxy) and token-based (direct) auth
    const authHeader = request.headers.get('authorization')
    const supabase = await createClient()

    let user
    let authError

    if (authHeader?.startsWith('Bearer ')) {
      // Direct request with Authorization header (cross-origin)
      const token = authHeader.substring(7)
      const { data, error } = await supabase.auth.getUser(token)
      user = data.user
      authError = error
      console.log('[PDF Generator] Using token-based auth')
    } else {
      // Proxy request with cookies (same-origin)
      const { data, error } = await supabase.auth.getUser()
      user = data.user
      authError = error
      console.log('[PDF Generator] Using cookie-based auth')
    }

    if (authError || !user) {
      console.error('[PDF Generator] Auth error:', authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { layoutTemplate } = body

    if (!layoutTemplate) {
      return NextResponse.json(
        { error: 'Missing required field: layoutTemplate' },
        { status: 400 }
      )
    }

    console.log(`[PDF Generator] Generating WYSIWYG PDF for album ${albumId}`)

    // Get album using service role client (bypasses RLS for reliable querying)
    const serviceSupabase = createServiceRoleClient()
    const { data: album, error: albumError } = await serviceSupabase
      .from('albums')
      .select('id, album_title, user_id')
      .eq('id', albumId)
      .single()

    if (albumError || !album) {
      console.error('[PDF Generator] Album not found:', albumError)
      return NextResponse.json(
        { error: 'Album not found' },
        { status: 404 }
      )
    }

    // Verify ownership manually
    if (album.user_id !== user.id) {
      console.error('[PDF Generator] Access denied: album belongs to different user')
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Use frontend URL for puppeteer navigation since the print preview page lives on the frontend
    // Use FRONTEND_URL env var, fallback to production frontend URL
    const baseUrl = process.env.FRONTEND_URL || 'https://v0-find-my-photo-v2.onrender.com'

    console.log(`[PDF Generator] Using base URL: ${baseUrl}`)

    // Extract cookies from the request to pass to Puppeteer for authentication
    const cookieHeader = request.headers.get('cookie')
    const cookies: Array<{ name: string; value: string; domain: string; path: string }> = []

    if (cookieHeader) {
      // Parse cookies and prepare them for Puppeteer
      const cookiePairs = cookieHeader.split(';').map(c => c.trim())
      const domain = new URL(baseUrl).hostname

      cookiePairs.forEach(pair => {
        const [name, ...valueParts] = pair.split('=')
        if (name && valueParts.length > 0) {
          const value = valueParts.join('=') // Handle values with = in them
          cookies.push({
            name: name.trim(),
            value: value.trim(),
            domain,
            path: '/'
          })
        }
      })

      console.log(`[PDF Generator] Extracted ${cookies.length} cookies for authentication`)
    }

    // Generate PDF from the actual print preview page
    const pdfBuffer = await generateAlbumPDFFromPreview(
      albumId,
      layoutTemplate,
      baseUrl,
      cookies
    )

    console.log(`[PDF Generator] PDF generated successfully, size: ${pdfBuffer.length} bytes`)

    // Return the PDF as a downloadable file
    const albumTitle = album.album_title || 'Untitled Album'
    const fileName = `${albumTitle.replace(/[^a-z0-9]/gi, '_')}_${layoutTemplate}.pdf`

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    })
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
