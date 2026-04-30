import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from database import get_db
import json
from datetime import timedelta

def test_serialization():
    db = get_db()
    if not db: 
        print("No DB connection")
        return
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM businesses LIMIT 1")
        biz = cursor.fetchone()
        print("Raw DB row:", biz)
        
        # Intentar simular lo que hace FastAPI (convertir a JSON)
        def default(obj):
            if isinstance(obj, timedelta):
                return str(obj)
            return str(obj)
            
        json_str = json.dumps(biz, default=default)
        print("Serialized JSON:", json_str)
        print("¡La serialización manual funcionó!")
    except Exception as e:
        print(f"Error en serialización: {e}")
    finally:
        cursor.close()
        db.close()

if __name__ == "__main__":
    test_serialization()
