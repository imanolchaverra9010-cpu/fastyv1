import mysql.connector
from database import db_config

def create_promotions_table():
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        
        sql = """
        CREATE TABLE IF NOT EXISTS promotions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            business_id VARCHAR(50) NOT NULL,
            title VARCHAR(100) NOT NULL,
            description TEXT,
            discount_percent INT,
            image_url VARCHAR(255),
            emoji VARCHAR(10),
            is_active BOOLEAN DEFAULT TRUE,
            expires_at TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
        );
        """
        cursor.execute(sql)
        conn.commit()
        print("Tabla 'promotions' creada exitosamente.")
        
        cursor.close()
        conn.close()
    except mysql.connector.Error as err:
        print(f"Error: {err}")

if __name__ == "__main__":
    create_promotions_table()
