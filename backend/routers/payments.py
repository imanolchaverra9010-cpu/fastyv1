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
    """Create a payment transaction with Wompi"""
    if not WOMPI_PRIVATE_KEY:
        raise HTTPException(status_code=500, detail="Wompi not configured")

    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")

    cursor = db.cursor(dictionary=True)
    try:
        # Check if order exists and is pending payment
        cursor.execute("SELECT * FROM orders WHERE id = %s", (payment.order_id,))
        order = cursor.fetchone()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        
        if order['status'] != 'pending_payment':
            raise HTTPException(status_code=400, detail="Order is not pending payment")

        # Create Wompi transaction
        reference = payment.reference or str(uuid.uuid4())
        
        wompi_payload = {
            "amount_in_cents": payment.amount,
            "currency": payment.currency,
            "customer_email": payment.customer_email,
            "reference": reference,
            "customer_data": payment.customer_data or {},
            "redirect_url": f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/payment/success?order_id={payment.order_id}",
            "payment_method": {
                "type": "CARD",
                "token": "",  # Will be filled by frontend
                "installments": 1
            }
        }

        headers = {
            "Authorization": f"Bearer {WOMPI_PRIVATE_KEY}",
            "Content-Type": "application/json"
        }

        response = requests.post(
            f"{WOMPI_BASE_URL}/transactions",
            json=wompi_payload,
            headers=headers
        )

        if response.status_code != 201:
            error_detail = response.json() if response.text else {}
            print(f"Wompi Error: {error_detail}")
            raise HTTPException(status_code=400, detail=f"Failed to create Wompi transaction: {error_detail}")

        wompi_response = response.json()
        print(f"Wompi Response: {json.dumps(wompi_response, indent=2)}")
        
        wompi_data = wompi_response.get('data', {})
        
        # Extract checkout URL from various possible locations
        checkout_url = None
        if wompi_data.get('payment_method'):
            checkout_url = wompi_data['payment_method'].get('extra', {}).get('async_payment_url')
        
        # Fallback: Try to construct from transaction ID
        if not checkout_url and wompi_data.get('id'):
            public_key = WOMPI_PUBLIC_KEY or 'missing_key'
            transaction_id = wompi_data['id']
            checkout_url = f"https://checkout.wompi.co/l/{public_key}/{transaction_id}"

        # Store payment in database
        cursor.execute("""
            INSERT INTO payments (id, order_id, amount, currency, status, reference, wompi_transaction_id, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            str(uuid.uuid4()),
            payment.order_id,
            payment.amount,
            payment.currency,
            wompi_data.get('status', 'PENDING'),
            reference,
            wompi_data.get('id'),
            get_bogota_time()
        ))
        db.commit()

        return {
            "payment_id": wompi_data.get('id'),
            "reference": reference,
            "checkout_url": checkout_url,
            "status": wompi_data.get('status', 'PENDING')
        }

    except Exception as e:
        db.rollback()
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

            # Update payment status
            cursor.execute("""
                UPDATE payments 
                SET status = %s, payment_method = %s, updated_at = %s
                WHERE id = %s
            """, (
                transaction_data.get('status'),
                transaction_data.get('payment_method_type'),
                get_bogota_time(),
                payment['id']
            ))

            # If payment approved, update order status
            if event == 'transaction.updated' and transaction_data.get('status') == 'APPROVED':
                cursor.execute("""
                    UPDATE orders 
                    SET status = 'confirmed', payment_method = 'card'
                    WHERE id = %s
                """, (payment['order_id'],))
            
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