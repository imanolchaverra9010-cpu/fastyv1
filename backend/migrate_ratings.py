import mysql.connector
from database import db_config

def create_ratings_table():
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        
        sql = """
        CREATE TABLE IF NOT EXISTS order_ratings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            order_id VARCHAR(50) NOT NULL,
            business_id VARCHAR(50) NOT NULL,
            courier_id INT,
            business_rating INT NOT NULL,
            courier_rating INT,
            comment TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (order_id) REFERENCES orders(id),
            FOREIGN KEY (business_id) REFERENCES businesses(id),
            FOREIGN KEY (courier_id) REFERENCES couriers(id)
        );
        """
        cursor.execute(sql)
        
        # Check if is_rated exists in orders
        cursor.execute("SHOW COLUMNS FROM orders LIKE 'is_rated'")
        if not cursor.fetchone():
            print("Agregando columna 'is_rated' a orders...")
            cursor.execute("ALTER TABLE orders ADD COLUMN is_rated BOOLEAN DEFAULT FALSE")
            
        conn.commit()
        print("Tablas y columnas de calificación preparadas exitosamente.")
        
        cursor.close()
        conn.close()
    except mysql.connector.Error as err:
        print(f"Error: {err}")

if __name__ == "__main__":
    create_ratings_table()
