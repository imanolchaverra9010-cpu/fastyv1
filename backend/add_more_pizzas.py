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

BUSINESS_ID = "6afcb0d2"
PIZZA_SIZES = ["Personal", "Mediana", "Grande", "Familiar"]

new_pizzas = [
    {"name": "Pizza Borde Queso", "prices": [29000, 39000, 49000, 66000], "desc": "Salami, Ranchera, Tocineta, Maicitos, Pollo y Champiñones"},
    {"name": "Pizza del Valle", "prices": [26000, 36000, 46000, 61000], "desc": "Cebolla, Ranchera, Chorizo, Tocineta, Jamón"},
    {"name": "Pizza Jamón y Queso", "prices": [20000, 29000, 37000, 49000], "desc": "Jamón y Queso"},
    {"name": "Pizza Hawaiana", "prices": [21000, 31000, 38000, 50000], "desc": "Jamón, Piña y Queso"},
    {"name": "Pizza Vegetal", "prices": [19000, 28000, 36000, 47000], "desc": "Cebolla, Tomate, Maicito y Champiñones"},
]

def add_more_pizzas():
    db = get_db()
    if not db:
        print("No se pudo conectar a la base de datos.")
        return

    cursor = db.cursor()
    count = 0

    try:
        category = "PIZZAS"
        for pizza in new_pizzas:
            for i, price in enumerate(pizza["prices"]):
                size_name = PIZZA_SIZES[i]
                full_name = f"{pizza['name']} ({size_name})"
                
                query = "INSERT INTO menu_items (business_id, name, description, price, category, is_active) VALUES (%s, %s, %s, %s, %s, %s)"
                values = (BUSINESS_ID, full_name, pizza["desc"], price, category, True)
                cursor.execute(query, values)
                count += 1
        
        db.commit()
        print(f"Éxito: Se han agregado {count} nuevas variedades de pizza al negocio {BUSINESS_ID}.")

    except Exception as e:
        db.rollback()
        print(f"Error durante la inserción: {e}")
    finally:
        cursor.close()
        db.close()

if __name__ == "__main__":
    add_more_pizzas()
