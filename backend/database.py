import mysql.connector
import os
from dotenv import load_dotenv
import time

# Cargar variables de entorno
load_dotenv()

# Base de datos - Railway
db_config = {
    "host": os.getenv("DATABASE_HOST", "switchback.proxy.rlwy.net"),
    "user": os.getenv("DATABASE_USER", "root"),
    "password": os.getenv("DATABASE_PASSWORD", "OyDRGvdWqQwOLiknRFLmFFdhPOVuwgws"),
    "database": os.getenv("DATABASE_NAME", "railway"),
    "port": int(os.getenv("DATABASE_PORT") or "46587"),
    "ssl_disabled": False,
    "ssl_verify_cert": False,
    "ssl_verify_identity": False,
    "connect_timeout": 5,
    "charset": "utf8mb4",
    "collation": "utf8mb4_general_ci",
    "use_unicode": True,
}

def get_db():
    """
    Obtener conexión directa a la base de datos optimizada para Serverless (Vercel).
    No usamos Connection Pooling porque cada instancia Lambda levantaría su propio pool,
    multiplicando drásticamente las conexiones activas y causando el error 
    '1040: Too many connections' en el servidor MySQL.
    """
    for attempt in range(3):
        try:
            conn = mysql.connector.connect(**db_config)
            if conn.is_connected():
                # Forzar charset/collation de sesión consistente con las tablas existentes
                try:
                    conn.set_charset_collation('utf8mb4', 'utf8mb4_general_ci')
                except Exception:
                    pass
                cursor = conn.cursor()
                cursor.execute("SET time_zone = '-05:00'")
                cursor.execute("SET NAMES utf8mb4 COLLATE utf8mb4_general_ci")
                cursor.close()
                return conn
        except mysql.connector.errors.DatabaseError as e:
            # 1040 es 'Too many connections'
            if getattr(e, 'errno', 0) == 1040:
                print(f"Servidor lleno (1040). Reintentando {attempt+1}/3...")
                time.sleep(0.5) # Esperar a que otra instancia libere conexión
            else:
                print(f"Error de BD: {e}")
                time.sleep(0.2)
        except Exception as e:
            print(f"Error de conexión: {e}")
            time.sleep(0.2)
            
    print("CRÍTICO: No se pudo obtener conexión a la BD tras múltiples intentos.")
    return None
