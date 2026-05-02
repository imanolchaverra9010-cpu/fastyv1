"""
Migration: Add origin coordinates for open orders.
Run once in production before relying on smart assignment for open orders.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from database import get_db


def add_column_safe(cursor, db, column_name, column_def):
    try:
        cursor.execute(f"ALTER TABLE orders ADD COLUMN {column_name} {column_def}")
        db.commit()
        print(f"Columna {column_name} agregada correctamente.")
    except Exception as e:
        db.rollback()
        if "Duplicate column name" in str(e) or "1060" in str(e):
            print(f"Columna {column_name} ya existia, omitiendo.")
        else:
            raise


def run():
    db = get_db()
    if not db:
        print("ERROR: No se pudo conectar a la base de datos.")
        return

    cursor = db.cursor()
    try:
        add_column_safe(cursor, db, "origin_latitude", "DECIMAL(10, 8) NULL")
        add_column_safe(cursor, db, "origin_longitude", "DECIMAL(11, 8) NULL")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS order_courier_offers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_id VARCHAR(50) NOT NULL,
                courier_id INT NOT NULL,
                user_id INT NOT NULL,
                amount INT NOT NULL,
                status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_order_courier_offer (order_id, courier_id),
                INDEX idx_order_courier_offers_order (order_id),
                INDEX idx_order_courier_offers_courier (courier_id),
                INDEX idx_order_courier_offers_user (user_id)
            )
        """)
        db.commit()
        print("Migracion completada exitosamente.")
    finally:
        cursor.close()
        db.close()


if __name__ == "__main__":
    run()
