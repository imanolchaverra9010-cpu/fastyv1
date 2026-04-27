from mysql.connector import pooling
import mysql.connector
import os
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

# Base de datos - Hostinger (Default)
db_config = {
    "host": os.getenv("DATABASE_HOST", "82.197.82.29"),
    "user": os.getenv("DATABASE_USER", "u659323332_fasty"),
    "password": os.getenv("DATABASE_PASSWORD", "Fasty2026*"),
    "database": os.getenv("DATABASE_NAME", "u659323332_fasty"),
    "port": int(os.getenv("DATABASE_PORT") or "3306"),
    "ssl_disabled": True
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
    """Obtener una conexión del pool."""
    if db_pool is None:
        print("El pool de base de datos no está inicializado.")
        return None
        
    try:
        conn = db_pool.get_connection()
        if conn.is_connected():
            return conn
    except mysql.connector.errors.PoolError as e:
        print(f"Error del pool (Pool exhausto o conexión fallida): {e}")
        return None
    except Exception as e:
        print(f"Error crítico conectando a DB desde el pool: {e}")
        return None
