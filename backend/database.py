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

def create_pool():
    """Crear el pool de conexiones."""
    try:
        return pooling.MySQLConnectionPool(
            pool_name="mypool",
            pool_size=10,
            pool_reset_session=True,
            **db_config
        )
    except Exception as e:
        print(f"Error creando el pool de base de datos: {e}")
        return None

# Configurar el pool de conexiones inicialmente
db_pool = create_pool()

def get_db():
    """Obtener una conexión del pool asegurando que esté viva."""
    global db_pool
    
    # Si el pool no existe, intentar crearlo de nuevo (Auto-recuperación)
    if db_pool is None:
        print("Intentando re-inicializar el pool de base de datos...")
        db_pool = create_pool()
        
    if db_pool is None:
        print("Fallback: intentando conexión directa...")
        try:
            return mysql.connector.connect(**db_config)
        except Exception as e:
            print(f"Error crítico conectando a DB (directo): {e}")
            return None
            
    for attempt in range(3):
        try:
            conn = db_pool.get_connection()
            # Hacer ping para asegurar que la conexión no fue cerrada por el servidor
            conn.ping(reconnect=True, attempts=1, delay=0)
            if conn.is_connected():
                return conn
        except mysql.connector.errors.PoolError as e:
            print(f"Error del pool (Pool exhausto): {e}")
            break
        except Exception as e:
            print(f"Error obteniendo conexión del pool, reintentando... ({e})")
            # El pool a veces entrega conexiones cerradas, intentamos de nuevo
            continue
            
    # Último intento: conexión directa
    try:
        print("Fallback final: intentando conexión directa...")
        return mysql.connector.connect(**db_config)
    except Exception as e:
        print(f"Error crítico conectando a DB: {e}")
        return None
