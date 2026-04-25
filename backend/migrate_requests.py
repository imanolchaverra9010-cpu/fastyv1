import mysql.connector
from database import db_config

def migrate():
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        
        print("Migrando tabla business_requests...")
        
        # 1. Crear tabla business_requests
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS business_requests (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100) NOT NULL,
                phone VARCHAR(20) NOT NULL,
                address VARCHAR(255) NOT NULL,
                category VARCHAR(50) NOT NULL,
                description TEXT,
                menu_json JSON,
                status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("- Tabla business_requests creada.")
        
        conn.commit()
        conn.close()
        print("Migración completada exitosamente.")
        
    except mysql.connector.Error as err:
        print(f"Error en la migración: {err}")

if __name__ == "__main__":
    migrate()
