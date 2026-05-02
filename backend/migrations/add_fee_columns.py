"""
Migration: Add delivery_fee and night_fee columns to orders table.
Run once to apply the schema change.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from database import get_db

def add_column_safe(cursor, db, column_name, column_def):
    try:
        cursor.execute(f"ALTER TABLE orders ADD COLUMN {column_name} {column_def}")
        db.commit()
        print(f"Columna {column_name} agregada correctamente.")
    except Exception as e:
        db.rollback()
        if "Duplicate column name" in str(e) or "1060" in str(e):
            print(f"Columna {column_name} ya existía, omitiendo.")
        else:
            raise e

def run():
    db = get_db()
    if not db:
        print("ERROR: No se pudo conectar a la base de datos.")
        return

    cursor = db.cursor()
    try:
        add_column_safe(cursor, db, "delivery_fee", "INT NOT NULL DEFAULT 0")
        add_column_safe(cursor, db, "night_fee", "INT NOT NULL DEFAULT 0")
        print("Migración completada exitosamente.")
    except Exception as e:
        print(f"Error en migración: {e}")
    finally:
        cursor.close()
        db.close()

if __name__ == "__main__":
    run()
