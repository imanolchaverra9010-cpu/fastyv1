"""
Migration: Add origin coordinates for open orders.
Run once in production before relying on smart assignment for open orders.
"""
import os
import sys

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
            print(f"Columna {column_name} ya existia, omitiendo.")
        else:
            raise


def run():
    db = get_db()
    if not db:
        print("ERROR: No se pudo conectar a la base de datos.")
        return

    cursor = db.cursor()
    try:
        add_column_safe(cursor, db, "origin_latitude", "DECIMAL(10, 8) NULL")
        add_column_safe(cursor, db, "origin_longitude", "DECIMAL(11, 8) NULL")
        print("Migracion completada exitosamente.")
    finally:
        cursor.close()
        db.close()


if __name__ == "__main__":
    run()
