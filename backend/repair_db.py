import mysql.connector
from database import get_db
from utils import pwd_context

def repair_users():
    try:
        conn = get_db()
        if not conn:
            print("No se pudo conectar a la base de datos.")
            return
        cursor = conn.cursor(dictionary=True)
        
        # Nueva contraseña para todos los usuarios de prueba
        password = "password123"
        new_hash = pwd_context.hash(password)
        
        print(f"Generando nuevo hash bcrypt: {new_hash}")
        
        # Actualizar usuarios de prueba específicos
        test_users = ['admin', 'negocio1', 'domi1']
        
        for username in test_users:
            cursor.execute(
                "UPDATE users SET password_hash = %s WHERE username = %s",
                (new_hash, username)
            )
            print(f"Usuario '{username}' actualizado con éxito.")
            
        conn.commit()
        cursor.close()
        conn.close()
        print("\nReparación completada. Ahora puedes iniciar sesión con 'password123'.")
        
    except mysql.connector.Error as err:
        print(f"Error de base de datos: {err}")
    except Exception as e:
        print(f"Error inesperado: {e}")

if __name__ == "__main__":
    repair_users()
