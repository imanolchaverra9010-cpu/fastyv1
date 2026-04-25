import mysql.connector
from database import db_config

def update_couriers_table():
    try:
        db = mysql.connector.connect(**db_config)
        cursor = db.cursor()
        
        print("Añadiendo columnas faltantes a la tabla 'couriers'...")
        
        # Añadir phone si no existe
        try:
            cursor.execute("ALTER TABLE couriers ADD COLUMN phone VARCHAR(20) AFTER name")
            print("- Columna 'phone' añadida.")
        except mysql.connector.Error as err:
            if err.errno == 1060: print("- Columna 'phone' ya existe.")
            else: raise err

        # Añadir deliveries si no existe
        try:
            cursor.execute("ALTER TABLE couriers ADD COLUMN deliveries INT DEFAULT 0 AFTER rating")
            print("- Columna 'deliveries' añadida.")
        except mysql.connector.Error as err:
            if err.errno == 1060: print("- Columna 'deliveries' ya existe.")
            else: raise err

        # Añadir earnings si no existe
        try:
            cursor.execute("ALTER TABLE couriers ADD COLUMN earnings INT DEFAULT 0 AFTER deliveries")
            print("- Columna 'earnings' añadida.")
        except mysql.connector.Error as err:
            if err.errno == 1060: print("- Columna 'earnings' ya existe.")
            else: raise err
            
        db.commit()
        print("\n¡Base de datos actualizada con éxito!")
        db.close()
        
    except Exception as e:
        print(f"Error actualizando la base de datos: {e}")

if __name__ == "__main__":
    update_couriers_table()
