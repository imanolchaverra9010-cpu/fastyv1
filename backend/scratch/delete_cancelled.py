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
    
    # First get the IDs of the cancelled orders
    cursor.execute("SELECT id FROM orders WHERE status = 'cancelled'")
    cancelled_orders = cursor.fetchall()
    
    if not cancelled_orders:
        print("No hay pedidos cancelados para eliminar.")
    else:
        order_ids = [order['id'] for order in cancelled_orders]
        placeholders = ', '.join(['%s'] * len(order_ids))
        
        # 1. Delete order items
        cursor.execute(f"DELETE FROM order_items WHERE order_id IN ({placeholders})", order_ids)
        print(f"Items de pedido eliminados: {cursor.rowcount}")
        
        # 2. Delete order logs
        cursor.execute(f"DELETE FROM order_status_logs WHERE order_id IN ({placeholders})", order_ids)
        print(f"Logs de estado eliminados: {cursor.rowcount}")
        
        # 3. Delete orders
        cursor.execute(f"DELETE FROM orders WHERE id IN ({placeholders})", order_ids)
        print(f"Pedidos eliminados: {cursor.rowcount}")
        
        conn.commit()
        print("Eliminación completada con éxito.")
    
    conn.close()
except Exception as e:
    print('Error:', e)
