from fastapi import APIRouter, HTTPException, status, Request
from typing import Optional
import os
import requests
import json
import hmac
import hashlib
from database import get_db
from schemas import PaymentCreate, PaymentResponse, WompiWebhook
from utils import get_bogota_time
import uuid

router = APIRouter()

WOMPI_PUBLIC_KEY = os.getenv("WOMPI_PUBLIC_KEY")
WOMPI_PRIVATE_KEY = os.getenv("WOMPI_PRIVATE_KEY")
WOMPI_EVENTS_KEY = os.getenv("WOMPI_EVENTS_KEY")

WOMPI_BASE_URL = "https://production.wompi.co/v1"
if os.getenv("ENV") == "development":
    WOMPI_BASE_URL = "https://sandbox.wompi.co/v1"

def verify_wompi_signature(payload: str, signature: str) -> bool:
    """Verify Wompi webhook signature"""
    if not WOMPI_EVENTS_KEY:
        return False
    expected_signature = hmac.new(
        WOMPI_EVENTS_KEY.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected_signature, signature)

@router.post("/create", response_model=dict)
def create_payment(payment: PaymentCreate):
    """Create a payment intent and return Wompi checkout info"""
    if not WOMPI_PUBLIC_KEY:
        raise HTTPException(status_code=500, detail="Wompi not configured (Public Key missing)")

    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")

    cursor = db.cursor(dictionary=True)
    try:
        # Check if order exists
        cursor.execute("SELECT * FROM orders WHERE id = %s", (payment.order_id,))
        order = cursor.fetchone()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        
        # In a real app, we'd check if status is pending_payment
        # For flexibility, we'll allow it if it's pending or pending_payment
        if order['status'] not in ['pending', 'pending_payment']:
             # If it's already confirmed, don't allow payment again unless we have a specific reason
             if order['status'] == 'confirmed':
                 return {
                     "status": "ALREADY_PAID",
                     "message": "Este pedido ya ha sido pagado"
                 }

        # Create a unique reference for this payment attempt
        reference = f"FASTYY-{payment.order_id}-{int(get_bogota_time().timestamp())}"
        payment_method = (payment.payment_method or "card").lower()

        # We'll use the Hosted Checkout flow (Redirect)
        frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3000')
        checkout_base = "https://checkout.wompi.co/p/"

        params = {
            "public-key": WOMPI_PUBLIC_KEY,
            "amount-in-cents": int(payment.amount * 100),
            "reference": reference,
            "currency": payment.currency,
            "redirect-url": f"{frontend_url}/rastreo/{payment.order_id}"
        }

        from urllib.parse import urlencode
        checkout_url = f"{checkout_base}?{urlencode(params)}"

        # Store payment intent in database
        payment_id = str(uuid.uuid4())
        cursor.execute("""
            INSERT INTO payments (id, order_id, amount, currency, status, reference, payment_method, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            payment_id,
            payment.order_id,
            payment.amount,
            payment.currency,
            'PENDING',
            reference,
            payment_method,
            get_bogota_time()
        ))
        db.commit()

        return {
            "payment_id": payment_id,
            "reference": reference,
            "checkout_url": checkout_url,
            "public_key": WOMPI_PUBLIC_KEY,
            "status": "PENDING",
            "payment_method": payment_method
        }

    except Exception as e:
        db.rollback()
        print(f"Error creating payment: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()

@router.post("/webhook")
async def wompi_webhook(request: Request):
    """Handle Wompi webhook events"""
    try:
        body = await request.body()
        payload = body.decode('utf-8')
        
        # Get signature from headers
        signature = request.headers.get('X-Wompi-Signature')
        if signature and not verify_wompi_signature(payload, signature):
            raise HTTPException(status_code=401, detail="Invalid signature")

        webhook_data = json.loads(payload)
        event = webhook_data.get('event')
        transaction_data = webhook_data.get('data', {})

        db = get_db()
        if not db:
            raise HTTPException(status_code=500, detail="Database connection failed")

        cursor = db.cursor(dictionary=True)
        try:
            # Find payment by Wompi transaction ID
            cursor.execute(
                "SELECT * FROM payments WHERE wompi_transaction_id = %s",
                (transaction_data.get('id'),)
            )
            payment = cursor.fetchone()
            
            if not payment:
                # Try by reference
                cursor.execute(
                    "SELECT * FROM payments WHERE reference = %s",
                    (transaction_data.get('reference'),)
                )
                payment = cursor.fetchone()
            
            if not payment:
                return {"status": "ignored"}

            # Determine payment type for persistence
            wompi_payment_method = transaction_data.get('payment_method_type') or transaction_data.get('payment_method', 'CARD')
            normalized_payment_method = 'transfer' if wompi_payment_method and wompi_payment_method.upper() in ['PSE', 'TRANSFER', 'BANK_TRANSFER'] else 'card'

            # Update payment status
            cursor.execute("""
                UPDATE payments 
                SET status = %s, payment_method = %s, updated_at = %s
                WHERE id = %s
            """, (
                transaction_data.get('status'),
                normalized_payment_method,
                get_bogota_time(),
                payment['id']
            ))

            # If payment approved, update order status
            if event == 'transaction.updated' and transaction_data.get('status') == 'APPROVED':
                cursor.execute("""
                    UPDATE orders 
                    SET status = 'confirmed', payment_method = %s
                    WHERE id = %s
                """, (normalized_payment_method, payment['order_id']))
            
            db.commit()
            return {"status": "processed"}

        finally:
            cursor.close()
            db.close()

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{order_id}", response_model=PaymentResponse)
def get_payment(order_id: str):
    """Get payment details for an order"""
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")

    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM payments WHERE order_id = %s ORDER BY created_at DESC LIMIT 1", (order_id,))
        payment = cursor.fetchone()
        if not payment:
            raise HTTPException(status_code=404, detail="Payment not found")
        
        return payment
    finally:
        cursor.close()
        db.close()