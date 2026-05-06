# Wompi Payment Integration Guide

## Overview
The Fastyy application now integrates with Wompi for payment processing. This guide explains how to set up and use the payment integration.

## Backend Setup

### 1. Environment Variables
Add the following to your `.env` file in the `backend` directory:

```env
WOMPI_PUBLIC_KEY=your_wompi_public_key_here
WOMPI_PRIVATE_KEY=your_wompi_private_key_here
WOMPI_EVENTS_KEY=your_wompi_events_key_here
ENV=production  # or 'development' for sandbox
```

Get these keys from your Wompi dashboard:
- **WOMPI_PUBLIC_KEY**: Used by the frontend widget (safe to expose)
- **WOMPI_PRIVATE_KEY**: Used by the backend for transactions (keep secret)
- **WOMPI_EVENTS_KEY**: Used to verify webhook signatures

### 2. Database Schema
The migration script creates the necessary database tables:

```bash
cd backend
python migrations/add_payments_table.py
```

This creates:
- `payments` table to store payment records
- Updates the `orders` table status enum to include `pending_payment` and `confirmed`

### 3. API Endpoints

#### Create Payment
```
POST /api/payments/create
Content-Type: application/json

{
  "order_id": "order-123",
  "amount": 50000,
  "currency": "COP",
  "customer_email": "customer@example.com",
  "reference": "order-123-timestamp"
}

Response:
{
  "payment_id": "wompi-transaction-id",
  "reference": "order-123-timestamp",
  "checkout_url": "https://checkout.wompi.co/...",
  "status": "PENDING"
}
```

#### Webhook Handler
```
POST /api/payments/webhook

Wompi sends transaction updates to this endpoint. The signature is verified automatically.
```

#### Get Payment Status
```
GET /api/payments/{order_id}

Response:
{
  "id": "payment-uuid",
  "order_id": "order-123",
  "amount": 50000,
  "currency": "COP",
  "status": "APPROVED",
  "wompi_transaction_id": "wompi-id",
  "created_at": "2024-05-06T10:30:00Z"
}
```

## Frontend Implementation

### 1. Payment Method Selection
When a user selects "card" as payment method in checkout:
1. Order is created with status `pending_payment`
2. Payment record is created with Wompi
3. User is redirected to Wompi checkout URL

### 2. Checkout Flow
```typescript
// In Checkout.tsx
if (paymentMethod === "card") {
  // Create payment
  const paymentResponse = await fetch("/api/payments/create", {
    method: "POST",
    body: JSON.stringify({
      order_id: data.id,
      amount: orderTotal,
      currency: "COP",
      customer_email: user.email,
      reference: `order-${data.id}`
    })
  });
  
  // Redirect to Wompi checkout
  window.location.href = paymentData.checkout_url;
}
```

### 3. Payment Success Page
After user completes payment, they're redirected to `/payment/success?order_id=xxx`

The page:
- Verifies payment status
- Updates order status from `pending_payment` to `confirmed`
- Shows order confirmation

## Order Status Flow

```
Pending Payment (card) → Wompi Processing → Confirmed → Preparing → ...
       ↓ (cash/wallet)
     Pending → Confirmed → Preparing → ...
```

## Testing

### Test Cards (Sandbox)
Use these test card numbers in sandbox mode:

- **Approved**: 4242 4242 4242 4242 (Visa)
- **Declined**: 4111 1111 1111 1111 (Visa)
- **3D Secure**: 5555 5555 5555 4444 (Mastercard)

Expiry: Any future date
CVV: Any 3 digits

### Testing Webhook
To test webhook locally:
1. Use a tunnel service (ngrok, localtunel)
2. Update webhook URL in Wompi dashboard to point to your local server
3. Test payment and verify webhook is called

## Security Considerations

1. **Private Key**: Never commit `WOMPI_PRIVATE_KEY` to version control
2. **Webhook Signature**: Always verify webhook signatures using `WOMPI_EVENTS_KEY`
3. **HTTPS Only**: Wompi requires HTTPS in production
4. **Idempotency**: Use unique reference codes for each transaction

## Troubleshooting

### Foreign Key Error
If you see "Referencing column incompatible" error:
- Ensure both `orders.id` and `payments.order_id` use VARCHAR(50)
- The migration handles charset/collation differences automatically

### Checkout URL Not Found
- Verify `WOMPI_PUBLIC_KEY` is correct
- Check Wompi API response for errors
- Ensure environment is set to correct mode (production/sandbox)

### Webhook Not Received
- Verify webhook URL in Wompi dashboard
- Check `WOMPI_EVENTS_KEY` is correct for signature verification
- Ensure backend is accessible from internet (production)

## Wompi API References
- [Wompi Documentation](https://docs.wompi.co)
- [Widget Integration](https://docs.wompi.co/widgets/checkout)
- [REST API](https://docs.wompi.co/api)
- [Webhooks](https://docs.wompi.co/webhooks)