import mysql.connector
from database import db_config

def update_businesses():
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        
        businesses = [
            ('4', 'Pizza Forno', 'Italiana', 4.9, '🍕', 4000, '30-45 min', 'active'),
            ('5', 'Tacos El Patrón', 'Mexicana', 4.5, '🌮', 3000, '20-30 min', 'pending'),
            ('6', 'Verde Bowl', 'Saludable', 4.4, '🥗', 4500, '15-25 min', 'active'),
            ('7', 'Café Aurora', 'Cafetería', 4.8, '☕', 2500, '10-20 min', 'paused'),
            ('8', 'Dulce Antojo', 'Postres', 4.9, '🍰', 3500, '20-30 min', 'active')
        ]
        
        query = "INSERT IGNORE INTO businesses (id, name, category, rating, emoji, delivery_fee, eta, status) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)"
        cursor.executemany(query, businesses)
        
        conn.commit()
        print(f"Successfully updated businesses. Rows affected: {cursor.rowcount}")
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    update_businesses()
