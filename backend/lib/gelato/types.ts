/**
 * Gelato API TypeScript Type Definitions
 * Based on Gelato API Documentation: https://dashboard.gelato.com/docs/
 */

// ============================================================================
// Product Types
// ============================================================================

export interface GelatoProduct {
  productUid: string
  name: string
  description: string
  category: string
  sizes: string[]
  paperTypes: string[]
  coverTypes?: string[]
  minPages?: number
  maxPages?: number
}

export interface ProductCatalogItem {
  uid: string
  name: string
  description: string
  category: 'photo-books' | 'posters' | 'calendars' | 'cards'
  specifications: {
    size?: string
    paperType?: string
    coverType?: 'hardcover' | 'softcover'
    binding?: string
    minPages?: number
    maxPages?: number
  }
}

// ============================================================================
// Quote Types
// ============================================================================

export interface QuoteRequest {
  orderReferenceId: string
  currency: string
  recipient: {
    country: string
    city?: string
    postCode?: string
    stateCode?: string
  }
  products: Array<{
    itemReferenceId: string
    productUid: string
    quantity: number
    pageCount?: number
  }>
}

export interface QuoteResponse {
  orderReferenceId: string
  currency: string
  products: Array<{
    itemReferenceId: string
    productUid: string
    quantity: number
    unitPrice: number
    totalPrice: number
  }>
  shipping: Array<{
    method: string
    cost: number
    estimatedDeliveryDays: number
  }>
  totalProductCost: number
  totalShippingCost: number
  totalCost: number
}

// ============================================================================
// Order Types
// ============================================================================

export interface OrderProduct {
  itemReferenceId: string
  productUid: string
  fileUrl: string
  quantity: number
  pageCount?: number
}

export interface OrderRecipient {
  firstName: string
  lastName: string
  email: string
  phone?: string
  addressLine1: string
  addressLine2?: string
  city: string
  postCode: string
  stateCode?: string
  country: string
}

export interface CreateOrderRequest {
  orderReferenceId: string
  customerReferenceId?: string
  currency: string
  recipient: OrderRecipient
  shippingMethod: string
  products: OrderProduct[]
}

export interface CreateOrderResponse {
  orderId: string
  orderReferenceId: string
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
  trackingNumber?: string
  estimatedDeliveryDate?: string
  totalCost: number
  currency: string
  createdAt: string
}

export interface OrderStatus {
  orderId: string
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
  trackingNumber?: string
  trackingUrl?: string
  estimatedDeliveryDate?: string
  shippedDate?: string
  deliveredDate?: string
  statusHistory: Array<{
    status: string
    timestamp: string
    message?: string
  }>
}

// ============================================================================
// Error Types
// ============================================================================

export interface GelatoAPIError {
  error: {
    code: string
    message: string
    details?: unknown
  }
}

// ============================================================================
// Photo Book Specific Types
// ============================================================================

export interface PhotoBookProduct {
  uid: string
  name: string
  size: string // e.g., "210x280-mm-8x11-inch"
  coverType: 'hardcover' | 'softcover'
  paperType: string // e.g., "170-gsm-65lb-coated-silk"
  binding: string // e.g., "glued-left"
  minPages: number
  maxPages: number
  coverFinish?: string // e.g., "matt-lamination"
}

export interface PhotoBookPricing {
  productUid: string
  basePrice: number
  pricePerPage: number
  currency: string
  discountTiers?: Array<{
    minQuantity: number
    discountPercentage: number
  }>
}

// ============================================================================
// Common Product UIDs (from Gelato documentation)
// ============================================================================

export const PHOTO_BOOK_PRODUCTS = {
  HARDCOVER_8X11: 'photobooks-hardcover_pf_210x280-mm-8x11-inch_pt_170-gsm-65lb-coated-silk_cl_4-4_ccl_4-4_bt_glued-left_ct_matt-lamination_prt_1-0_cpt_130-gsm-65-lb-cover-coated-silk_ver',
  SOFTCOVER_8X11: 'photobooks-softcover_pf_210x280-mm-8x11-inch_pt_170-gsm-65lb-coated-silk_cl_4-4_bt_glued-left_prt_1-0_ver',
  HARDCOVER_A4: 'photobooks-hardcover_pf_210x297-mm-a4_pt_170-gsm-65lb-coated-silk_cl_4-4_ccl_4-4_bt_glued-left_ct_matt-lamination_prt_1-0_cpt_130-gsm-65-lb-cover-coated-silk_ver',
  SOFTCOVER_A4: 'photobooks-softcover_pf_210x297-mm-a4_pt_170-gsm-65lb-coated-silk_cl_4-4_bt_glued-left_prt_1-0_ver',
} as const

// ============================================================================
// Helper Types
// ============================================================================

export type PhotoBookSize = '8x11' | 'A4' | '6x9' | 'A5'
export type CoverType = 'hardcover' | 'softcover'
export type OrderStatus = 'draft' | 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'failed'
