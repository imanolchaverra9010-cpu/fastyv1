import sys
import os
sys.path.append(os.path.join(os.getcwd(), "backend"))
from database import get_db

def create_push_table():
    db = get_db()
    if not db:
        print("Failed to connect to database")
        return
    
    cursor = db.cursor()
    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS push_subscriptions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                subscription_json TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
        db.commit()
        print("Table push_subscriptions created or already exists.")
    except Exception as e:
        print(f"Error creating table: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    create_push_table()
