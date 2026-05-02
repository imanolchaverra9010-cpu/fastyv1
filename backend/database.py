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
    """Crear el pool de conexiones optimizado para alta concurrencia."""
    try:
        # En Serverless (Vercel), un pool muy grande es contraproducente
        # porque cada instancia tiene su propio pool.
        return pooling.MySQLConnectionPool(
            pool_name="fasty_pool",
            pool_size=5, # Reducido de 25 a 5 para evitar colapso en Vercel
            pool_reset_session=True,
            **db_config
        )
    except Exception as e:
        print(f"Error creando el pool: {e}")
        return None

db_pool = create_pool()

def get_db():
    """Obtener conexión del pool con reintentos."""
    global db_pool
    
    if not db_pool:
        db_pool = create_pool()
    
    if not db_pool:
        return None

    # Intentar obtener conexión con reintentos
    for attempt in range(2):
        try:
            conn = db_pool.get_connection()
            if conn:
                # Validar conexión
                try:
                    conn.ping(reconnect=True)
                    cursor = conn.cursor()
                    cursor.execute("SET time_zone = '-05:00'")
                    cursor.close()
                    return conn
                except:
                    conn.close()
                    continue
        except mysql.connector.errors.PoolError:
            import time
            time.sleep(0.2)
        except Exception as e:
            print(f"Error crítico DB: {e}")
            break
            
    return None
