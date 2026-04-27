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
}

def get_db():
    """Obtener una conexión directa a la base de datos."""
    try:
        # Intentar conexión con SSL primero (algunos servicios lo requieren)
        try:
            conn = mysql.connector.connect(**db_config, ssl_disabled=False)
            return conn
        except:
            # Fallback a conexión sin SSL (común en Hostinger)
            conn = mysql.connector.connect(**db_config, ssl_disabled=True)
            return conn
    except Exception as e:
        print(f"Error crítico conectando a DB: {e}")
        return None
