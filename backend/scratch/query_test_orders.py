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
    
    # Check specific test orders
    cursor.execute("SELECT COUNT(*) as c FROM orders WHERE id IN ('ORD-001', 'ORD-002', 'ORD-003')")
    test_orders_count = cursor.fetchone()['c']
    print(f'Pedidos de prueba iniciales (ORD-001, 002, 003): {test_orders_count}')
    
    # Check by customer name
    cursor.execute("SELECT COUNT(*) as c FROM orders WHERE customer_name LIKE '%test%' OR customer_name LIKE '%prueba%'")
    test_name_count = cursor.fetchone()['c']
    print(f'Pedidos con nombre test/prueba: {test_name_count}')
    
    # Check "test" emails in users associated with orders
    cursor.execute("""
        SELECT COUNT(o.id) as c 
        FROM orders o 
        JOIN users u ON o.user_id = u.id 
        WHERE u.email LIKE '%test%' OR u.email LIKE '%prueba%'
    """)
    test_email_count = cursor.fetchone()['c']
    print(f'Pedidos hechos por usuarios test: {test_email_count}')

    # Total orders
    cursor.execute("SELECT COUNT(*) as c FROM orders")
    total = cursor.fetchone()['c']
    print(f'Total de pedidos en la BD: {total}')
    
    conn.close()
except Exception as e:
    print('Error:', e)
