# Gelato Payment Integration - Implementation Required

## Overview

The FindMyPhoto application has a complete Gelato print-on-demand integration for ordering photo books. However, the **payment processing layer is missing**, which prevents the application from being production-ready.

## Current State

### What's Implemented (Working)

| Component | Status | Description |
|-----------|--------|-------------|
| Gelato API Client | ✅ Complete | Full API integration at `lib/gelato/client.ts` |
| Product Catalog | ✅ Complete | 4 photo book options (hardcover/softcover, 8×11"/A4) |
| Quote API | ✅ Complete | Real-time pricing with shipping costs |
| Order Creation | ✅ Complete | Orders sent to Gelato via API |
| Order Tracking | ✅ Complete | Status polling and display |
| PDF Generation | ✅ Complete | Puppeteer-based print-ready PDFs |
| Print Preview | ✅ Complete | WYSIWYG preview with multiple layouts |
| Checkout Dialog | ✅ Complete | 3-step order flow UI |
| Database Schema | ✅ Complete | `print_orders` table stores order data |

### What's Missing (Critical)

| Component | Status | Impact |
|-----------|--------|--------|
| Payment Gateway | ❌ Missing | No way to collect money |
| Payment UI | ❌ Missing | No card/payment form |
| Payment Verification | ❌ Missing | Orders created without payment |
| Transaction Logging | ❌ Missing | No payment audit trail |

## The Problem

### Current Order Flow (Broken)

\`\`\`
1. User selects product & quantity
2. User enters shipping address
3. System fetches quote from Gelato (price displayed)
4. User clicks "Place Order"
5. Order sent directly to Gelato ← NO PAYMENT COLLECTED
6. Order saved to database as "pending"
\`\`\`

### Expected Order Flow (Correct)

\`\`\`
1. User selects product & quantity
2. User enters shipping address
3. System fetches quote from Gelato (price displayed)
4. User enters payment details ← NEW STEP
5. Payment processed via Stripe ← NEW STEP
6. On payment success → Order sent to Gelato
7. Order saved to database with payment confirmation
\`\`\`

## Impact of Missing Payment

- **Revenue Loss**: Orders fulfilled without payment collection
- **Fraud Risk**: Anyone can order products without paying
- **Operational Burden**: Would require manual payment collection
- **Gelato Billing**: We would be billed by Gelato for unfunded orders

## Required Implementation

### 1. Stripe Integration (Recommended)

**Why Stripe:**
- Industry standard for e-commerce
- Excellent React/Next.js support
- Built-in fraud protection
- Test mode for development
- Webhook support for async confirmation

**Required Packages:**
\`\`\`bash
npm install stripe @stripe/react-stripe-js @stripe/stripe-js
\`\`\`

**Environment Variables Needed:**
\`\`\`env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
\`\`\`

### 2. New API Routes Required

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/payment/create-intent` | POST | Create Stripe PaymentIntent with order amount |
| `/api/payment/confirm` | POST | Confirm payment and trigger Gelato order |
| `/api/webhooks/stripe` | POST | Handle Stripe webhook events |

### 3. Database Schema Updates

Add to `print_orders` table:
\`\`\`sql
ALTER TABLE print_orders ADD COLUMN payment_status TEXT DEFAULT 'pending';
ALTER TABLE print_orders ADD COLUMN payment_intent_id TEXT;
ALTER TABLE print_orders ADD COLUMN payment_method TEXT;
ALTER TABLE print_orders ADD COLUMN paid_at TIMESTAMPTZ;
\`\`\`

Payment status values: `pending`, `processing`, `succeeded`, `failed`, `refunded`

### 4. UI Changes Required

Update `components/print-order-dialog.tsx`:

**Current Steps:**
1. Product Selection
2. Shipping & Address
3. Confirmation

**New Steps:**
1. Product Selection
2. Shipping & Address
3. **Payment** ← NEW
4. Confirmation

### 5. Order Flow Logic Update

Current code in `/app/api/gelato/order/route.ts`:
\`\`\`typescript
// Currently creates Gelato order immediately
const gelatoOrder = await gelatoClient.createOrder(orderData);
\`\`\`

Required change:
\`\`\`typescript
// 1. Verify payment succeeded
if (paymentStatus !== 'succeeded') {
  return Response.json({ error: 'Payment required' }, { status: 402 });
}

// 2. Only then create Gelato order
const gelatoOrder = await gelatoClient.createOrder(orderData);
\`\`\`

## Implementation Checklist

### Phase 1: Core Payment (Required for Launch)

- [ ] Create Stripe account and configure API keys
- [ ] Install Stripe packages
- [ ] Create `/api/payment/create-intent` endpoint
- [ ] Add payment form component using Stripe Elements
- [ ] Add payment step to checkout dialog (step 3)
- [ ] Update order API to require payment confirmation
- [ ] Add payment fields to database schema
- [ ] Test end-to-end flow in Stripe test mode

### Phase 2: Reliability (Before Production)

- [ ] Implement Stripe webhook handler
- [ ] Add payment error handling and retry logic
- [ ] Send payment confirmation emails
- [ ] Add payment receipts/invoice generation
- [ ] Implement idempotency for order creation
- [ ] Add logging for payment events

### Phase 3: Enhancements (Post-Launch)

- [ ] Add refund/cancellation handling
- [ ] Implement tax calculation
- [ ] Add coupon/discount code system
- [ ] Support additional payment methods (Apple Pay, Google Pay)
- [ ] Add payment analytics dashboard

## File References

| Purpose | File Path |
|---------|-----------|
| Gelato Client | `lib/gelato/client.ts` |
| Gelato Types | `lib/gelato/types.ts` |
| Product Catalog | `lib/gelato/products.ts` |
| Order Dialog | `components/print-order-dialog.tsx` |
| Order API | `app/api/gelato/order/route.ts` |
| Quote API | `app/api/gelato/quote/route.ts` |
| Orders Page | `app/orders/page.tsx` |
| Orders Table | `components/orders-table.tsx` |

## Estimated Effort

| Task | Complexity | Estimate |
|------|------------|----------|
| Stripe setup & config | Low | - |
| Payment API routes | Medium | - |
| Payment UI component | Medium | - |
| Checkout dialog update | Medium | - |
| Database migration | Low | - |
| Order flow update | Medium | - |
| Testing | Medium | - |
| **Total** | - | - |

## Testing Checklist

- [ ] Successful payment creates Gelato order
- [ ] Failed payment does NOT create Gelato order
- [ ] Payment amount matches quote total
- [ ] Shipping address passed correctly to Gelato
- [ ] Order status updates correctly
- [ ] Database records payment details
- [ ] Webhook handles async confirmations
- [ ] Error messages display correctly
- [ ] Stripe test cards work as expected

## Stripe Test Cards

For testing in development:
- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **Requires Auth**: `4000 0025 0000 3155`

## Summary

The Gelato integration is fully functional, but **payment processing must be implemented before production deployment**. Without it, orders will be created and sent to Gelato without any revenue collection, resulting in financial loss and operational issues.

**Priority: CRITICAL - Required before any production orders**
