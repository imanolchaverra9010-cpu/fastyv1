from mysql.connector import pooling
import os
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

# Base de datos - Usar variables de entorno o valores por defecto
db_config = {
    "host": os.getenv("DATABASE_HOST", "82.197.82.29"),
    "user": os.getenv("DATABASE_USER", "u659323332_fasty"),
    "password": os.getenv("DATABASE_PASSWORD", "Fasty2026*"),
    "database": os.getenv("DATABASE_NAME", "u659323332_fasty"),
    "port": int(os.getenv("DATABASE_PORT") or "3306"),
}

# Crear el pool de conexiones
try:
    pool = pooling.MySQLConnectionPool(
        pool_name="fasty_pool",
        pool_size=5, # Vercel serverless no necesita un pool gigante por cada instancia
        pool_reset_session=True,
        **db_config
    )
    print("Conexión Pool establecida")
except Exception as e:
    print(f"Error al crear el pool: {e}")
    pool = None

def get_db():
    if not pool:
        # Fallback a conexión única si el pool falla
        try:
            import mysql.connector
            return mysql.connector.connect(**db_config)
        except:
            return None
            
    try:
        conn = pool.get_connection()
        return conn
    except Exception as err:
        print(f"Error obteniendo conexión del pool: {err}")
        return None
