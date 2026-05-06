import mysql.connector
from database import db_config

def fix_enum():
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        
        print("Actualizando ENUM de status en la tabla orders...")
        
        # Modificar la columna status para incluir 'in_transit'
        try:
            cursor.execute("ALTER TABLE orders MODIFY COLUMN status ENUM('pending_payment', 'pending', 'confirmed', 'preparing', 'shipped', 'in_transit', 'delivered', 'cancelled') DEFAULT 'pending'")
            print("- Columna status actualizada exitosamente.")
        except mysql.connector.Error as err:
            print(f"- Error al actualizar la columna: {err}")
            raise err
        
        conn.commit()
        conn.close()
        print("Proceso completado.")
        
    except mysql.connector.Error as err:
        print(f"Error de conexión: {err}")

if __name__ == "__main__":
    fix_enum()
