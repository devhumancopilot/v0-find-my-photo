/**
 * API Route: Get Gelato Product Catalog
 * GET /api/gelato/products
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PHOTO_BOOK_PRODUCTS } from '@/lib/gelato/products'

export async function GET() {
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

    // Return photo book products
    return NextResponse.json({
      products: PHOTO_BOOK_PRODUCTS,
      count: PHOTO_BOOK_PRODUCTS.length,
    })
  } catch (error) {
    console.error('[Gelato Products API] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch products',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
