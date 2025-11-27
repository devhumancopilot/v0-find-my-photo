/**
 * API Route: Generate WYSIWYG PDF for Album
 * POST /api/album/[albumId]/generate-pdf
 *
 * Generates a PDF by rendering the actual print preview page,
 * ensuring "what you see is what you get" output
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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

    // Verify album ownership
    const { data: album, error: albumError } = await supabase
      .from('albums')
      .select('id, album_title, user_id')
      .eq('id', albumId)
      .eq('user_id', user.id)
      .single()

    if (albumError || !album) {
      return NextResponse.json(
        { error: 'Album not found or access denied' },
        { status: 404 }
      )
    }

    // Get the base URL from the request, checking forwarded headers for production (Render)
    // Render and other hosts use X-Forwarded-Proto and X-Forwarded-Host for the original request
    const forwardedProto = request.headers.get('x-forwarded-proto')
    const forwardedHost = request.headers.get('x-forwarded-host')

    let protocol = forwardedProto || request.nextUrl.protocol
    let host = forwardedHost || request.nextUrl.host

    // If we're still getting localhost in production, use the known Render URL as fallback
    if (host.includes('localhost') && process.env.NODE_ENV === 'production') {
      protocol = 'https'
      host = 'v0-find-my-photo-v2.onrender.com'  // Frontend URL
      console.log(`[PDF Generator] Detected localhost in production, using fallback URL`)
    }

    // Remove trailing colon from protocol if present
    const cleanProtocol = protocol.replace(/:$/, '')
    const baseUrl = `${cleanProtocol}://${host}`

    console.log(`[PDF Generator] Using base URL: ${baseUrl}`)
    console.log(`[PDF Generator] Forwarded headers: proto=${forwardedProto}, host=${forwardedHost}`)

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
