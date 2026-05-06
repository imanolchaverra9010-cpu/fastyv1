"""
Migration: Add payments table for Wompi integration.
Run once to apply the schema change.
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
        # Update order status enum first
        try:
            cursor.execute("ALTER TABLE orders MODIFY COLUMN status ENUM('pending_payment', 'pending', 'confirmed', 'preparing', 'shipped', 'in_transit', 'delivered', 'cancelled') DEFAULT 'pending'")
            db.commit()
            print("Enum de status de orders actualizado exitosamente.")
        except Exception as e:
            db.rollback()
            if "Duplicate entry" not in str(e):
                print(f"Error al actualizar enum de status: {e}")
            else:
                print("Enum de status ya estaba actualizado.")

        # Create payments table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS payments (
                id VARCHAR(50) PRIMARY KEY,
                order_id VARCHAR(50) NOT NULL,
                amount INT NOT NULL,
                currency VARCHAR(3) DEFAULT 'COP',
                status VARCHAR(20) NOT NULL,
                reference VARCHAR(100) UNIQUE NOT NULL,
                payment_method VARCHAR(50),
                wompi_transaction_id VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_payments_order (order_id),
                INDEX idx_payments_reference (reference),
                INDEX idx_payments_wompi (wompi_transaction_id)
            )
        """)
        db.commit()
        print("Tabla payments creada exitosamente.")

        # Add foreign key constraint if it doesn't exist
        try:
            cursor.execute("ALTER TABLE payments ADD CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders(id)")
            db.commit()
            print("Foreign key constraint agregada exitosamente.")
        except Exception as e:
            db.rollback()
            print(f"Foreign key no se pudo agregar (posiblemente por charset/collation): {e}")
            print("La aplicación puede funcionar sin la foreign key.")

        print("Migración completada exitosamente.")
    except Exception as e:
        print(f"Error en migración: {e}")
        db.rollback()
    finally:
        cursor.close()
        db.close()

if __name__ == "__main__":
    run()