/**
 * API Route: Create Gelato Print Order
 * POST /api/gelato/order
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { gelatoClient } from '@/lib/gelato/client'
import type { CreateOrderRequest, OrderRecipient } from '@/lib/gelato/types'

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
      albumId,
      productUid,
      pageCount,
      quantity = 1,
      fileUrl,
      layoutTemplate,
      recipient,
      shippingMethod = 'standard',
      unitPrice,
      shippingCost,
      totalCost,
    } = body

    // Validate required fields
    if (!albumId || !productUid || !pageCount || !fileUrl || !recipient) {
      return NextResponse.json(
        {
          error:
            'Missing required fields: albumId, productUid, pageCount, fileUrl, recipient',
        },
        { status: 400 }
      )
    }

    // Validate recipient
    if (
      !recipient.firstName ||
      !recipient.lastName ||
      !recipient.email ||
      !recipient.addressLine1 ||
      !recipient.city ||
      !recipient.postCode ||
      !recipient.country
    ) {
      return NextResponse.json(
        { error: 'Incomplete recipient information' },
        { status: 400 }
      )
    }

    // Create order in database first (as 'pending')
    const { data: printOrder, error: dbError } = await supabase
      .from('print_orders')
      .insert({
        user_id: user.id,
        album_id: albumId,
        status: 'pending',
        product_uid: productUid,
        page_count: pageCount,
        quantity,
        layout_template: layoutTemplate,
        file_url: fileUrl,
        currency: 'USD',
        unit_price: unitPrice,
        shipping_cost: shippingCost,
        total_cost: totalCost,
        recipient_name: `${recipient.firstName} ${recipient.lastName}`,
        recipient_email: recipient.email,
        shipping_address: {
          firstName: recipient.firstName,
          lastName: recipient.lastName,
          addressLine1: recipient.addressLine1,
          addressLine2: recipient.addressLine2,
          city: recipient.city,
          postCode: recipient.postCode,
          stateCode: recipient.stateCode,
          country: recipient.country,
        },
      })
      .select()
      .single()

    if (dbError || !printOrder) {
      console.error('[Gelato Order API] Database error:', dbError)
      return NextResponse.json(
        { error: 'Failed to create order record' },
        { status: 500 }
      )
    }

    try {
      // Prepare Gelato order request
      const orderRequest: CreateOrderRequest = {
        orderReferenceId: `order-${printOrder.id}`,
        customerReferenceId: user.id,
        currency: 'USD',
        recipient: recipient as OrderRecipient,
        shippingMethod,
        products: [
          {
            itemReferenceId: `item-${albumId}`,
            productUid,
            fileUrl,
            quantity,
            pageCount,
          },
        ],
      }

      // Submit order to Gelato
      const gelatoOrder = await gelatoClient.createOrder(orderRequest)

      // Update database record with Gelato order ID
      const { error: updateError } = await supabase
        .from('print_orders')
        .update({
          gelato_order_id: gelatoOrder.orderId,
          status: 'processing',
          gelato_response: gelatoOrder as unknown as Record<string, unknown>,
          tracking_number: gelatoOrder.trackingNumber,
          estimated_delivery_date: gelatoOrder.estimatedDeliveryDate,
        })
        .eq('id', printOrder.id)

      if (updateError) {
        console.error('[Gelato Order API] Update error:', updateError)
      }

      return NextResponse.json({
        success: true,
        order: {
          id: printOrder.id,
          gelatoOrderId: gelatoOrder.orderId,
          status: gelatoOrder.status,
          trackingNumber: gelatoOrder.trackingNumber,
          estimatedDeliveryDate: gelatoOrder.estimatedDeliveryDate,
          totalCost: gelatoOrder.totalCost,
        },
      })
    } catch (gelatoError) {
      // Update order status to 'failed'
      await supabase
        .from('print_orders')
        .update({
          status: 'failed',
          error_message:
            gelatoError instanceof Error
              ? gelatoError.message
              : 'Unknown error',
        })
        .eq('id', printOrder.id)

      throw gelatoError
    }
  } catch (error) {
    console.error('[Gelato Order API] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to create order',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/gelato/order?orderId=xxx
 * Get order status
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get('orderId')

    if (!orderId) {
      return NextResponse.json(
        { error: 'Missing orderId parameter' },
        { status: 400 }
      )
    }

    // Get order from database
    const { data: printOrder, error: dbError } = await supabase
      .from('print_orders')
      .select('*')
      .eq('id', orderId)
      .eq('user_id', user.id)
      .single()

    if (dbError || !printOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // If we have a Gelato order ID, fetch latest status
    if (printOrder.gelato_order_id) {
      try {
        const gelatoStatus = await gelatoClient.getOrderStatus(
          printOrder.gelato_order_id
        )

        // Update our database with latest status
        await supabase
          .from('print_orders')
          .update({
            status: gelatoStatus.status,
            tracking_number: gelatoStatus.trackingNumber,
          })
          .eq('id', orderId)

        return NextResponse.json({
          order: {
            ...printOrder,
            status: gelatoStatus.status,
            tracking_number: gelatoStatus.trackingNumber,
            tracking_url: gelatoStatus.trackingUrl,
          },
          gelatoStatus,
        })
      } catch (error) {
        console.error('[Gelato Order API] Status fetch error:', error)
        // Fall through to return database record
      }
    }

    return NextResponse.json({ order: printOrder })
  } catch (error) {
    console.error('[Gelato Order API] GET Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch order',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
