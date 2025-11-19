# Gelato Print-on-Demand Integration

Complete integration with Gelato API for printing physical photo albums from your FindMyPhoto albums.

## Overview

This integration allows users to order professional-quality physical photo albums directly from the app. The albums are printed and shipped by Gelato, a global print-on-demand service with 140+ production partners in 32 countries.

## Features

- **Product Selection**: Choose from hardcover or softcover photo books in multiple sizes
- **Live Pricing**: Get real-time quotes including shipping costs
- **Order Management**: Track order status from placement to delivery
- **Multiple Layouts**: Support for all existing print layouts (single-per-page, grids, collage)
- **Global Shipping**: Ships to US, Canada, UK, Australia, and more

## Setup Instructions

### 1. Get Gelato API Credentials

1. Sign up for a Gelato account at [https://www.gelato.com](https://www.gelato.com)
2. Navigate to the API section in your dashboard
3. Generate an API key
4. Copy the API key

### 2. Configure Environment Variables

Add the following to your `.env` file:

```bash
GELATO_API_KEY=your-gelato-api-key-here
GELATO_API_BASE_URL=https://order.gelatoapis.com
```

### 3. Set Up Supabase Storage (For PDF Files)

The integration requires a storage bucket for generated PDF files:

1. Go to your Supabase project dashboard
2. Navigate to Storage
3. Create a new bucket called `print-files`
4. Set it to public (or configure appropriate access policies)

### 4. Test Mode vs Production

Gelato provides separate API keys for testing and production:

- **Test Mode**: Orders are simulated and automatically cancelled (use for development)
- **Production Mode**: Real orders that will be printed and shipped

Make sure to use the test API key during development!

## How It Works

### User Flow

1. **Create Album**: User creates a photo album with selected photos
2. **Preview**: User views the print preview at `/albums/[id]/print`
3. **Order**: User clicks "Order Physical Print" button
4. **Configure**: User selects product options (hardcover/softcover, size, pages)
5. **Quote**: System fetches real-time pricing from Gelato
6. **Shipping**: User enters shipping address
7. **Confirm**: User reviews order and confirms
8. **Processing**: Order is sent to Gelato for fulfillment
9. **Track**: User can track order status in the Orders page

### Technical Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     GELATO INTEGRATION FLOW                      │
└─────────────────────────────────────────────────────────────────┘

1. User clicks "Order Physical Print"
   ↓
2. PrintOrderDialog opens
   ↓
3. GET /api/gelato/products → Load available products
   ↓
4. User selects product and enters shipping address
   ↓
5. POST /api/gelato/quote → Get pricing from Gelato API
   ↓
6. Display quote to user
   ↓
7. User confirms order
   ↓
8. POST /api/gelato/order
   ├─ Generate PDF from album (TODO: Implement PDF generation)
   ├─ Upload PDF to Supabase Storage
   ├─ Create print_orders record in database
   ├─ Submit order to Gelato API
   └─ Update database with Gelato order ID
   ↓
9. Order confirmation shown to user
   ↓
10. User can track order at /orders page
```

## File Structure

```
lib/gelato/
├── types.ts          # TypeScript type definitions for Gelato API
├── client.ts         # API client for making requests to Gelato
└── products.ts       # Product catalog and helper functions

app/api/gelato/
├── products/route.ts # GET product catalog
├── quote/route.ts    # POST get pricing quote
└── order/route.ts    # POST create order, GET order status

components/
├── print-order-dialog.tsx  # Main UI for ordering prints
└── orders-table.tsx        # Display user's orders

app/orders/
└── page.tsx          # Orders tracking page

Database:
└── print_orders      # Table for tracking orders
```

## Database Schema

### print_orders Table

```sql
CREATE TABLE print_orders (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  album_id BIGINT NOT NULL REFERENCES albums(id),

  -- Gelato order tracking
  gelato_order_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft',

  -- Product details
  product_uid TEXT NOT NULL,
  product_name TEXT,
  page_count INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  layout_template TEXT NOT NULL,

  -- File storage
  file_url TEXT,

  -- Pricing
  currency TEXT DEFAULT 'USD',
  unit_price DECIMAL(10,2),
  shipping_cost DECIMAL(10,2),
  total_cost DECIMAL(10,2),

  -- Shipping details
  recipient_name TEXT,
  recipient_email TEXT,
  shipping_address JSONB,

  -- Tracking
  tracking_number TEXT,
  estimated_delivery_date TIMESTAMPTZ,

  -- Metadata
  gelato_response JSONB,
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Available Products

The integration currently supports 4 photo book products:

1. **Hardcover Photo Book (8×11")**
   - Size: 210×280mm (8×11 inches)
   - Cover: Hardcover with matt lamination
   - Paper: 170 GSM silk
   - Pages: 24-200

2. **Softcover Photo Book (8×11")**
   - Size: 210×280mm (8×11 inches)
   - Cover: Softcover
   - Paper: 170 GSM silk
   - Pages: 24-200

3. **Hardcover Photo Book (A4)**
   - Size: 210×297mm (A4)
   - Cover: Hardcover with matt lamination
   - Paper: 170 GSM silk
   - Pages: 24-200

4. **Softcover Photo Book (A4)**
   - Size: 210×297mm (A4)
   - Cover: Softcover
   - Paper: 170 GSM silk
   - Pages: 24-200

## Pricing

Pricing is fetched dynamically from Gelato based on:
- Product selection
- Page count
- Quantity
- Shipping destination

**Example Pricing (USD):**
- Hardcover 8×11": ~$11.85/unit (Gelato+ members) or ~$19.99/unit
- Softcover 8×11": ~$6.92/unit (Gelato+ members) or ~$11.85/unit
- Shipping: Varies by destination ($5-$15 typically)

*Note: Prices may vary. Always check the quote for accurate pricing.*

## API Endpoints

### GET /api/gelato/products

Get available photo book products.

**Response:**
```json
{
  "products": [
    {
      "uid": "photobooks-hardcover_pf_...",
      "name": "Hardcover Photo Book (8×11\")",
      "size": "210x280-mm-8x11-inch",
      "coverType": "hardcover",
      "paperType": "170-gsm-65lb-coated-silk",
      "minPages": 24,
      "maxPages": 200
    }
  ],
  "count": 4
}
```

### POST /api/gelato/quote

Get a pricing quote.

**Request:**
```json
{
  "productUid": "photobooks-hardcover_pf_...",
  "pageCount": 48,
  "quantity": 1,
  "country": "US",
  "city": "New York",
  "postCode": "10001"
}
```

**Response:**
```json
{
  "success": true,
  "quote": {
    "currency": "USD",
    "unitPrice": 19.99,
    "totalProductCost": 19.99,
    "shippingCost": 7.50,
    "totalCost": 27.49,
    "estimatedDeliveryDays": 7,
    "shippingMethod": "standard"
  }
}
```

### POST /api/gelato/order

Place an order.

**Request:**
```json
{
  "albumId": 123,
  "productUid": "photobooks-hardcover_pf_...",
  "pageCount": 48,
  "quantity": 1,
  "fileUrl": "https://storage.supabase.co/...",
  "layoutTemplate": "grid-2x2",
  "recipient": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "addressLine1": "123 Main St",
    "city": "New York",
    "postCode": "10001",
    "country": "US"
  },
  "unitPrice": 19.99,
  "shippingCost": 7.50,
  "totalCost": 27.49
}
```

**Response:**
```json
{
  "success": true,
  "order": {
    "id": 456,
    "gelatoOrderId": "GO123456789",
    "status": "processing",
    "trackingNumber": "1Z999AA10123456784",
    "estimatedDeliveryDate": "2025-02-01",
    "totalCost": 27.49
  }
}
```

### GET /api/gelato/order?orderId=456

Get order status.

**Response:**
```json
{
  "order": {
    "id": 456,
    "status": "shipped",
    "tracking_number": "1Z999AA10123456784",
    "gelato_order_id": "GO123456789",
    ...
  }
}
```

## TODO: PDF Generation

Currently, the integration has a placeholder for PDF generation. You need to implement:

1. **Server-side PDF generation** using one of:
   - Puppeteer (render HTML to PDF)
   - PDFKit (programmatic PDF creation)
   - jsPDF (client/server PDF generation)

2. **Requirements**:
   - Resolution: 300 DPI
   - Format: PDF/X-4
   - Color space: sRGB or CMYK
   - Bleed: 4mm on all sides
   - Single multi-page PDF file

3. **Recommended approach**:
   ```typescript
   // Create API route: /api/gelato/generate-pdf
   import puppeteer from 'puppeteer'

   export async function POST(request: Request) {
     const { albumId, layoutTemplate } = await request.json()

     // Fetch album data
     const album = await fetchAlbum(albumId)

     // Generate HTML for print layout
     const html = generatePrintLayoutHTML(album, layoutTemplate)

     // Convert to PDF using Puppeteer
     const browser = await puppeteer.launch()
     const page = await browser.newPage()
     await page.setContent(html)
     const pdf = await page.pdf({
       format: 'Letter',
       printBackground: true,
       preferCSSPageSize: true,
     })
     await browser.close()

     // Upload to Supabase Storage
     const fileName = `album-${albumId}-${Date.now()}.pdf`
     const { data, error } = await supabase.storage
       .from('print-files')
       .upload(fileName, pdf, {
         contentType: 'application/pdf',
       })

     // Return public URL
     const { data: { publicUrl } } = supabase.storage
       .from('print-files')
       .getPublicUrl(fileName)

     return NextResponse.json({ fileUrl: publicUrl })
   }
   ```

## Testing

### Test the Integration

1. **Start the development server**:
   ```bash
   npm run dev
   ```

2. **Create a test album** with photos

3. **Go to print preview**:
   ```
   http://localhost:3000/albums/[album-id]/print
   ```

4. **Click "Order Physical Print"**

5. **Test the flow**:
   - Select product (hardcover/softcover)
   - Adjust page count
   - Enter shipping address
   - Verify quote appears
   - Place order (will fail without PDF generation implemented)

6. **Check orders page**:
   ```
   http://localhost:3000/orders
   ```

### Common Issues

**Issue**: "Gelato API key is not configured"
- **Solution**: Add `GELATO_API_KEY` to your `.env` file

**Issue**: Quote request fails
- **Solution**: Verify API key is valid and check Gelato API status

**Issue**: Order placement fails
- **Solution**: Implement PDF generation (see TODO above)

**Issue**: Orders page shows "No orders yet"
- **Solution**: Database record creation might have failed. Check server logs.

## Next Steps

1. **Implement PDF Generation**: Add server-side PDF generation (see TODO section above)

2. **Add Payment Integration**: Integrate Stripe or PayPal for payment processing

3. **Email Notifications**: Send order confirmation and tracking updates via email

4. **Order Webhooks**: Set up webhooks to receive status updates from Gelato

5. **Add More Products**: Expand to support calendars, posters, and other products

6. **Bulk Ordering**: Allow ordering multiple albums at once

7. **Subscription Plans**: Integrate with Gelato+ for discounted pricing

## Support

For issues or questions:

1. Check Gelato API documentation: https://dashboard.gelato.com/docs/
2. Review the code comments in the integration files
3. Check server logs for error messages
4. Test with Gelato's test API key first

## License

This integration is part of the FindMyPhoto project and follows the same license.
