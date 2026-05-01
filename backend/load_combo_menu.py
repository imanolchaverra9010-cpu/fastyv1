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

BUSINESS_ID = "b822135f"

def load_combo_menu():
    db = get_db()
    if not db: return
    cursor = db.cursor()
    count = 0
    try:
        items = [
            # COMBOS PERSONALIZADOS
            {"cat": "COMBOS", "name": "Combo Personal", "price": 19000, "desc": "1 Proteína, 4 Toppings, 2 Salsas. Proteínas: Pollo, Cerdo, Ranchera, Tocino."},
            {"cat": "COMBOS", "name": "Combo Mediano", "price": 22000, "desc": "2 Proteínas, 5 Toppings, 3 Salsas. Proteínas: Pollo, Cerdo, Ranchera, Tocino."},
            {"cat": "COMBOS", "name": "Combo Grande", "price": 38000, "desc": "4 Proteínas, 6 Toppings, 4 Salsas. Proteínas: Pollo, Cerdo, Ranchera, Tocino."},

            # SALCHIPAPAS
            {"cat": "SALCHIPAPAS", "name": "Salchipapa Personal", "price": 17000, "desc": "Salchicha ranchera, papas y salsa."},
            {"cat": "SALCHIPAPAS", "name": "Salchipapa con Tocineta", "price": 20000, "desc": "Salchicha ranchera, papas, tocineta y salsas."},
            {"cat": "SALCHIPAPAS", "name": "Salchipapa con Queso", "price": 20000, "desc": "Salchicha ranchera, queso, papas y salsas."},
            {"cat": "SALCHIPAPAS", "name": "Salchipapa Queso y Tocineta (P)", "price": 23000, "desc": "Salchicha ranchera, queso, papas, tocineta y salsas."},
            {"cat": "SALCHIPAPAS", "name": "Salchipapa Queso y Tocineta (G)", "price": 29000, "desc": "Salchicha ranchera, queso, papas, tocineta y salsas."},

            # SALCHICOSTILLA
            {"cat": "SALCHIPAPAS", "name": "Salchicostilla Personal", "price": 22000, "desc": "Salchicha ranchera, papas, costilla y salsa."},
            {"cat": "SALCHIPAPAS", "name": "Salchicostilla con Tocineta", "price": 25000, "desc": "Salchicha ranchera, papas, costilla, tocineta y salsas."},
            {"cat": "SALCHIPAPAS", "name": "Salchicostilla con Queso", "price": 25000, "desc": "Salchicha ranchera, papas, costilla, queso y salsas."},
            {"cat": "SALCHIPAPAS", "name": "Salchicostilla Queso y Tocineta (G)", "price": 35000, "desc": "Salchicha ranchera, costilla, queso, tocineta, papas y salsas."},
            {"cat": "SALCHIPAPAS", "name": "Salchicostilla Especial (G)", "price": 45000, "desc": "Salchicha ranchera, costilla, queso, tocineta, pollo, papas y salsas."},

            # SALCHIPOLLO
            {"cat": "SALCHIPAPAS", "name": "Salchipollo Personal", "price": 22000, "desc": "Salchicha ranchera, papas, pollo y salsa."},
            {"cat": "SALCHIPAPAS", "name": "Salchipollo con Tocineta", "price": 25000, "desc": "Salchicha ranchera, papas, pollo, tocineta y salsas."},
            {"cat": "SALCHIPAPAS", "name": "Salchipollo con Queso", "price": 25000, "desc": "Salchicha ranchera, pollo, queso, papas y salsas."},
            {"cat": "SALCHIPAPAS", "name": "Salchipollo Queso y Tocineta (G)", "price": 35000, "desc": "Salchicha ranchera, pollo, queso, tocineta, papas y salsas."},
            {"cat": "SALCHIPAPAS", "name": "Jumbo - Salchipapa con Todo", "price": 55000, "desc": "Salchicha ranchera, costilla, queso, tocineta, pollo, papas y salsas."},

            # HAMBURGUESAS
            {"cat": "HAMBURGUESAS", "name": "Hamburguesa Sencilla", "price": 19000, "desc": "Carne, tocineta, queso, tomate, lechuga, cebolla, ripio y salsas."},
            {"cat": "HAMBURGUESAS", "name": "Hamburguesa Pollo", "price": 19000, "desc": "Pollo, tocineta, queso, tomate, lechuga, cebolla, ripio y salsas."},
            {"cat": "HAMBURGUESAS", "name": "Hamburguesa Doble Queso", "price": 22000, "desc": "Res o pollo con queso adicional."},
            {"cat": "HAMBURGUESAS", "name": "Hamburguesa Doble Tocineta", "price": 22000, "desc": "Res o pollo con tocineta adicional."},
            {"cat": "HAMBURGUESAS", "name": "Hamburguesa Doble Carne", "price": 22000, "desc": "Dos carnes premium de res."},
            {"cat": "HAMBURGUESAS", "name": "Hamburguesa Doble Mixta", "price": 24000, "desc": "Carne premium de res y pollo."},
            {"cat": "HAMBURGUESAS", "name": "Hamburguesa con Costilla", "price": 24000, "desc": "Res o pollo y costilla."},
            {"cat": "HAMBURGUESAS", "name": "Hamburguesa Ranchera", "price": 24000, "desc": "Res o pollo y salchicha ranchera."},
            {"cat": "HAMBURGUESAS", "name": "Hamburguesa Doble Todo", "price": 30000, "desc": "Res, pollo, tocineta y queso."},
            {"cat": "ADICIONALES", "name": "Adicional Papas Francesa", "price": 7000, "desc": ""},

            # PERROS
            {"cat": "PERROS", "name": "Perro Sencillo", "price": 15000, "desc": "Salchicha, queso, cebolla, ripio y salsas."},
            {"cat": "PERROS", "name": "Perro Tocineta", "price": 17000, "desc": "Salchicha, queso, cebolla, tocineta, ripio y salsas."},
            {"cat": "PERROS", "name": "Perro Americano", "price": 18000, "desc": "Salchicha americana, tocineta, queso, cebolla, ripio y salsas."},
            {"cat": "PERROS", "name": "Perro Ranchero", "price": 19000, "desc": "Salchicha ranchera, tocineta, queso, cebolla, ripio y salsas."},
            {"cat": "PERROS", "name": "Perra", "price": 17000, "desc": "Tocineta, queso, ripio y salsas."},
            {"cat": "PERROS", "name": "Chori Perro", "price": 17000, "desc": "Chorizo, queso, cebolla, tocineta, ripio y salsas."},
            {"cat": "PERROS", "name": "Perro Doble Carril", "price": 21000, "desc": "Doble salchicha americana, tocineta, queso, cebolla, ripio y salsas."},

            # ALITAS
            {"cat": "ALITAS", "name": "6 Alitas + 1 Salsa", "price": 22000, "desc": "Incluye papas a la francesa."},
            {"cat": "ALITAS", "name": "12 Alitas + 2 Salsas", "price": 40000, "desc": "Incluye papas a la francesa."},
            {"cat": "ALITAS", "name": "18 Alitas + 2 Salsas", "price": 55000, "desc": "Incluye papas a la francesa."},
            {"cat": "ALITAS", "name": "24 Alitas + 3 Salsas", "price": 65000, "desc": "Incluye papas a la francesa."},
            {"cat": "ALITAS", "name": "30 Alitas + 3 Salsas", "price": 88000, "desc": "Incluye papas a la francesa."},

            # PICADAS
            {"cat": "PICADAS", "name": "Picada para 2", "price": 70000, "desc": "Carne, chorizo, butifarra, salchicha y papa."},
            {"cat": "PICADAS", "name": "Picada Familiar", "price": 80000, "desc": "Carne, chorizo, butifarra, costilla, salchicha y papa."},
            {"cat": "PICADAS", "name": "Picada con Todo", "price": 90000, "desc": "Carne, chorizo, butifarra, salchicha, pollo, costilla, queso, tocineta, papa y salsa."},

            # ASADOS
            {"cat": "ASADOS", "name": "Chorizo Sencillo", "price": 15000, "desc": "Incluye papa frita, limón, tomate y lechuga."},
            {"cat": "ASADOS", "name": "Chorizo con Tocineta", "price": 18000, "desc": "Incluye papa frita, limón, tomate y lechuga."},
            {"cat": "ASADOS", "name": "Chuzo de Pollo", "price": 18000, "desc": "Incluye papa frita, limón, tomate y lechuga."},
            {"cat": "ASADOS", "name": "Chuzo de Cerdo", "price": 19000, "desc": "Incluye papa frita, limón, tomate y lechuga."},
            {"cat": "ASADOS", "name": "Chuzo Cerdo Gratinado", "price": 25000, "desc": "Con queso fundido."},
            {"cat": "ASADOS", "name": "Chuzo Pollo Gratinado", "price": 23000, "desc": "Con queso fundido."},
            {"cat": "ASADOS", "name": "Chuzo Cerdo Tocineta", "price": 25000, "desc": "Con tocineta adicional."},
            {"cat": "ASADOS", "name": "Carne Cerdo a la Plancha", "price": 25000, "desc": "Incluye papa frita, limón, tomate y lechuga."},
            {"cat": "ASADOS", "name": "Carne Cerdo Gratinada", "price": 30000, "desc": "Con queso fundido."},
            {"cat": "ASADOS", "name": "Carne Cerdo Tocineta", "price": 30000, "desc": "Con tocineta adicional."},

            # ADICIONALES
            {"cat": "ADICIONALES", "name": "Porción de Queso", "price": 6000, "desc": ""},
            {"cat": "ADICIONALES", "name": "Porción de Tocineta", "price": 6000, "desc": ""},
            {"cat": "ADICIONALES", "name": "Porción de Salchicha", "price": 7000, "desc": ""},
            {"cat": "ADICIONALES", "name": "Porción de Papas", "price": 7000, "desc": ""},
            {"cat": "ADICIONALES", "name": "Porción de Maíz", "price": 3000, "desc": ""},
        ]

        for item in items:
            cursor.execute(
                "INSERT INTO menu_items (business_id, name, description, price, category, is_active) VALUES (%s, %s, %s, %s, %s, %s)",
                (BUSINESS_ID, item["name"], item["desc"], item["price"], item["cat"], True)
            )
            count += 1

        db.commit()
        print(f"Éxito: Se han cargado {count} productos para el negocio de Combos (b822135f).")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
    finally:
        cursor.close()
        db.close()

if __name__ == "__main__":
    load_combo_menu()
