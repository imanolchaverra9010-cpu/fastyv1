"""
Script to test Wompi payment integration locally.
Run: python test_wompi_payment.py
"""
import requests
import json
import os
from dotenv import load_dotenv

load_dotenv()

API_BASE = "http://localhost:8000/api"
WOMPI_PUBLIC_KEY = os.getenv("WOMPI_PUBLIC_KEY", "test_key_123")
ORDER_ID = "test-order-001"

def test_create_payment():
    """Test creating a payment"""
    print("=" * 60)
    print("Testing: Create Payment")
    print("=" * 60)
    
    payload = {
        "order_id": ORDER_ID,
        "amount": 50000,
        "currency": "COP",
        "customer_email": "test@example.com",
        "reference": f"test-{ORDER_ID}-12345"
    }
    
    print(f"\nRequest: POST {API_BASE}/payments/create")
    print(f"Payload: {json.dumps(payload, indent=2)}")
    
    try:
        response = requests.post(f"{API_BASE}/payments/create", json=payload)
        print(f"\nStatus: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code == 200:
            payment_data = response.json()
            if payment_data.get("checkout_url"):
                print(f"\n✓ Checkout URL: {payment_data['checkout_url']}")
            return payment_data
        else:
            print(f"✗ Error: {response.text}")
            return None
    except Exception as e:
        print(f"✗ Request failed: {e}")
        return None

def test_get_payment(order_id):
    """Test getting payment status"""
    print("\n" + "=" * 60)
    print("Testing: Get Payment Status")
    print("=" * 60)
    
    print(f"\nRequest: GET {API_BASE}/payments/{order_id}")
    
    try:
        response = requests.get(f"{API_BASE}/payments/{order_id}")
        print(f"\nStatus: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code == 200:
            print(f"✓ Payment found")
            return response.json()
        else:
            print(f"✗ Error: {response.text}")
            return None
    except Exception as e:
        print(f"✗ Request failed: {e}")
        return None

def test_webhook_signature():
    """Test webhook signature verification"""
    print("\n" + "=" * 60)
    print("Testing: Webhook Signature Verification")
    print("=" * 60)
    
    import hmac
    import hashlib
    
    wompi_events_key = os.getenv("WOMPI_EVENTS_KEY", "test_events_key")
    
    payload = {
        "event": "transaction.updated",
        "data": {
            "id": "wompi-trans-123",
            "status": "APPROVED",
            "reference": f"test-{ORDER_ID}"
        }
    }
    
    payload_str = json.dumps(payload)
    signature = hmac.new(
        wompi_events_key.encode(),
        payload_str.encode(),
        hashlib.sha256
    ).hexdigest()
    
    print(f"\nPayload: {json.dumps(payload, indent=2)}")
    print(f"Signature: {signature}")
    
    headers = {
        "Content-Type": "application/json",
        "X-Wompi-Signature": signature
    }
    
    print(f"\nRequest: POST {API_BASE}/payments/webhook")
    print(f"Headers: {headers}")
    
    try:
        response = requests.post(
            f"{API_BASE}/payments/webhook",
            json=payload,
            headers=headers
        )
        print(f"\nStatus: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code == 200:
            print(f"✓ Webhook processed successfully")
        else:
            print(f"✗ Webhook error: {response.text}")
    except Exception as e:
        print(f"✗ Request failed: {e}")

if __name__ == "__main__":
    print("\n🧪 WOMPI PAYMENT INTEGRATION TEST\n")
    
    # Test creating a payment
    payment = test_create_payment()
    
    if payment:
        # Test getting payment status
        test_get_payment(ORDER_ID)
        
        # Test webhook
        test_webhook_signature()
    
    print("\n" + "=" * 60)
    print("Tests completed!")
    print("=" * 60 + "\n")