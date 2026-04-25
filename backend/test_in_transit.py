import requests
import json

def test_in_transit():
    # Primero creamos un pedido para tener un ID válido
    url_create = "/api/orders"
    order_data = {
        "business_id": "1",
        "user_id": 3,
        "customer_name": "Test In Transit",
        "customer_phone": "3000000000",
        "delivery_address": "Calle Falsa 123",
        "payment_method": "cash",
        "notes": "Prueba",
        "total": 10000,
        "latitude": 4.6,
        "longitude": -74.0,
        "items": [{"name": "Test", "price": 10000, "quantity": 1, "emoji": "🧪"}]
    }
    
    print("Creando pedido de prueba...")
    res_create = requests.post(url_create, json=order_data)
    if res_create.status_code != 201:
        print(f"Error al crear pedido: {res_create.text}")
        return
    
    order_id = res_create.json()["id"]
    print(f"Pedido creado con ID: {order_id}")
    
    # Ahora intentamos actualizar a in_transit
    url_status = f"/api/orders/{order_id}/status"
    status_data = {"status": "in_transit"}
    
    print(f"Actualizando pedido {order_id} a 'in_transit'...")
    res_status = requests.patch(url_status, json=status_data)
    
    if res_status.status_code == 200:
        print("✅ Éxito: El estado 'in_transit' ahora es aceptado por el backend.")
    else:
        print(f"❌ Error {res_status.status_code}: {res_status.text}")

if __name__ == "__main__":
    test_in_transit()
