import requests
import json
import time

def simulate_order():
    url = "http://localhost:8000/orders"
    
    # Datos del pedido de prueba
    order_data = {
        "business_id": "1",
        "user_id": 3, # Domiciliario de prueba
        "customer_name": "Cliente de Prueba",
        "customer_phone": "3000000000",
        "delivery_address": "Calle Falsa 123",
        "payment_method": "card",
        "notes": "Dejar en portería",
        "total": 45000,
        "latitude": 4.6712,
        "longitude": -74.0598,
        "items": [
            {
                "name": "Pizza Pepperoni",
                "price": 35000,
                "quantity": 1,
                "emoji": "🍕"
            },
            {
                "name": "Coca Cola",
                "price": 10000,
                "quantity": 1,
                "emoji": "🥤"
            }
        ]
    }
    
    print(f"Enviando pedido de prueba a {url}...")
    try:
        response = requests.post(url, json=order_data)
        if response.status_code == 201:
            print("✅ Pedido creado exitosamente!")
            print(f"Respuesta: {response.json()}")
        else:
            print(f"❌ Error al crear el pedido: {response.status_code}")
            print(f"Detalle: {response.text}")
    except Exception as e:
        print(f"❌ Error de conexión: {e}")

if __name__ == "__main__":
    simulate_order()
