import mysql.connector
from database import db_config

def migrate():
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        
        print("Añadiendo columna 'password' a la tabla business_requests...")
        
        # Añadir columna password si no existe
        cursor.execute("""
            ALTER TABLE business_requests 
            ADD COLUMN IF NOT EXISTS password VARCHAR(255) AFTER menu_json
        """)
        
        conn.commit()
        conn.close()
        print("Migración completada exitosamente.")
        
    except mysql.connector.Error as err:
        print(f"Error en la migración: {err}")

if __name__ == "__main__":
    migrate()
