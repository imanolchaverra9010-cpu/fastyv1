import mysql.connector
import os
from dotenv import load_dotenv
import time
from utils import log_event

# Cargar variables de entorno
load_dotenv()

# Base de datos - Railway
db_config = {
    "host": os.getenv("DATABASE_HOST"),
    "user": os.getenv("DATABASE_USER"),
    "password": os.getenv("DATABASE_PASSWORD"),
    "database": os.getenv("DATABASE_NAME"),
    "port": int(os.getenv("DATABASE_PORT") or "3306"),
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
    required = ["host", "user", "password", "database"]
    missing = [key for key in required if not db_config.get(key)]
    if missing:
        log_event("database_config_missing", "error", missing=missing)
        return None

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
                log_event("database_too_many_connections", "warning", attempt=attempt + 1)
                time.sleep(0.5) # Esperar a que otra instancia libere conexión
            else:
                log_event("database_error", "error", error=str(e), attempt=attempt + 1)
                time.sleep(0.2)
        except Exception as e:
            log_event("database_connection_error", "error", error=str(e), attempt=attempt + 1)
            time.sleep(0.2)
            
    log_event("database_connection_failed", "critical")
    return None
