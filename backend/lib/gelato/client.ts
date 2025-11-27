/**
 * Gelato API Client
 * Handles authentication and HTTP requests to Gelato API
 */

import type {
  QuoteRequest,
  QuoteResponse,
  CreateOrderRequest,
  CreateOrderResponse,
  OrderStatus,
  GelatoAPIError
} from './types'

const GELATO_API_BASE_URL = process.env.GELATO_API_BASE_URL || 'https://order.gelatoapis.com'
const GELATO_API_KEY = process.env.GELATO_API_KEY

if (!GELATO_API_KEY) {
  console.warn('[Gelato] API key not configured. Set GELATO_API_KEY environment variable.')
}

/**
 * Base fetch wrapper for Gelato API
 */
async function gelatoFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  if (!GELATO_API_KEY) {
    throw new Error('Gelato API key is not configured')
  }

  const url = `${GELATO_API_BASE_URL}${endpoint}`

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': GELATO_API_KEY,
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error: GelatoAPIError = await response.json().catch(() => ({
      error: {
        code: 'UNKNOWN_ERROR',
        message: `HTTP ${response.status}: ${response.statusText}`,
      },
    }))

    throw new Error(
      `Gelato API Error: ${error.error.message} (Code: ${error.error.code})`
    )
  }

  return response.json()
}

/**
 * Gelato API Client
 */
export const gelatoClient = {
  /**
   * Get a quote for an order
   */
  async getQuote(request: QuoteRequest): Promise<QuoteResponse> {
    return gelatoFetch<QuoteResponse>('/v3/orders:quote', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  },

  /**
   * Create a new order
   */
  async createOrder(request: CreateOrderRequest): Promise<CreateOrderResponse> {
    return gelatoFetch<CreateOrderResponse>('/v4/orders', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  },

  /**
   * Get order status
   */
  async getOrderStatus(orderId: string): Promise<OrderStatus> {
    return gelatoFetch<OrderStatus>(`/v4/orders/${orderId}`)
  },

  /**
   * Get product catalog (Note: This may require separate endpoint or manual configuration)
   */
  async getProducts(): Promise<unknown> {
    // Note: Gelato may not have a public products API endpoint
    // You may need to maintain a static catalog or use their dashboard
    throw new Error('Product catalog endpoint not implemented. Use static product definitions.')
  },

  /**
   * Get cover dimensions for a product
   */
  async getCoverDimensions(productUid: string): Promise<{
    width: number
    height: number
    spine: number
    unit: string
  }> {
    return gelatoFetch(
      `https://product.gelatoapis.com/v3/products/${productUid}/cover-dimensions`
    )
  },
}

export default gelatoClient
