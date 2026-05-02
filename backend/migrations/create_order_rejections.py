"""
Migration: Create order_rejections table to track which couriers rejected which orders.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from database import get_db

def run():
    db = get_db()
    if not db:
        print("ERROR: No se pudo conectar a la base de datos.")
        return

    cursor = db.cursor()
    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS order_rejections (
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_id VARCHAR(50) NOT NULL,
                courier_id INT NOT NULL,
                rejected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_rejection (order_id, courier_id)
            )
        """)
        db.commit()
        print("Tabla order_rejections creada exitosamente.")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
    finally:
        cursor.close()
        db.close()

if __name__ == "__main__":
    run()
