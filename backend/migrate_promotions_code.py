import mysql.connector
from database import db_config

def migrate_promotions_code():
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        
        # Check if column exists first
        cursor.execute("SHOW COLUMNS FROM promotions LIKE 'promo_code'")
        result = cursor.fetchone()
        
        if not result:
            print("Agregando columna 'promo_code' a la tabla 'promotions'...")
            cursor.execute("ALTER TABLE promotions ADD COLUMN promo_code VARCHAR(20) AFTER discount_percent")
            conn.commit()
            print("Columna agregada exitosamente.")
        else:
            print("La columna 'promo_code' ya existe.")
        
        cursor.close()
        conn.close()
    except mysql.connector.Error as err:
        print(f"Error: {err}")

if __name__ == "__main__":
    migrate_promotions_code()
