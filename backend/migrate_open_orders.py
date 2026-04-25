import mysql.connector
from database import db_config

def migrate_open_orders():
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        
        # Check if columns exist
        cursor.execute("SHOW COLUMNS FROM orders LIKE 'order_type'")
        if not cursor.fetchone():
            print("Agregando columnas para Pedidos Abiertos...")
            cursor.execute("ALTER TABLE orders ADD COLUMN order_type ENUM('regular', 'open') DEFAULT 'regular'")
            cursor.execute("ALTER TABLE orders ADD COLUMN origin_name VARCHAR(100)")
            cursor.execute("ALTER TABLE orders ADD COLUMN origin_address VARCHAR(255)")
            cursor.execute("ALTER TABLE orders ADD COLUMN open_order_description TEXT")
            conn.commit()
            print("Columnas agregadas exitosamente.")
        else:
            print("Las columnas de Pedidos Abiertos ya existen.")
        
        cursor.close()
        conn.close()
    except mysql.connector.Error as err:
        print(f"Error: {err}")

if __name__ == "__main__":
    migrate_open_orders()
