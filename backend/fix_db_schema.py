import mysql.connector
from database import db_config

def fix_schema():
    try:
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        
        print("Checking businesses table...")
        # Check if latitude/longitude columns exist
        cursor.execute("SHOW COLUMNS FROM businesses")
        columns = [column[0] for column in cursor.fetchall()]
        
        if 'latitude' not in columns:
            print("Adding latitude column...")
            cursor.execute("ALTER TABLE businesses ADD COLUMN latitude DECIMAL(10, 8)")
        
        if 'longitude' not in columns:
            print("Adding longitude column...")
            cursor.execute("ALTER TABLE businesses ADD COLUMN longitude DECIMAL(11, 8)")

        print("Checking business_requests table...")
        cursor.execute("SHOW COLUMNS FROM business_requests")
        req_columns = [column[0] for column in cursor.fetchall()]

        if 'latitude' not in req_columns:
            print("Adding latitude column to business_requests...")
            cursor.execute("ALTER TABLE business_requests ADD COLUMN latitude DECIMAL(10, 8)")
        
        if 'longitude' not in req_columns:
            print("Adding longitude column to business_requests...")
            cursor.execute("ALTER TABLE business_requests ADD COLUMN longitude DECIMAL(11, 8)")
            
        # Update existing businesses with some dummy coordinates in Bogotá if they are null
        # (Optional, but helps test the fee calculation)
        print("Updating coordinates for base businesses...")
        cursor.execute("UPDATE businesses SET latitude = 4.6533, longitude = -74.0836 WHERE id = '1'")
        cursor.execute("UPDATE businesses SET latitude = 4.6712, longitude = -74.0598 WHERE id = '2'")
        cursor.execute("UPDATE businesses SET latitude = 4.6945, longitude = -74.0321 WHERE id = '3'")
        
        conn.commit()
        print("Schema fixed successfully.")
        conn.close()
    except Exception as e:
        print(f"Error fixing schema: {e}")

if __name__ == "__main__":
    fix_schema()
