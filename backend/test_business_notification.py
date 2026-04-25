import requests
import json
import time

def test_business_notification():
    # Simular la creación de un pedido para el negocio con ID '1'
    url = "/api/orders"
    
    order_data = {
        "business_id": "1",
        "user_id": 3,
        "customer_name": "Test Business Notif",
        "customer_phone": "3001112233",
        "delivery_address": "Avenida Principal #45",
        "payment_method": "card",
        "notes": "Llamar al llegar",
        "total": 25000,
        "latitude": 4.6097,
        "longitude": -74.0817,
        "items": [
            {
                "name": "Hamburguesa Especial",
                "price": 25000,
                "quantity": 1,
                "emoji": "🍔"
            }
        ]
    }
    
    print(f"Enviando pedido de prueba para negocio '1'...")
    try:
        response = requests.post(url, json=order_data)
        if response.status_code == 201:
            print("✅ Pedido creado! El panel de negocio '1' debería mostrar una notificación.")
            print(f"ID del pedido: {response.json().get('id')}")
        else:
            print(f"❌ Error: {response.status_code}")
            print(response.text)
    except Exception as e:
        print(f"❌ Error de conexión: {e}")

if __name__ == "__main__":
    test_business_notification()
