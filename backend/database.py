from mysql.connector import pooling
import mysql.connector
import os
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

# Base de datos - TiDB Cloud (o Hostinger como fallback)
db_config = {
    "host": os.getenv("DATABASE_HOST", "gateway01.us-east-1.prod.aws.tidbcloud.com"),
    "user": os.getenv("DATABASE_USER", "1gRTnVV5VRD9GSJ.root"),
    "password": os.getenv("DATABASE_PASSWORD", "gTt2g6czLahRYgqY"),
    "database": os.getenv("DATABASE_NAME", "fasty"),
    "port": int(os.getenv("DATABASE_PORT") or "4000"),
}

# TiDB Cloud requiere SSL
ssl_config = {
    "ssl_disabled": False
}

def get_db():
    """Obtener una conexión directa a la base de datos."""
    try:
        conn = mysql.connector.connect(**db_config, **ssl_config)
        return conn
    except Exception as e:
        print(f"Error conectando a DB: {e}")
        # Intentar sin SSL (por si es desarrollo local)
        try:
            conn = mysql.connector.connect(**db_config, ssl_disabled=True)
            return conn
        except Exception as e2:
            print(f"Error sin SSL: {e2}")
            return None
