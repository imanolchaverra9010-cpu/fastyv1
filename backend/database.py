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
        # Aumentamos el pool para soportar más usuarios simultáneos
        return pooling.MySQLConnectionPool(
            pool_name="mypool",
            pool_size=15, # Aumentado de 2 a 15 para soportar carga masiva
            pool_reset_session=True,
            **db_config
        )
    except Exception as e:
        print(f"Error creando el pool: {e}")
        return None

db_pool = create_pool()

def get_db():
    """Obtener conexión con auto-recuperación agresiva."""
    global db_pool
    
    # 1. Intentar obtener del pool
    if db_pool:
        try:
            conn = db_pool.get_connection()
            if conn.is_connected():
                # Ping rápido para validar
                conn.ping(reconnect=True, attempts=1, delay=0)
                # Establecer zona horaria de Bogotá
                cursor = conn.cursor()
                cursor.execute("SET time_zone = '-05:00'")
                cursor.close()
                return conn
            else:
                conn.close()
        except mysql.connector.errors.PoolError:
            # Pool exhausto: invalidamos para forzar recreación o fallback
            print("Pool exhausto, intentando recuperación...")
        except Exception as e:
            print(f"Error en pool: {e}")

    # 2. Si llegamos aquí, el pool falló o está mal. 
    # Intentamos recrear el pool una vez
    try:
        db_pool = create_pool()
        if db_pool:
            conn = db_pool.get_connection()
            conn.ping(reconnect=True)
            return conn
    except:
        pass

    # 3. Fallback final: Conexión directa (Salvavidas)
    # Esto asegura que si el sistema de pool se corrompe, podamos seguir operando
    try:
        print("Usando conexión directa de emergencia...")
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        cursor.execute("SET time_zone = '-05:00'")
        cursor.close()
        return conn
    except Exception as e:
        print(f"FALLO TOTAL DE DB: {e}")
        return None
