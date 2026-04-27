import os
from dotenv import load_dotenv
from mysql.connector import pooling
import mysql.connector

load_dotenv()

db_config = {
    'host': os.getenv('DATABASE_HOST', '82.197.82.29'),
    'user': os.getenv('DATABASE_USER', 'u659323332_fasty'),
    'password': os.getenv('DATABASE_PASSWORD', 'Fasty2026*'),
    'database': os.getenv('DATABASE_NAME', 'u659323332_fasty'),
    'port': int(os.getenv('DATABASE_PORT', '3306')),
    'ssl_disabled': True
}

print('Testing with ssl_disabled=True')
try:
    pool = pooling.MySQLConnectionPool(pool_name='p1', pool_size=2, **db_config)
    conn = pool.get_connection()
    print('Success with ssl_disabled=True')
    conn.close()
except Exception as e:
    print(f'Error with ssl_disabled=True: {e}')

db_config.pop('ssl_disabled')
print('Testing without ssl_disabled')
try:
    pool = pooling.MySQLConnectionPool(pool_name='p2', pool_size=2, **db_config)
    conn = pool.get_connection()
    print('Success without ssl_disabled')
    conn.close()
except Exception as e:
    print(f'Error without ssl_disabled: {e}')
