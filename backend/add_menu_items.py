import sys
import os
from pathlib import Path

# Agregar el directorio actual al path para importar database
backend_path = Path(__file__).parent
sys.path.insert(0, str(backend_path))

try:
    from database import get_db
    import mysql.connector
except ImportError:
    print("Error: No se pudo importar el módulo de base de datos.")
    sys.exit(1)

BUSINESS_ID = "6afcb0d2"

# Tamaños de pizza estándar para los 4 precios
PIZZA_SIZES = ["Personal", "Mediana", "Grande", "Familiar"]

menu_data = [
    # PIZZAS
    {
        "category": "PIZZAS",
        "items": [
            {"name": "Pizza Pollo BBQ", "prices": [26000, 36000, 46000, 60000], "desc": "Pollo, Tocineta, Champiñón, Salsa BBQ"},
            {"name": "Pizza Longaniza", "prices": [27000, 37000, 47000, 62000], "desc": "Cebolla, Longaniza y Tocineta"},
            {"name": "Pizza Jamón y Pollo", "prices": [24000, 34000, 41000, 53000], "desc": "Jamón y Pollo"},
            {"name": "Pizza de la Casa", "prices": [27000, 36000, 45000, 60000], "desc": "Carne de Cerdo o de Res, Cebolla, Salsa BBQ o Mostaza"},
            {"name": "Pizza Pollo y Champiñón", "prices": [24000, 34000, 41000, 54000], "desc": "Pollo y Champiñones"},
            {"name": "Pizza Napolitana", "prices": [18000, 25000, 33000, 43000], "desc": "Queso, Tomate, Orégano"},
            {"name": "Pizza Pepperoni", "prices": [24000, 34000, 41000, 54000], "desc": "Queso, Pepperoni"},
            {"name": "Pizza Carne con Vegetales", "prices": [25000, 35000, 44000, 57000], "desc": "Carne de Res, Cerdo o Pollo, Cebolla, Tomate y Champiñones"},
        ]
    },
    # AREPIZZAS
    {
        "category": "AREPIZZAS",
        "items": [
            {"name": "Arepizza Sencilla", "price": 21000, "desc": "Pollo, Cebolla, Maíz, Tocineta, Salchicha"},
            {"name": "Arepizza Especial", "price": 23000, "desc": "Carne de Res, Cebolla, Champiñones, Tocineta"},
        ]
    },
    # LASAÑAS
    {
        "category": "LASAÑAS",
        "items": [
            {"name": "Lasaña de Pollo", "price": 19000, "desc": "Pollo, Cebolla y Maicito"},
            {"name": "Lasaña de Carne", "price": 23000, "desc": "Carne y Queso"},
        ]
    },
    # BEBIDAS
    {
        "category": "BEBIDAS",
        "items": [
            {"name": "Limonada Cerezada", "price": 13000, "desc": "Jugo natural refrescante"},
            {"name": "Limonada de Coco", "price": 13000, "desc": "Jugo natural refrescante"},
            {"name": "Limonada Natural", "price": 11000, "desc": "Jugo natural refrescante"},
            {"name": "Jugo de Mora", "price": 11000, "desc": "Jugo natural en agua o leche"},
            {"name": "Jugo de Maracuyá", "price": 11000, "desc": "Jugo natural en agua o leche"},
        ]
    }
]

def add_items():
    db = get_db()
    if not db:
        print("No se pudo conectar a la base de datos.")
        return

    cursor = db.cursor()
    count = 0

    try:
        for section in menu_data:
            category = section["category"]
            for item in section["items"]:
                # Caso especial: Pizzas con múltiples precios
                if "prices" in item:
                    for i, price in enumerate(item["prices"]):
                        size_name = PIZZA_SIZES[i]
                        full_name = f"{item['name']} ({size_name})"
                        
                        query = "INSERT INTO menu_items (business_id, name, description, price, category, is_active) VALUES (%s, %s, %s, %s, %s, %s)"
                        values = (BUSINESS_ID, full_name, item["desc"], price, category, True)
                        cursor.execute(query, values)
                        count += 1
                else:
                    # Caso normal: Un solo precio
                    query = "INSERT INTO menu_items (business_id, name, description, price, category, is_active) VALUES (%s, %s, %s, %s, %s, %s)"
                    values = (BUSINESS_ID, item["name"], item["desc"], item["price"], category, True)
                    cursor.execute(query, values)
                    count += 1
        
        db.commit()
        print(f"Éxito: Se han agregado {count} productos al negocio {BUSINESS_ID}.")

    except Exception as e:
        db.rollback()
        print(f"Error durante la inserción: {e}")
    finally:
        cursor.close()
        db.close()

if __name__ == "__main__":
    add_items()
