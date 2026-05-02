import sys
import mysql.connector
import os
from dotenv import load_dotenv

load_dotenv('backend/.env')

db_config = {
    'host': os.getenv('DATABASE_HOST', 'switchback.proxy.rlwy.net'),
    'user': os.getenv('DATABASE_USER', 'root'),
    'password': os.getenv('DATABASE_PASSWORD', 'OyDRGvdWqQwOLiknRFLmFFdhPOVuwgws'),
    'database': os.getenv('DATABASE_NAME', 'railway'),
    'port': int(os.getenv('DATABASE_PORT') or '46587'),
    'connect_timeout': 5,
}

try:
    conn = mysql.connector.connect(**db_config)
    cursor = conn.cursor(dictionary=True)
    
    # Check cancelled orders
    cursor.execute("SELECT COUNT(*) as c FROM orders WHERE status = 'cancelled'")
    cancelled_count = cursor.fetchone()['c']
    print(f'Pedidos cancelados: {cancelled_count}')
    
    conn.close()
except Exception as e:
    print('Error:', e)
