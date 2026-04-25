import mysql.connector
from database import db_config

def migrate():
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        
        print("Añadiendo columnas de coordenadas a la tabla businesses...")
        
        # 1. Agregar columna latitude
        try:
            cursor.execute("ALTER TABLE businesses ADD COLUMN latitude DECIMAL(10, 8) AFTER address")
            print("- Columna latitude añadida.")
        except mysql.connector.Error as err:
            if err.errno == 1060:  # Column already exists
                print("- Columna latitude ya existe.")
            else:
                raise err
        
        # 2. Agregar columna longitude
        try:
            cursor.execute("ALTER TABLE businesses ADD COLUMN longitude DECIMAL(11, 8) AFTER latitude")
            print("- Columna longitude añadida.")
        except mysql.connector.Error as err:
            if err.errno == 1060:  # Column already exists
                print("- Columna longitude ya existe.")
            else:
                raise err
        
        # 3. Actualizar coordenadas de los negocios existentes
        # Bogotá, Colombia - Coordenadas aproximadas
        business_coords = {
            '1': (4.6533, -74.0836),  # Pizzería Napolitana
            '2': (4.6612, -74.0736),  # Burger House
            '3': (4.6712, -74.0636),  # Sushi Zen
        }
        
        for business_id, (lat, lng) in business_coords.items():
            cursor.execute(
                "UPDATE businesses SET latitude = %s, longitude = %s WHERE id = %s",
                (lat, lng, business_id)
            )
            print(f"- Negocio {business_id} actualizado con coordenadas ({lat}, {lng})")
        
        conn.commit()
        conn.close()
        print("\nMigración completada exitosamente.")
        
    except mysql.connector.Error as err:
        print(f"Error en la migración: {err}")

if __name__ == "__main__":
    migrate()
