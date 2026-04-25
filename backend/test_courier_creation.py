"""
Script de prueba para verificar la creación automática de usuarios y domiciliarios
"""
import requests
import json

# URL base del backend
BASE_URL = "/api"

def test_create_courier_with_user():
    """
    Prueba la creación de un domiciliario con generación automática de usuario y credenciales
    """
    
    # Datos del nuevo domiciliario
    courier_data = {
        "name": "Carlos Mendez",
        "phone": "3105555555",
        "vehicle": "Moto"
    }
    
    print("=" * 60)
    print("PRUEBA: Crear domiciliario con usuario automático")
    print("=" * 60)
    print(f"\nDatos enviados:")
    print(json.dumps(courier_data, indent=2, ensure_ascii=False))
    
    try:
        # Realizar la solicitud POST
        response = requests.post(
            f"{BASE_URL}/admin/couriers",
            json=courier_data,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"\nEstatus HTTP: {response.status_code}")
        
        if response.status_code in [200, 201]:
            result = response.json()
            print("\n✅ ÉXITO: Domiciliario y usuario creados")
            print(f"\nRespuesta del servidor:")
            print(json.dumps(result, indent=2, ensure_ascii=False))
            
            # Extraer credenciales
            if "credentials" in result:
                creds = result["credentials"]
                print("\n" + "=" * 60)
                print("CREDENCIALES DEL DOMICILIARIO")
                print("=" * 60)
                print(f"Username: {creds['username']}")
                print(f"Email: {creds['email']}")
                print(f"Contraseña temporal: {creds['temporary_password']}")
                print(f"Nota: {creds['note']}")
                print("=" * 60)
        else:
            print(f"\n❌ ERROR: {response.status_code}")
            print(f"Respuesta: {response.text}")
            
    except Exception as e:
        print(f"\n❌ ERROR de conexión: {str(e)}")
        print("Asegúrate de que el servidor FastAPI está ejecutándose en /api")

if __name__ == "__main__":
    test_create_courier_with_user()
