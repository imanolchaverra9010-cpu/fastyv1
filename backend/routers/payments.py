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


def normalize_payment_method(payment_method: str | None) -> str:
    if not payment_method:
        return "card"

    normalized = payment_method.strip().lower()
    if normalized in ["card", "credit_card", "debit_card"]:
        return "card"
    if normalized in ["wallet", "digital_wallet"]:
        return "wallet"
    if normalized in ["transfer", "transferencia", "pse", "bank_transfer"]:
        return "transfer"
    return "card"


def parse_wompi_amount_cents(transaction_data: dict) -> int | None:
    if transaction_data is None:
        return None
    if transaction_data.get("amount_in_cents") is not None:
        return int(transaction_data["amount_in_cents"])
    if transaction_data.get("amount") is not None:
        return int(transaction_data["amount"])
    if transaction_data.get("pricing_method") is not None:
        return None
    return None


@router.post("/create", response_model=dict)
def create_payment(payment: PaymentCreate, request: Request):
    """Create a payment intent and return Wompi checkout info"""
    if not WOMPI_PUBLIC_KEY:
        raise HTTPException(status_code=500, detail="Wompi not configured (Public Key missing)")

    if payment.amount <= 0:
        raise HTTPException(status_code=400, detail="El monto del pago debe ser mayor a cero")

    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")

    frontend_url = os.getenv('FRONTEND_URL')
    if not frontend_url:
        forwarded_proto = request.headers.get('x-forwarded-proto') or request.url.scheme
        forwarded_host = request.headers.get('x-forwarded-host') or request.headers.get('host')
        if not forwarded_host:
            raise HTTPException(status_code=500, detail="Frontend URL is not configured and request host is unavailable")
        frontend_url = f"{forwarded_proto}://{forwarded_host}"

    if frontend_url.startswith("http://") and os.getenv("ENV") == "production":
        raise HTTPException(status_code=500, detail="Frontend URL must use HTTPS in production")

    cursor = db.cursor(dictionary=True)
    try:
        # Check if order exists
        cursor.execute("SELECT * FROM orders WHERE id = %s", (payment.order_id,))
        order = cursor.fetchone()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        if order['status'] not in ['pending', 'pending_payment']:
            if order['status'] == 'confirmed':
                return {
                    "status": "ALREADY_PAID",
                    "message": "Este pedido ya ha sido pagado"
                }
            raise HTTPException(status_code=400, detail=f"No se puede pagar un pedido con estado '{order['status']}'")

        if payment.customer_email is None or not payment.customer_email.strip():
            raise HTTPException(status_code=400, detail="El correo del cliente es obligatorio para el pago")

        order_total = float(order.get('total') or 0)
        if order_total <= 0:
            raise HTTPException(status_code=400, detail="El pedido tiene un total inválido")

        if float(payment.amount) != order_total:
            raise HTTPException(status_code=400, detail="El monto del pago no coincide con el total del pedido")

        if order['status'] == 'pending':
            cursor.execute("UPDATE orders SET status = 'pending_payment' WHERE id = %s", (payment.order_id,))
            cursor.execute("INSERT INTO order_status_logs (order_id, status) VALUES (%s, %s)", (payment.order_id, 'pending_payment'))

        # Create a unique reference for this payment attempt, not guessable
        reference = f"FASTYY-{payment.order_id}-{uuid.uuid4().hex[:10].upper()}"
        payment_method = normalize_payment_method(payment.payment_method)

        # Hosted Checkout flow (Redirect)
        frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3000')
        checkout_base = "https://checkout.wompi.co/p/"

        params = {
            "public-key": WOMPI_PUBLIC_KEY,
            "amount-in-cents": int(payment.amount * 100),
            "reference": reference,
            "currency": payment.currency,
            "redirect-url": f"{frontend_url}/rastreo/{payment.order_id}",
            "customer-data:email": payment.customer_email
        }

        from urllib.parse import urlencode
        checkout_url = f"{checkout_base}?{urlencode(params)}"
        print(f"Wompi checkout URL generated: {checkout_url}")
        print(f"Using frontend redirect URL: {frontend_url}/rastreo/{payment.order_id}")

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

        signature = request.headers.get('X-Wompi-Signature')
        if not signature:
            raise HTTPException(status_code=401, detail="Missing webhook signature")
        if not verify_wompi_signature(payload, signature):
            raise HTTPException(status_code=401, detail="Invalid signature")

        webhook_data = json.loads(payload)
        event = webhook_data.get('event')
        transaction_data = webhook_data.get('data', {})

        if not isinstance(transaction_data, dict) or not transaction_data.get('id'):
            raise HTTPException(status_code=400, detail="Invalid webhook payload")

        db = get_db()
        if not db:
            raise HTTPException(status_code=500, detail="Database connection failed")

        cursor = db.cursor(dictionary=True)
        try:
            # Find payment by Wompi transaction ID first, then reference
            cursor.execute(
                "SELECT * FROM payments WHERE wompi_transaction_id = %s",
                (transaction_data.get('id'),)
            )
            payment = cursor.fetchone()

            if not payment:
                cursor.execute(
                    "SELECT * FROM payments WHERE reference = %s",
                    (transaction_data.get('reference'),)
                )
                payment = cursor.fetchone()

            if not payment:
                return {"status": "ignored"}

            amount_cents = parse_wompi_amount_cents(transaction_data)
            if amount_cents is not None and amount_cents != int(payment['amount'] * 100):
                raise HTTPException(status_code=400, detail="Webhook amount does not match payment amount")

            wompi_payment_method = transaction_data.get('payment_method_type') or transaction_data.get('payment_method') or payment.get('payment_method')
            normalized_payment_method = normalize_payment_method(wompi_payment_method)
            transaction_status = (transaction_data.get('status') or '').upper()
            transaction_id = transaction_data.get('id')

            cursor.execute("""
                UPDATE payments
                SET status = %s,
                    payment_method = %s,
                    wompi_transaction_id = %s,
                    updated_at = %s
                WHERE id = %s
            """, (
                transaction_status,
                normalized_payment_method,
                transaction_id,
                get_bogota_time(),
                payment['id']
            ))

            if event == 'transaction.updated' and transaction_status == 'APPROVED':
                cursor.execute("""
                    UPDATE orders
                    SET status = 'confirmed', payment_method = %s
                    WHERE id = %s AND status IN ('pending_payment', 'pending')
                """, (normalized_payment_method, payment['order_id']))
                cursor.execute(
                    "INSERT INTO order_status_logs (order_id, status) VALUES (%s, %s)",
                    (payment['order_id'], 'confirmed')
                )

            db.commit()
            return {"status": "processed"}

        finally:
            cursor.close()
            db.close()

    except HTTPException:
        raise
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