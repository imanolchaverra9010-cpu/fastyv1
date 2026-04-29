from mysql.connector import pooling
import mysql.connector
import os
from dotenv import load_dotenv

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
    "connect_timeout": 10,
    "connection_timeout": 10,
}

# Configurar el pool de conexiones
try:
    db_pool = pooling.MySQLConnectionPool(
        pool_name="mypool",
        pool_size=10,
        pool_reset_session=True,
        **db_config
    )
except Exception as e:
    print(f"Error inicializando el pool de base de datos: {e}")
    db_pool = None

def get_db():
    """Obtener una conexión del pool asegurando que esté viva."""
    global db_pool
    if db_pool is None:
        print("El pool de base de datos no está inicializado.")
        return None
        
    for attempt in range(3):
        try:
            conn = db_pool.get_connection()
            # Hacer ping para asegurar que la conexión no fue cerrada por el servidor (común en Hostinger)
            conn.ping(reconnect=True, attempts=1, delay=0)
            if conn.is_connected():
                return conn
        except mysql.connector.errors.PoolError as e:
            print(f"Error del pool (Pool exhausto): {e}")
            break
        except Exception as e:
            print(f"Conexión muerta en el pool, reintentando... ({e})")
            # Devolver al pool la conexión rota para que la descarte y genere una nueva
            try:
                conn.close()
            except:
                pass
            
    # Fallback si el pool falla por completo
    try:
        print("Fallback: intentando conexión directa...")
        return mysql.connector.connect(**db_config)
    except Exception as e:
        print(f"Error crítico conectando a DB: {e}")
        return None
