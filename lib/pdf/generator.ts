/**
 * PDF Generation Service using Puppeteer
 * Generates print-ready PDFs from album layouts for Gelato printing
 * Uses the actual print preview page for true WYSIWYG output
 */

import puppeteer from 'puppeteer'
import puppeteerCore from 'puppeteer-core'
import chromium from '@sparticuz/chromium'
import { PDFDocument } from 'pdf-lib'

interface Photo {
  id: number
  name: string
  file_url: string
  caption: string | null
  position: number
  created_at: string
}

interface GeneratePDFOptions {
  albumTitle: string
  photos: Photo[]
  layoutTemplate: 'single-per-page' | 'grid-2x2' | 'grid-3x3' | 'grid-4x4' | 'collage'
  createdAt: string
}

/**
 * Generate HTML for the print layout
 */
function generatePrintHTML(options: GeneratePDFOptions): string {
  const { albumTitle, photos, layoutTemplate, createdAt } = options

  // Get template-specific styling
  const getLayoutStyles = () => {
    const baseStyles = `
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      @page {
        size: letter portrait;
        margin: 0.5in;
      }

      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        margin: 0;
        padding: 0;
        background: white;
      }

      .page {
        page-break-after: always;
        page-break-inside: avoid;
        min-height: 100vh;
        padding: 1in;
        position: relative;
      }

      .page:last-child {
        page-break-after: auto;
      }
    `

    return baseStyles
  }

  // Generate cover page HTML
  const generateCoverPage = () => {
    const currentYear = new Date().getFullYear()
    const formattedDate = new Date(createdAt).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })

    return `
      <div class="page cover-page" style="background: linear-gradient(to bottom right, #f9fafb, white, #f9fafb);">
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; position: relative;">
          <div style="position: relative; z-index: 10;">
            <!-- Decorative top ornament with gradients -->
            <div style="display: flex; align-items: center; justify-content: center; gap: 0.5rem; margin-bottom: 2.5rem;">
              <div style="height: 1px; width: 4rem; background: linear-gradient(to right, transparent, #9ca3af, transparent);"></div>
              <div style="display: flex; gap: 0.25rem;">
                <div style="height: 4px; width: 4px; border-radius: 50%; background: #3b82f6;"></div>
                <div style="height: 4px; width: 4px; border-radius: 50%; background: #8b5cf6;"></div>
                <div style="height: 4px; width: 4px; border-radius: 50%; background: #ec4899;"></div>
              </div>
              <div style="height: 1px; width: 4rem; background: linear-gradient(to right, transparent, #9ca3af, transparent);"></div>
            </div>

            <!-- Main Title -->
            <div style="margin-bottom: 2.5rem;">
              <h1 style="font-size: 3.75rem; font-weight: bold; letter-spacing: 0.025em; color: #111827; margin-bottom: 1.5rem; font-family: Georgia, serif; line-height: 1.2;">
                ${albumTitle}
              </h1>
              <div style="margin: 0 auto; height: 4px; width: 8rem; border-radius: 9999px; background: linear-gradient(to right, #3b82f6, #8b5cf6, #ec4899); box-shadow: 0 10px 15px -3px rgba(168, 85, 247, 0.2), 0 4px 6px -2px rgba(168, 85, 247, 0.05);"></div>
            </div>

            <!-- Album Details -->
            <div style="margin-bottom: 2.5rem; padding: 2rem 0;">
              <div style="display: flex; align-items: center; justify-content: center; gap: 0.75rem; margin-bottom: 1.5rem;">
                <div style="display: flex; align-items: center; justify-content: center; width: 2.5rem; height: 2.5rem; border-radius: 50%; background: linear-gradient(to bottom right, #dbeafe, #e9d5ff);">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9333ea" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <polyline points="21 15 16 10 5 21"></polyline>
                  </svg>
                </div>
                <p style="font-size: 1.5rem; font-weight: 300; letter-spacing: 0.025em; color: #374151;">
                  ${photos.length} ${photos.length === 1 ? 'Photograph' : 'Photographs'}
                </p>
              </div>

              <div style="display: flex; align-items: center; justify-content: center; gap: 0.5rem; margin-bottom: 1.5rem;">
                <div style="height: 1px; width: 6rem; background: linear-gradient(to right, transparent, #d1d5db, transparent);"></div>
              </div>

              <p style="font-size: 1.125rem; font-weight: 300; letter-spacing: 0.025em; color: #4b5563;">
                ${formattedDate}
              </p>
            </div>

            <!-- Decorative bottom ornament -->
            <div style="display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
              <div style="height: 1px; width: 4rem; background: linear-gradient(to right, transparent, #9ca3af, transparent);"></div>
              <div style="display: flex; gap: 0.25rem;">
                <div style="height: 4px; width: 4px; border-radius: 50%; background: #3b82f6;"></div>
                <div style="height: 4px; width: 4px; border-radius: 50%; background: #8b5cf6;"></div>
                <div style="height: 4px; width: 4px; border-radius: 50%; background: #ec4899;"></div>
              </div>
              <div style="height: 1px; width: 4rem; background: linear-gradient(to right, transparent, #9ca3af, transparent);"></div>
            </div>
          </div>

          <!-- Footer - Absolutely positioned at bottom -->
          <div style="position: absolute; bottom: 4rem; left: 0; right: 0; text-align: center;">
            <p style="font-family: Georgia, serif; font-size: 1rem; font-style: italic; color: #6b7280; letter-spacing: 0.025em; margin-bottom: 0.5rem;">
              A curated collection of memories
            </p>
            <p style="font-size: 0.75rem; color: #9ca3af; letter-spacing: 0.1em; text-transform: uppercase;">
              © ${currentYear} Find My Photo
            </p>
          </div>
        </div>
      </div>
    `
  }

  // Generate photo pages based on layout
  const generatePhotoPages = () => {
    if (layoutTemplate === 'single-per-page') {
      return photos
        .map(
          (photo, index) => {
            const photoDate = new Date(photo.created_at).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric'
            })

            return `
        <div class="page">
          <div style="display: flex; flex-direction: column; height: 100%;">
            <!-- Main content area with float layout -->
            <div style="flex: 1; position: relative;">
              <!-- Image floats left -->
              <div style="float: left; margin-right: 2rem; margin-bottom: 1.5rem;">
                <div style="position: relative;">
                  <img src="${photo.file_url}" alt="${photo.name}" style="height: 500px; width: 420px; object-fit: cover; object-position: center; border-radius: 0.5rem; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);" />
                  <!-- Decorative frame -->
                  <div style="position: absolute; top: -8px; left: -8px; right: -8px; bottom: -8px; border: 1px solid #d1d5db; border-radius: 0.5rem; z-index: -1; opacity: 0.4;"></div>
                </div>
              </div>

              <!-- Text content wraps around image -->
              <div style="text-align: right; padding-top: 12rem;">
                <!-- Photo title -->
                <h2 style="margin-bottom: 1rem; font-size: 1.5rem; font-family: Georgia, serif; font-weight: bold; color: #111827; letter-spacing: 0.025em;">
                  ${photo.name}
                </h2>

                <!-- Decorative divider -->
                <div style="margin-bottom: 1rem; display: flex; align-items: center; justify-content: flex-end; gap: 0.5rem;">
                  <div style="height: 1px; width: 3rem; background: linear-gradient(to left, #c084fc, transparent);"></div>
                  <div style="height: 4px; width: 4px; border-radius: 50%; background: #c084fc;"></div>
                </div>

                <!-- Caption text -->
                ${photo.caption ? `
                <div style="margin-bottom: 2rem; text-align: justify;">
                  <p style="font-family: Georgia, serif; font-size: 1rem; color: #374151; line-height: 1.625;">
                    "${photo.caption}"
                  </p>
                </div>
                ` : ''}
              </div>

              <!-- Clear float -->
              <div style="clear: both;"></div>
            </div>

            <!-- Two-layer footer -->
            <!-- Photo metadata footer -->
            <div style="margin-top: auto; padding-top: 0.75rem; border-top: 1px solid #d1d5db; flex-shrink: 0;">
              <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: #4b5563;">
                <span style="font-weight: 500;">Photograph ${index + 1} of ${photos.length}</span>
                <span style="color: #9ca3af;">•</span>
                <span style="font-style: italic;">${photoDate}</span>
              </div>
            </div>

            <!-- Album title footer -->
            <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid #e5e7eb; flex-shrink: 0;">
              <p style="font-size: 10px; color: #9ca3af; letter-spacing: 0.1em; text-transform: uppercase; font-weight: 500; text-align: center;">
                ${albumTitle}
              </p>
            </div>
          </div>
        </div>
      `
          }
        )
        .join('')
    }

    // Grid layouts
    const gridConfig: Record<string, number> = {
      'grid-2x2': 2,
      'grid-3x3': 3,
      'grid-4x4': 4,
    }

    const columns = gridConfig[layoutTemplate] || 2
    const photosPerPage = columns * columns
    const pages: Photo[][] = []

    for (let i = 0; i < photos.length; i += photosPerPage) {
      pages.push(photos.slice(i, i + photosPerPage))
    }

    return pages
      .map(
        (pagePhotos, pageIndex) => `
      <div class="page">
        <div style="display: flex; flex-direction: column; height: 100%;">
          <!-- Photo Grid -->
          <div style="display: grid; grid-template-columns: repeat(${columns}, 1fr); grid-template-rows: repeat(${columns}, 1fr); gap: 0.75rem; margin-bottom: 1rem; flex: 1 1 0; min-height: 0;">
            ${pagePhotos
              .map(
                (photo) => `
              <div style="position: relative; overflow: hidden; border-radius: 0.5rem; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);">
                <div style="aspect-ratio: 1; width: 100%; height: 100%;">
                  <img src="${photo.file_url}" alt="${photo.name}" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s;" />
                </div>
              </div>
            `
              )
              .join('')}
          </div>

          <!-- Two-layer footer -->
          <!-- Page info footer -->
          <div style="margin-top: auto; padding-top: 0.75rem; border-top: 1px solid #d1d5db; flex-shrink: 0;">
            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: #4b5563;">
              <span style="font-weight: 500;">Page ${pageIndex + 1} of ${pages.length}</span>
              <span style="font-style: italic; color: #9ca3af;">${new Date().toLocaleDateString()}</span>
            </div>
          </div>

          <!-- Album title footer -->
          <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid #e5e7eb; flex-shrink: 0;">
            <p style="font-size: 10px; color: #9ca3af; letter-spacing: 0.1em; text-transform: uppercase; font-weight: 500; text-align: center;">
              ${albumTitle}
            </p>
          </div>
        </div>
      </div>
    `
      )
      .join('')
  }

  // Combine everything
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${albumTitle} - Print</title>
      <style>
        ${getLayoutStyles()}
      </style>
    </head>
    <body>
      ${generateCoverPage()}
      ${generatePhotoPages()}
    </body>
    </html>
  `
}

/**
 * Generate PDF from album data
 */
export async function generateAlbumPDF(options: GeneratePDFOptions): Promise<Buffer> {
  let browser = null

  try {
    // Generate HTML
    const html = generatePrintHTML(options)

    // Launch Puppeteer
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    })

    const page = await browser.newPage()

    // Set viewport for consistent rendering
    await page.setViewport({
      width: 2550, // 8.5 inches at 300 DPI
      height: 3300, // 11 inches at 300 DPI
      deviceScaleFactor: 2, // High resolution
    })

    // Load HTML
    console.log('[PDF Generator] Setting page content...')
    await page.setContent(html, {
      waitUntil: ['networkidle0', 'load'],
      timeout: 60000, // 60 seconds timeout
    })

    console.log('[PDF Generator] Waiting for images to load...')

    // Get initial image count
    const imageCount = await page.evaluate(() => document.images.length)
    console.log(`[PDF Generator] Found ${imageCount} images in HTML`)

    // Wait for all images to load with detailed logging
    try {
      await page.waitForFunction(
        () => {
          const images = Array.from(document.images)
          if (images.length === 0) return true

          const results = images.map(img => ({
            src: img.src.substring(0, 100),
            complete: img.complete,
            naturalHeight: img.naturalHeight,
            naturalWidth: img.naturalWidth,
            loaded: img.complete && img.naturalHeight > 0
          }))

          console.log('Image loading status:', JSON.stringify(results, null, 2))

          const loadedImages = results.filter(r => r.loaded)
          console.log(`Images loaded: ${loadedImages.length}/${images.length}`)

          return loadedImages.length === images.length
        },
        {
          timeout: 60000,
          polling: 1000
        }
      )
      console.log('[PDF Generator] All images loaded successfully')
    } catch (error) {
      console.error('[PDF Generator] Timeout waiting for images, checking status...')

      // Log final image status
      const imageStatus = await page.evaluate(() => {
        return Array.from(document.images).map(img => ({
          src: img.src.substring(0, 100),
          complete: img.complete,
          naturalHeight: img.naturalHeight,
          naturalWidth: img.naturalWidth,
          error: !img.complete || img.naturalHeight === 0
        }))
      })

      console.error('[PDF Generator] Final image status:', JSON.stringify(imageStatus, null, 2))

      // Continue anyway - some images may have loaded
      console.log('[PDF Generator] Proceeding with PDF generation despite image loading issues')
    }

    // Give extra time for base64 images to fully render
    console.log('[PDF Generator] Waiting for images to fully render...')
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Log a test to check if images are actually in the DOM
    const imageDebug = await page.evaluate(() => {
      const images = Array.from(document.images)
      return {
        imageCount: images.length,
        firstImageSrc: images[0]?.src.substring(0, 100),
        firstImageDimensions: images[0] ? `${images[0].naturalWidth}x${images[0].naturalHeight}` : 'none',
        allImagesHaveDimensions: images.every(img => img.naturalWidth > 0 && img.naturalHeight > 0)
      }
    })
    console.log('[PDF Generator] Image debug info:', JSON.stringify(imageDebug, null, 2))

    // Take a screenshot to verify rendering (for debugging)
    try {
      const screenshot = await page.screenshot({ fullPage: true, type: 'png' })
      console.log(`[PDF Generator] Screenshot captured: ${screenshot.length} bytes`)
    } catch (err) {
      console.error('[PDF Generator] Failed to capture screenshot:', err)
    }

    // Generate PDF with high quality settings
    const pdf = await page.pdf({
      format: 'Letter',
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: '0.5in',
        right: '0.5in',
        bottom: '0.5in',
        left: '0.5in',
      },
      // High quality settings for Gelato
      scale: 1,
      displayHeaderFooter: false,
    })

    await browser.close()

    return Buffer.from(pdf)
  } catch (error) {
    if (browser) {
      await browser.close()
    }
    console.error('[PDF Generator] Error generating PDF:', error)
    throw error
  }
}

/**
 * Generate PDF from actual print preview page (WYSIWYG)
 * This function navigates to the print preview page and generates a PDF
 * ensuring the output matches exactly what the user sees
 */
export async function generateAlbumPDFFromPreview(
  albumId: string,
  layoutTemplate: string,
  baseUrl: string,
  cookies?: Array<{ name: string; value: string; domain?: string; path?: string }>
): Promise<Buffer> {
  let browser = null

  try {
    // Determine if we're in production (Vercel) or development
    const isProduction = process.env.NODE_ENV === 'production'

    // Launch Puppeteer with appropriate configuration
    if (isProduction) {
      // Use puppeteer-core with chromium for serverless
      browser = await puppeteerCore.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
      })
    } else {
      // Use regular puppeteer in development
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      })
    }

    const page = await browser.newPage()

    // Set viewport for high-resolution rendering
    await page.setViewport({
      width: 2550, // 8.5 inches at 300 DPI
      height: 3300, // 11 inches at 300 DPI
      deviceScaleFactor: 2, // High resolution for print quality
    })

    // Set authentication cookies if provided
    if (cookies && cookies.length > 0) {
      console.log('[PDF Generator] Setting authentication cookies')
      await page.setCookie(...cookies)
    }

    // Construct the print preview URL
    const previewUrl = `${baseUrl}/albums/${albumId}/print?layout=${layoutTemplate}&pdf=true`

    console.log(`[PDF Generator] Navigating to: ${previewUrl}`)

    // Navigate to the print preview page
    await page.goto(previewUrl, {
      waitUntil: ['networkidle2', 'domcontentloaded'],
      timeout: 90000, // 90 seconds timeout for large albums
    })

    console.log('[PDF Generator] Page loaded, waiting for content to render...')

    // Wait for React to hydrate and content to be ready
    // Look for the pages wrapper with data-pdf-ready attribute
    try {
      await page.waitForSelector('.pages-wrapper[data-pdf-ready="true"]', { timeout: 30000 })
      console.log('[PDF Generator] PDF-ready pages wrapper found')
    } catch (e) {
      console.log('[PDF Generator] Warning: PDF-ready attribute not found, waiting for pages-wrapper...')
      try {
        await page.waitForSelector('.pages-wrapper', { timeout: 10000 })
        console.log('[PDF Generator] Pages wrapper found')
      } catch (e2) {
        console.log('[PDF Generator] Pages wrapper not found, continuing anyway')
      }
    }

    // Additional wait for React hydration and dynamic content
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Wait for images to load with better error handling
    try {
      await page.waitForFunction(
        () => {
          const images = Array.from(document.images)
          if (images.length === 0) return true
          const loadedImages = images.filter((img) => img.complete && img.naturalHeight > 0)
          console.log(`Images loaded: ${loadedImages.length}/${images.length}`)
          return loadedImages.length === images.length
        },
        { timeout: 60000, polling: 1000 }
      )
      console.log('[PDF Generator] All images loaded successfully')
    } catch (e) {
      console.log('[PDF Generator] Timeout waiting for images, proceeding anyway')
    }

    // Final wait to ensure everything is settled
    await new Promise(resolve => setTimeout(resolve, 2000))

    console.log('[PDF Generator] Taking screenshots of each page...')

    // Get all .print-page elements
    const pageElements = await page.$$('.print-page')
    console.log(`[PDF Generator] Found ${pageElements.length} pages to screenshot`)

    if (pageElements.length === 0) {
      throw new Error('No .print-page elements found on the preview page')
    }

    // Screenshot each page element
    const screenshots: Buffer[] = []
    for (let i = 0; i < pageElements.length; i++) {
      const screenshot = await pageElements[i].screenshot({
        type: 'jpeg',
        quality: 95,
      })
      screenshots.push(Buffer.from(screenshot))
      console.log(`[PDF Generator] Screenshot ${i + 1}/${pageElements.length} captured`)
    }

    await browser.close()

    // Combine JPEGs into a single PDF using pdf-lib
    console.log('[PDF Generator] Combining screenshots into PDF...')
    const pdfDoc = await PDFDocument.create()

    for (const screenshot of screenshots) {
      const image = await pdfDoc.embedJpg(screenshot)
      const page = pdfDoc.addPage([image.width, image.height])
      page.drawImage(image, {
        x: 0,
        y: 0,
        width: image.width,
        height: image.height,
      })
    }

    const pdfBytes = await pdfDoc.save()
    console.log(`[PDF Generator] PDF created successfully, size: ${pdfBytes.length} bytes`)

    return Buffer.from(pdfBytes)
  } catch (error) {
    if (browser) {
      await browser.close()
    }
    console.error('[PDF Generator] Error generating PDF from preview:', error)
    throw error
  }
}

/**
 * Calculate estimated page count for a layout
 */
export function calculatePageCount(
  photoCount: number,
  layout: string
): number {
  const photosPerPage: Record<string, number> = {
    'single-per-page': 1,
    'grid-2x2': 4,
    'grid-3x3': 9,
    'grid-4x4': 16,
    'collage': 6,
  }

  const pagesNeeded = Math.ceil(photoCount / (photosPerPage[layout] || 4))
  const totalPages = pagesNeeded + 1 // Add cover page

  // Ensure minimum pages (24 for photo books)
  return Math.max(totalPages, 24)
}
