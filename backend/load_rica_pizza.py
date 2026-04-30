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

BUSINESS_ID = "fb91d259"
# Suffixes for Rica Pizza
PIZZA_SIZES = ["Pequeña", "Mediana", "Grande", "Extra Grande"]

menu_items = [
    # PIZZAS TANDA 1
    {"cat": "PIZZAS", "name": "Pizza Pollo BBQ", "prices": [26000, 36000, 46000, 60000], "desc": "Pollo, Tocineta, Champiñón, Salsa BBQ"},
    {"cat": "PIZZAS", "name": "Pizza Longaniza", "prices": [27000, 37000, 47000, 62000], "desc": "Cebolla, Longaniza y Tocineta"},
    {"cat": "PIZZAS", "name": "Pizza Jamón y Pollo", "prices": [24000, 34000, 41000, 53000], "desc": "Jamón y Pollo"},
    {"cat": "PIZZAS", "name": "Pizza de la Casa", "prices": [27000, 36000, 45000, 60000], "desc": "Carne de Cerdo o de Res, Cebolla, Salsa BBQ o Mostaza"},
    {"cat": "PIZZAS", "name": "Pizza Pollo y Champiñón", "prices": [24000, 34000, 41000, 54000], "desc": "Pollo y Champiñones"},
    {"cat": "PIZZAS", "name": "Pizza Napolitana", "prices": [18000, 25000, 33000, 43000], "desc": "Queso, Tomate, Orégano"},
    {"cat": "PIZZAS", "name": "Pizza Pepperoni", "prices": [24000, 34000, 41000, 54000], "desc": "Queso, Pepperoni"},
    {"cat": "PIZZAS", "name": "Pizza Carne con Vegetales", "prices": [25000, 35000, 44000, 57000], "desc": "Carne de Res, Cerdo o Pollo, Cebolla, Tomate y Champiñones"},
    
    # PIZZAS TANDA 2 (MÁS VARIEDADES)
    {"cat": "PIZZAS", "name": "Pizza Borde Queso", "prices": [29000, 39000, 49000, 66000], "desc": "Salami, Ranchera, Tocineta, Maicitos, Pollo y Champiñones"},
    {"cat": "PIZZAS", "name": "Pizza del Valle", "prices": [26000, 36000, 46000, 61000], "desc": "Cebolla, Ranchera, Chorizo, Tocineta, Jamón"},
    {"cat": "PIZZAS", "name": "Pizza Jamón y Queso", "prices": [20000, 29000, 37000, 49000], "desc": "Jamón y Queso"},
    {"cat": "PIZZAS", "name": "Pizza Hawaiana", "prices": [21000, 31000, 38000, 50000], "desc": "Jamón, Piña y Queso"},
    {"cat": "PIZZAS", "name": "Pizza Vegetal", "prices": [19000, 28000, 36000, 47000], "desc": "Cebolla, Tomate, Maicito y Champiñones"},

    # AREPIZZAS
    {"cat": "AREPIZZAS", "name": "Arepizza Sencilla", "price": 21000, "desc": "Pollo, Cebolla, Maíz, Tocineta, Salchicha"},
    {"cat": "AREPIZZAS", "name": "Arepizza Especial", "price": 23000, "desc": "Carne de Res, Cebolla, Champiñones, Tocineta"},

    # LASAÑAS
    {"cat": "LASAÑAS", "name": "Lasaña de Pollo", "price": 19000, "desc": "Pollo, Cebolla y Maicito"},
    {"cat": "LASAÑAS", "name": "Lasaña de Carne", "price": 23000, "desc": "Carne y Queso"},

    # HAMBURGUESAS
    {"cat": "HAMBURGUESAS", "name": "Hamburguesa Sencilla", "price": 22000, "desc": "Carne artesanal jugosa, queso, cebolla caramelizada y salsas"},
    {"cat": "HAMBURGUESAS", "name": "Hamburguesa Doble", "price": 26000, "desc": "Doble carne artesanal jugosa, queso, cebolla caramelizada y salsas"},

    # ALITAS
    {"cat": "ALITAS", "name": "Alitas Combo x4", "price": 18000, "desc": "Sabores: BBQ, picantes o miel mostaza"},
    {"cat": "ALITAS", "name": "Alitas Combo x6", "price": 22000, "desc": "Sabores: BBQ, picantes o miel mostaza"},
    {"cat": "ALITAS", "name": "Alitas Combo x12", "price": 34000, "desc": "Sabores: BBQ, picantes o miel mostaza"},
    {"cat": "ALITAS", "name": "Alitas Combo x20", "price": 64000, "desc": "Sabores: BBQ, picantes o miel mostaza"},

    # PARRILLA
    {"cat": "PARRILLA", "name": "Carne a la Parrilla (Res/Cerdo)", "price": 25000, "desc": "Con papas y ensalada de la casa"},
    {"cat": "PARRILLA", "name": "Pechuga Gratinada", "price": 25000, "desc": "Con queso fundido y papas"},
    {"cat": "PARRILLA", "name": "Costilla al Barril", "price": 25000, "desc": "Jugosa, ahumada y con papas"},
    {"cat": "PARRILLA", "name": "Costichip", "price": 25000, "desc": "Costilla + papas + salsas"},

    # PICADAS
    {"cat": "PICADAS", "name": "Picada Especial", "price": 30000, "desc": "Papas, chicharrón crocante, chorizo, costilla, carnes de res y cerdo + ensalada"},

    # BEBIDAS
    {"cat": "BEBIDAS", "name": "Limonada Cerezada", "price": 13000, "desc": "Limonada natural refrescante"},
    {"cat": "BEBIDAS", "name": "Limonada de Coco", "price": 13000, "desc": "Limonada cremosa de coco"},
    {"cat": "BEBIDAS", "name": "Limonada Natural", "price": 11000, "desc": "Limonada fresca"},
    {"cat": "BEBIDAS", "name": "Jugo de Mora", "price": 11000, "desc": "Jugo natural"},
    {"cat": "BEBIDAS", "name": "Jugo de Maracuyá", "price": 11000, "desc": "Jugo natural"}
]

def load_rica_pizza():
    db = get_db()
    if not db: return
    cursor = db.cursor()
    count = 0
    try:
        for item in menu_items:
            if "prices" in item:
                for i, p in enumerate(item["prices"]):
                    name = f"{item['name']} ({PIZZA_SIZES[i]})"
                    cursor.execute(
                        "INSERT INTO menu_items (business_id, name, description, price, category, is_active) VALUES (%s, %s, %s, %s, %s, %s)",
                        (BUSINESS_ID, name, item["desc"], p, item["cat"], True)
                    )
                    count += 1
            else:
                cursor.execute(
                    "INSERT INTO menu_items (business_id, name, description, price, category, is_active) VALUES (%s, %s, %s, %s, %s, %s)",
                    (BUSINESS_ID, item["name"], item["desc"], item["price"], item["cat"], True)
                )
                count += 1
        db.commit()
        print(f"Cargados {count} productos para Rica Pizza (fb91d259)")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
    finally:
        cursor.close()
        db.close()

if __name__ == "__main__":
    load_rica_pizza()
