import mysql.connector
from database import db_config

def migrate():
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        
        print("Migrando tabla couriers...")
        
        # 1. Agregar columna user_id
        try:
            cursor.execute("ALTER TABLE couriers ADD COLUMN user_id INT AFTER id")
            print("- Columna user_id añadida.")
        except mysql.connector.Error as err:
            if err.errno == 1060: # Column already exists
                print("- Columna user_id ya existe.")
            else:
                raise err
        
        # 2. Agregar llave foránea
        try:
            cursor.execute("ALTER TABLE couriers ADD CONSTRAINT fk_courier_user FOREIGN KEY (user_id) REFERENCES users(id)")
            print("- Llave foránea añadida.")
        except mysql.connector.Error as err:
            if err.errno == 1061: # Duplicate key
                print("- Llave foránea ya existe.")
            else:
                print(f"- Nota: {err}") # Podría haber fallado por nombre duplicado, ignoramos para este script

        # 3. Vincular domi1 (ID 3 de users) al domiciliario 1
        cursor.execute("UPDATE couriers SET user_id = 3 WHERE id = 1")
        print("- Usuario 3 vinculado al domiciliario 1.")
        
        conn.commit()
        conn.close()
        print("Migración completada exitosamente.")
        
    except mysql.connector.Error as err:
        print(f"Error en la migración: {err}")

if __name__ == "__main__":
    migrate()
