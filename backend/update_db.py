import mysql.connector
from database import db_config

def update_schema():
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        
        # Check if image_url exists
        cursor.execute("DESCRIBE couriers")
        columns = [col[0] for col in cursor.fetchall()]
        
        if 'image_url' not in columns:
            print("Adding image_url column to couriers table...")
            cursor.execute("ALTER TABLE couriers ADD COLUMN image_url VARCHAR(255) AFTER vehicle")
            conn.commit()
            print("Column added successfully.")
        else:
            print("image_url column already exists.")
            
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    update_schema()
