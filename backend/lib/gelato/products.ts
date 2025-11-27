/**
 * Gelato Product Catalog
 * Static product definitions for photo books
 */

import type { PhotoBookProduct } from './types'

/**
 * Available photo book products
 * Based on Gelato's product catalog
 */
export const PHOTO_BOOK_PRODUCTS: PhotoBookProduct[] = [
  {
    uid: 'photobooks-hardcover_pf_210x280-mm-8x11-inch_pt_170-gsm-65lb-coated-silk_cl_4-4_ccl_4-4_bt_glued-left_ct_matt-lamination_prt_1-0_cpt_130-gsm-65-lb-cover-coated-silk_ver',
    name: 'Hardcover Photo Book (8×11")',
    size: '210x280-mm-8x11-inch',
    coverType: 'hardcover',
    paperType: '170-gsm-65lb-coated-silk',
    binding: 'glued-left',
    minPages: 24,
    maxPages: 200,
    coverFinish: 'matt-lamination',
  },
  {
    uid: 'photobooks-softcover_pf_210x280-mm-8x11-inch_pt_170-gsm-65lb-coated-silk_cl_4-4_bt_glued-left_prt_1-0_ver',
    name: 'Softcover Photo Book (8×11")',
    size: '210x280-mm-8x11-inch',
    coverType: 'softcover',
    paperType: '170-gsm-65lb-coated-silk',
    binding: 'glued-left',
    minPages: 24,
    maxPages: 200,
  },
  {
    uid: 'photobooks-hardcover_pf_210x297-mm-a4_pt_170-gsm-65lb-coated-silk_cl_4-4_ccl_4-4_bt_glued-left_ct_matt-lamination_prt_1-0_cpt_130-gsm-65-lb-cover-coated-silk_ver',
    name: 'Hardcover Photo Book (A4)',
    size: '210x297-mm-a4',
    coverType: 'hardcover',
    paperType: '170-gsm-65lb-coated-silk',
    binding: 'glued-left',
    minPages: 24,
    maxPages: 200,
    coverFinish: 'matt-lamination',
  },
  {
    uid: 'photobooks-softcover_pf_210x297-mm-a4_pt_170-gsm-65lb-coated-silk_cl_4-4_bt_glued-left_prt_1-0_ver',
    name: 'Softcover Photo Book (A4)',
    size: '210x297-mm-a4',
    coverType: 'softcover',
    paperType: '170-gsm-65lb-coated-silk',
    binding: 'glued-left',
    minPages: 24,
    maxPages: 200,
  },
]

/**
 * Get product by UID
 */
export function getProductByUid(uid: string): PhotoBookProduct | undefined {
  return PHOTO_BOOK_PRODUCTS.find((product) => product.uid === uid)
}

/**
 * Get products by cover type
 */
export function getProductsByCoverType(
  coverType: 'hardcover' | 'softcover'
): PhotoBookProduct[] {
  return PHOTO_BOOK_PRODUCTS.filter(
    (product) => product.coverType === coverType
  )
}

/**
 * Get products by size
 */
export function getProductsBySize(size: string): PhotoBookProduct[] {
  return PHOTO_BOOK_PRODUCTS.filter((product) => product.size.includes(size))
}

/**
 * Calculate page count based on photos and layout
 */
export function calculatePageCount(
  photoCount: number,
  layout: 'single-per-page' | 'grid-2x2' | 'grid-3x3' | 'grid-4x4' | 'collage'
): number {
  const photosPerPage = {
    'single-per-page': 1,
    'grid-2x2': 4,
    'grid-3x3': 9,
    'grid-4x4': 16,
    'collage': 6,
  }

  const pagesNeeded = Math.ceil(photoCount / photosPerPage[layout])

  // Add cover page
  const totalPages = pagesNeeded + 1

  // Ensure minimum pages (usually 24 for photo books)
  const minPages = 24

  return Math.max(totalPages, minPages)
}

/**
 * Validate page count for product
 */
export function validatePageCount(
  productUid: string,
  pageCount: number
): { valid: boolean; message?: string } {
  const product = getProductByUid(productUid)

  if (!product) {
    return { valid: false, message: 'Product not found' }
  }

  if (pageCount < product.minPages) {
    return {
      valid: false,
      message: `Minimum ${product.minPages} pages required`,
    }
  }

  if (pageCount > product.maxPages) {
    return {
      valid: false,
      message: `Maximum ${product.maxPages} pages allowed`,
    }
  }

  return { valid: true }
}
