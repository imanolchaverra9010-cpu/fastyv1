import sys
import os
from pathlib import Path

backend_path = Path(__file__).parent
sys.path.insert(0, str(backend_path))

try:
    from database import get_db
except ImportError:
    print("Error: No se pudo importar el módulo de base de datos.")
    sys.exit(1)

BUSINESS_ID = "20c1e5db"

def load_refresh_menu():
    db = get_db()
    if not db: return
    cursor = db.cursor()
    count = 0
    try:
        # GRANIZADOS
        granizados = [
            {"name": "Mangolé Clásico", "prices": {"16 onz": 16000, "12 onz": 14000, "9 onz": 11000}, "desc": "Mango con lecherita, gomitas, borde michelado de Tajín y trocitos de mango picado."},
            {"name": "Maracu mango", "prices": {"16 onz": 17500, "12 onz": 15500, "9 onz": 12500}, "desc": "Cremoso de mango y maracuyá, con lecherita, gomitas y trocitos de mango picado."},
            {"name": "Lulada", "prices": {"16 onz": 17500, "12 onz": 15500, "9 onz": 12500}, "desc": "Lulo con lecherita, gomitas, borde michelado de Tajín y trocitos de mango picado."}
        ]
        for g in granizados:
            for size, price in g["prices"].items():
                cursor.execute(
                    "INSERT INTO menu_items (business_id, name, description, price, category, is_active) VALUES (%s, %s, %s, %s, %s, %s)",
                    (BUSINESS_ID, f"{g['name']} ({size})", g["desc"], price, "GRANIZADOS", True)
                )
                count += 1

        # MICHELADAS
        micheladas = ["Pasión Atrateña (Maracuyá)", "Pacific fresh (Frutos Amarillos)", "Mangolada (Mango biche/maduro)"]
        for m in micheladas:
            # Con Cerveza
            cursor.execute(
                "INSERT INTO menu_items (business_id, name, description, price, category, is_active) VALUES (%s, %s, %s, %s, %s, %s)",
                (BUSINESS_ID, f"{m} - Con Cerveza", "Michelada frutal acompañada con cerveza fría.", 16000, "MICHELADAS", True)
            )
            # Con Soda
            cursor.execute(
                "INSERT INTO menu_items (business_id, name, description, price, category, is_active) VALUES (%s, %s, %s, %s, %s, %s)",
                (BUSINESS_ID, f"{m} - Con Soda", "Michelada frutal acompañada con soda refrescante.", 14000, "MICHELADAS", True)
            )
            count += 2

        # PALETAS
        paletas = ["Paleta Maracumango", "Paleta Mango Biche", "Paleta Maracuyá"]
        for p in paletas:
            cursor.execute(
                "INSERT INTO menu_items (business_id, name, description, price, category, is_active) VALUES (%s, %s, %s, %s, %s, %s)",
                (BUSINESS_ID, p, "Deliciosa paleta con trocitos de fruta, tajín, pimienta y limón.", 6000, "PALETAS", True)
            )
            count += 1

        # ESPECIALIDADES
        especialidades = [
            {"name": "Bandeja Ácida (Talla S)", "price": 15000, "desc": "Mezcla refrescante de frutas sazonadas con sal, limón, pimienta y tajín, opcional lecherita."},
            {"name": "Bandeja Ácida (Talla L)", "price": 17000, "desc": "Mezcla refrescante de frutas sazonadas con sal, limón, pimienta y tajín, opcional lecherita."}
        ]
        for e in especialidades:
            cursor.execute(
                "INSERT INTO menu_items (business_id, name, description, price, category, is_active) VALUES (%s, %s, %s, %s, %s, %s)",
                (BUSINESS_ID, e["name"], e["desc"], e["price"], "ESPECIALIDADES", True)
            )
            count += 1

        db.commit()
        print(f"Cargados {count} productos para el negocio refrescante (20c1e5db)")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
    finally:
        cursor.close()
        db.close()

if __name__ == "__main__":
    load_refresh_menu()
