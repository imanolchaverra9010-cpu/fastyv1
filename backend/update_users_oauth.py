from database import get_db

def update_users_table():
    db = get_db()
    if not db:
        print("Database connection failed")
        return
    
    cursor = db.cursor()
    try:
        # Añadir columnas para OAuth
        print("Añadiendo columnas para OAuth a la tabla users...")
        cursor.execute("ALTER TABLE users ADD COLUMN provider VARCHAR(20) DEFAULT 'local'")
        cursor.execute("ALTER TABLE users ADD COLUMN provider_id VARCHAR(100) DEFAULT NULL")
        cursor.execute("ALTER TABLE users ADD COLUMN avatar_url VARCHAR(255) DEFAULT NULL")
        
        # Hacer password_hash opcional para usuarios OAuth
        cursor.execute("ALTER TABLE users MODIFY password_hash VARCHAR(255) DEFAULT NULL")
        
        db.commit()
        print("Tabla users actualizada con éxito")
    except Exception as e:
        print(f"Error actualizando la tabla: {e}")
        db.rollback()
    finally:
        cursor.close()
        db.close()

if __name__ == "__main__":
    update_users_table()
