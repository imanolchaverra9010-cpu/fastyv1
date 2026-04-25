"""
Script de prueba para verificar la creación de domiciliarios con credenciales manuales
"""
import requests
import json

# URL base del backend
BASE_URL = "http://localhost:8000"

def test_create_courier_with_manual_credentials():
    """
    Prueba la creación de un domiciliario con credenciales asignadas manualmente por el admin
    """
    
    # Datos del nuevo domiciliario
    courier_data = {
        "name": "Carlos Mendez",
        "phone": "3105555555",
        "vehicle": "Moto",
        "username": "carlos_mendez",
        "password": "Segura123"
    }
    
    print("=" * 70)
    print("PRUEBA: Crear domiciliario con credenciales manuales")
    print("=" * 70)
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
            
            # Extraer datos
            if "data" in result:
                data = result["data"]
                print("\n" + "=" * 70)
                print("DATOS DEL DOMICILIARIO CREADO")
                print("=" * 70)
                print(f"ID del Domiciliario: {result['courier_id']}")
                print(f"ID del Usuario: {result['user_id']}")
                print(f"Nombre: {data['name']}")
                print(f"Teléfono: {data['phone']}")
                print(f"Vehículo: {data['vehicle']}")
                print(f"Username: {data['username']}")
                print(f"Email: {data['email']}")
                print("=" * 70)
        else:
            print(f"\n❌ ERROR: {response.status_code}")
            print(f"Respuesta: {response.text}")
            
    except Exception as e:
        print(f"\n❌ ERROR de conexión: {str(e)}")
        print("Asegúrate de que el servidor FastAPI está ejecutándose en http://localhost:8000")


def test_duplicate_username():
    """
    Prueba que el sistema rechaza usernames duplicados
    """
    print("\n" + "=" * 70)
    print("PRUEBA: Intentar crear domiciliario con username duplicado")
    print("=" * 70)
    
    # Primer domiciliario
    courier_data_1 = {
        "name": "Juan Perez",
        "phone": "3101111111",
        "vehicle": "Bicicleta",
        "username": "juan_perez",
        "password": "Segura123"
    }
    
    # Segundo domiciliario con el mismo username
    courier_data_2 = {
        "name": "Juan Perez Otro",
        "phone": "3102222222",
        "vehicle": "Moto",
        "username": "juan_perez",  # Username duplicado
        "password": "OtraSegura123"
    }
    
    try:
        # Crear el primero
        print("\n1. Creando primer domiciliario...")
        response1 = requests.post(
            f"{BASE_URL}/admin/couriers",
            json=courier_data_1,
            headers={"Content-Type": "application/json"}
        )
        
        if response1.status_code == 200:
            print("✅ Primer domiciliario creado exitosamente")
        else:
            print(f"❌ Error al crear primer domiciliario: {response1.status_code}")
            return
        
        # Intentar crear el segundo con username duplicado
        print("\n2. Intentando crear segundo domiciliario con username duplicado...")
        response2 = requests.post(
            f"{BASE_URL}/admin/couriers",
            json=courier_data_2,
            headers={"Content-Type": "application/json"}
        )
        
        if response2.status_code == 400:
            error = response2.json()
            print(f"✅ CORRECTO: Sistema rechazó username duplicado")
            print(f"   Mensaje: {error['detail']}")
        else:
            print(f"❌ ERROR: El sistema debería rechazar usernames duplicados")
            print(f"   Respuesta: {response2.text}")
            
    except Exception as e:
        print(f"\n❌ ERROR de conexión: {str(e)}")


def test_invalid_password():
    """
    Prueba que el sistema rechaza contraseñas muy cortas
    """
    print("\n" + "=" * 70)
    print("PRUEBA: Intentar crear domiciliario con contraseña muy corta")
    print("=" * 70)
    
    courier_data = {
        "name": "Ana Garcia",
        "phone": "3103333333",
        "vehicle": "Auto",
        "username": "ana_garcia",
        "password": "123"  # Contraseña muy corta (menos de 6 caracteres)
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/admin/couriers",
            json=courier_data,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 400:
            error = response.json()
            print(f"✅ CORRECTO: Sistema rechazó contraseña muy corta")
            print(f"   Mensaje: {error['detail']}")
        else:
            print(f"❌ ERROR: El sistema debería rechazar contraseñas cortas")
            print(f"   Respuesta: {response.text}")
            
    except Exception as e:
        print(f"\n❌ ERROR de conexión: {str(e)}")


def test_empty_fields():
    """
    Prueba que el sistema rechaza campos vacíos
    """
    print("\n" + "=" * 70)
    print("PRUEBA: Intentar crear domiciliario con campos vacíos")
    print("=" * 70)
    
    courier_data = {
        "name": "",  # Campo vacío
        "phone": "3104444444",
        "vehicle": "Moto",
        "username": "test_user",
        "password": "Segura123"
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/admin/couriers",
            json=courier_data,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 400:
            error = response.json()
            print(f"✅ CORRECTO: Sistema rechazó campos vacíos")
            print(f"   Mensaje: {error['detail']}")
        else:
            print(f"❌ ERROR: El sistema debería rechazar campos vacíos")
            print(f"   Respuesta: {response.text}")
            
    except Exception as e:
        print(f"\n❌ ERROR de conexión: {str(e)}")


def run_all_tests():
    """
    Ejecuta todas las pruebas
    """
    print("\n")
    print("╔" + "=" * 68 + "╗")
    print("║" + " " * 15 + "SUITE DE PRUEBAS - CREACIÓN DE DOMICILIARIOS" + " " * 10 + "║")
    print("╚" + "=" * 68 + "╝")
    
    test_create_courier_with_manual_credentials()
    test_duplicate_username()
    test_invalid_password()
    test_empty_fields()
    
    print("\n" + "=" * 70)
    print("PRUEBAS COMPLETADAS")
    print("=" * 70)


if __name__ == "__main__":
    run_all_tests()
