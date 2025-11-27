/**
 * API Route: Get Gelato Order Quote
 * POST /api/gelato/quote
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { gelatoClient } from '@/lib/gelato/client'
import type { QuoteRequest } from '@/lib/gelato/types'

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
    const {
      productUid,
      pageCount,
      quantity = 1,
      country,
      city,
      postCode,
      stateCode,
    } = body

    // Validate required fields
    if (!productUid || !pageCount || !country) {
      return NextResponse.json(
        { error: 'Missing required fields: productUid, pageCount, country' },
        { status: 400 }
      )
    }

    // Prepare quote request
    const quoteRequest: QuoteRequest = {
      orderReferenceId: `quote-${user.id}-${Date.now()}`,
      currency: 'USD',
      recipient: {
        country,
        city,
        postCode,
        stateCode,
      },
      products: [
        {
          itemReferenceId: 'item-1',
          productUid,
          quantity,
          pageCount,
        },
      ],
    }

    // Get quote from Gelato
    const quote = await gelatoClient.getQuote(quoteRequest)

    // Calculate estimated pricing (if Gelato doesn't provide detailed breakdown)
    const product = quote.products[0]
    const shipping = quote.shipping[0]

    return NextResponse.json({
      success: true,
      quote: {
        currency: quote.currency,
        unitPrice: product?.unitPrice || 0,
        totalProductCost: quote.totalProductCost,
        shippingCost: shipping?.cost || 0,
        estimatedDeliveryDays: shipping?.estimatedDeliveryDays || 7,
        shippingMethod: shipping?.method || 'standard',
        totalCost: quote.totalCost,
      },
      raw: quote, // Include raw response for debugging
    })
  } catch (error) {
    console.error('[Gelato Quote API] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to get quote',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
