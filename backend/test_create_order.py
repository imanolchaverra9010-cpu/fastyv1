import mysql.connector
from database import db_config
import uuid

def test_create_order():
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)
        
        print("--- Testing Order Creation ---")
        
        # 1. Check if at least one business exists
        cursor.execute("SELECT id FROM businesses LIMIT 1")
        business = cursor.fetchone()
        if not business:
            print("❌ Error: No businesses found in database. Cannot create order.")
            return
        
        business_id = business['id']
        order_id = str(uuid.uuid4())[:8]
        
        print(f"Using business_id: {business_id}")
        print(f"Generated order_id: {order_id}")
        
        try:
            # Attempt to insert order
            print("Attempting to insert into 'orders'...")
            cursor.execute(
                """INSERT INTO orders (id, business_id, customer_name, customer_phone, 
                   delivery_address, payment_method, notes, total, latitude, longitude, status) 
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (order_id, business_id, "Test User", "555-1234",
                 "Test Address", "card", "Test notes", 10000, 
                 4.6097, -74.0817, 'pending')
            )
            print("Successfully inserted into 'orders'.")
            
            # Attempt to insert log
            print("Attempting to insert into 'order_status_logs'...")
            cursor.execute(
                "INSERT INTO order_status_logs (order_id, status) VALUES (%s, %s)",
                (order_id, 'pending')
            )
            print("Successfully inserted into 'order_status_logs'.")
            
            # Attempt to insert item
            print("Attempting to insert into 'order_items'...")
            cursor.execute(
                "INSERT INTO order_items (order_id, name, price, quantity, emoji) VALUES (%s, %s, %s, %s, %s)",
                (order_id, "Test Item", 10000, 1, "PIZZA")
            )
            print("Successfully inserted into 'order_items'.")
            
            conn.commit()
            print("\nTRANSACTION COMMITTED SUCCESSFULLY!")
            
        except mysql.connector.Error as err:
            conn.rollback()
            print(f"Database Error during transaction: {err}")
            print(f"   Error Code: {err.errno}")
            print(f"   SQL State: {err.sqlstate}")
            print(f"   Message: {err.msg}")
            
        conn.close()
    except mysql.connector.Error as err:
        print(f"Connection Error: {err}")

if __name__ == "__main__":
    test_create_order()
