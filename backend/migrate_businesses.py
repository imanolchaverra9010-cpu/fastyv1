import mysql.connector
from database import db_config

def migrate():
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        
        print("Migrando tabla businesses...")
        
        # 1. Agregar columna owner_id
        try:
            cursor.execute("ALTER TABLE businesses ADD COLUMN owner_id INT AFTER id")
            print("- Columna owner_id añadida.")
        except mysql.connector.Error as err:
            if err.errno == 1060: # Column already exists
                print("- Columna owner_id ya existe.")
            else:
                raise err
        
        # 2. Agregar llave foránea
        try:
            cursor.execute("ALTER TABLE businesses ADD CONSTRAINT fk_business_owner FOREIGN KEY (owner_id) REFERENCES users(id)")
            print("- Llave foránea añadida.")
        except mysql.connector.Error as err:
            if err.errno == 1061: # Duplicate key
                print("- Llave foránea ya existe.")
            else:
                print(f"- Nota: {err}")

        # 3. Vincular negocio1 (ID 2 de users) al negocio '1' (Pizzería)
        cursor.execute("UPDATE businesses SET owner_id = 2 WHERE id = '1'")
        print("- Usuario 2 vinculado al negocio '1'.")
        
        conn.commit()
        conn.close()
        print("Migración completada exitosamente.")
        
    except mysql.connector.Error as err:
        print(f"Error en la migración: {err}")

if __name__ == "__main__":
    migrate()
