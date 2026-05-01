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
    """Crear el pool de conexiones optimizado para Serverless."""
    try:
        # En Vercel, cada instancia de función es independiente y efímera.
        # Un pool grande agota rápidamente las conexiones de MySQL (Railway).
        return pooling.MySQLConnectionPool(
            pool_name="mypool",
            pool_size=2, # Mínimo posible para permitir concurrencia básica por instancia
            pool_reset_session=True,
            **db_config
        )
    except Exception as e:
        print(f"Error creando el pool de base de datos: {e}")
        return None

# Configurar el pool de conexiones inicialmente
db_pool = create_pool()

def get_db():
    """Obtener una conexión de forma robusta."""
    global db_pool
    
    # Auto-recuperación del pool
    if db_pool is None:
        db_pool = create_pool()
        
    if db_pool is None:
        # Si falla el pool, intentamos conexión directa (sin pool)
        try:
            return mysql.connector.connect(**db_config)
        except Exception as e:
            print(f"Error crítico conectando a DB (directo): {e}")
            return None
            
    conn = None
    try:
        conn = db_pool.get_connection()
        # Verificar si la conexión es válida
        if conn.is_connected():
            conn.ping(reconnect=True, attempts=2, delay=1)
            return conn
    except Exception as e:
        print(f"Error obteniendo conexión del pool: {e}")
        if conn:
            try: conn.close()
            except: pass
            
    # Último recurso: conexión directa nueva
    try:
        return mysql.connector.connect(**db_config)
    except Exception as e:
        print(f"Error crítico en fallback final de DB: {e}")
        return None
