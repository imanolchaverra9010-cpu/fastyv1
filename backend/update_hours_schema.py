import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from database import get_db

def update_schema():
    db = get_db()
    if not db: return
    cursor = db.cursor()
    
    # Intentar agregar columnas una por una
    columns = [
        "ALTER TABLE businesses ADD COLUMN opening_time TIME DEFAULT '08:00:00'",
        "ALTER TABLE businesses ADD COLUMN closing_time TIME DEFAULT '22:00:00'"
    ]
    
    for sql in columns:
        try:
            cursor.execute(sql)
            print(f"Ejecutado: {sql}")
        except Exception as e:
            print(f"Omitido (probablemente ya existe): {e}")
            
    db.commit()
    cursor.close()
    db.close()
    print("Esquema de base de datos actualizado correctamente.")

if __name__ == "__main__":
    update_schema()
