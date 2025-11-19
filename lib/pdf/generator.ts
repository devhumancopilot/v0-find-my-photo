/**
 * PDF Generation Service using Puppeteer
 * Generates print-ready PDFs from album layouts for Gelato printing
 */

import puppeteer from 'puppeteer'

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
      <div class="page cover-page">
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center;">
          <div style="margin-bottom: 3rem; width: 8rem; border-top: 4px solid #1f2937;"></div>

          <div style="margin-bottom: 4rem;">
            <h1 style="font-size: 3.75rem; font-weight: bold; letter-spacing: -0.025em; color: #111827; margin-bottom: 1.5rem; font-family: Georgia, serif;">
              ${albumTitle}
            </h1>
            <div style="margin: 0 auto; height: 4px; width: 6rem; background: linear-gradient(to right, #3b82f6, #8b5cf6, #ec4899);"></div>
          </div>

          <div style="margin-bottom: 4rem; display: flex; flex-direction: column; gap: 1.5rem;">
            <div style="display: flex; align-items: center; justify-content: center; gap: 0.75rem;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4b5563" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
              <p style="font-size: 1.25rem; font-weight: 300; color: #374151;">
                ${photos.length} ${photos.length === 1 ? 'Photograph' : 'Photographs'}
              </p>
            </div>

            <div style="display: flex; align-items: center; justify-content: center; gap: 0.75rem;">
              <div style="height: 6px; width: 6px; border-radius: 50%; background: #9ca3af;"></div>
              <p style="font-size: 1.125rem; font-weight: 300; color: #4b5563;">
                Created ${formattedDate}
              </p>
            </div>
          </div>

          <div style="margin-bottom: 3rem; display: flex; align-items: center; gap: 1rem;">
            <div style="height: 1px; width: 4rem; background: #d1d5db;"></div>
            <div style="display: flex; gap: 0.5rem;">
              <div style="height: 8px; width: 8px; border-radius: 50%; background: #60a5fa;"></div>
              <div style="height: 8px; width: 8px; border-radius: 50%; background: #a78bfa;"></div>
              <div style="height: 8px; width: 8px; border-radius: 50%; background: #f472b6;"></div>
            </div>
            <div style="height: 1px; width: 4rem; background: #d1d5db;"></div>
          </div>

          <div style="margin-top: auto;">
            <p style="font-family: Georgia, serif; font-size: 0.875rem; font-style: italic; color: #6b7280;">
              A curated collection of memories
            </p>
            <p style="margin-top: 0.5rem; font-size: 0.75rem; color: #9ca3af;">
              © ${currentYear} Find My Photo
            </p>
          </div>

          <div style="margin-top: 3rem; width: 8rem; border-top: 4px solid #1f2937;"></div>
        </div>
      </div>
    `
  }

  // Generate photo pages based on layout
  const generatePhotoPages = () => {
    if (layoutTemplate === 'single-per-page') {
      return photos
        .map(
          (photo, index) => `
        <div class="page">
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
            <img src="${photo.file_url}" alt="${photo.name}" style="max-height: 90vh; max-width: 100%; object-fit: contain;" />
            <div style="margin-top: 1.5rem; width: 100%; display: flex; align-items: center; justify-content: space-between; border-top: 1px solid #e5e7eb; padding-top: 0.75rem;">
              <p style="font-size: 0.75rem; color: #9ca3af;">${albumTitle}</p>
              <p style="font-size: 0.75rem; color: #9ca3af;">Photo ${index + 1} of ${photos.length}</p>
            </div>
          </div>
        </div>
      `
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
        <div style="margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.75rem;">
          <p style="font-size: 0.75rem; color: #6b7280;">${albumTitle}</p>
          <p style="font-size: 0.75rem; color: #6b7280;">Page ${pageIndex + 1} of ${pages.length}</p>
        </div>

        <div style="display: grid; grid-template-columns: repeat(${columns}, 1fr); grid-template-rows: repeat(${columns}, 1fr); gap: 1rem; height: calc(100% - 3rem);">
          ${pagePhotos
            .map(
              (photo) => `
            <div style="position: relative; overflow: hidden; border-radius: 0.5rem; border: 2px solid #e5e7eb;">
              <div style="aspect-ratio: 1; width: 100%; height: 100%;">
                <img src="${photo.file_url}" alt="${photo.name}" style="width: 100%; height: 100%; object-fit: cover;" />
              </div>
            </div>
          `
            )
            .join('')}
        </div>

        <div style="margin-top: 1.5rem; text-align: center; font-size: 0.75rem; color: #9ca3af;">
          Printed on ${new Date().toLocaleDateString()}
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
    await page.setContent(html, {
      waitUntil: ['networkidle0', 'load'],
      timeout: 60000, // 60 seconds timeout
    })

    // Wait for all images to load
    await page.evaluate(() => {
      return Promise.all(
        Array.from(document.images)
          .filter((img) => !img.complete)
          .map(
            (img) =>
              new Promise((resolve) => {
                img.onload = img.onerror = resolve
              })
          )
      )
    })

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
