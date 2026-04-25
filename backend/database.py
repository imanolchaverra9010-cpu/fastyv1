import mysql.connector
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
    "port": int(os.getenv("DATABASE_PORT", "3306"))
}

def get_db():
    try:
        conn = mysql.connector.connect(**db_config)
        return conn
    except mysql.connector.Error as err:
        print(f"Error: {err}")
        return None
