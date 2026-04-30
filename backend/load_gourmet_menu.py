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

BUSINESS_ID = "082da706"

def load_gourmet_menu():
    db = get_db()
    if not db: return
    cursor = db.cursor()
    count = 0
    try:
        items = [
            # HAMBURGUESAS COCINA DE AUTOR
            {"cat": "HAMBURGUESAS", "name": "Hamburguesa Clásica", "price": 30240, "desc": "Carne artesanal, tocino, jamón y queso."},
            {"cat": "HAMBURGUESAS", "name": "Hamburguesa de Pollo", "price": 30240, "desc": "Pollo crispy, tocino, queso y salsa de parmesano."},
            {"cat": "HAMBURGUESAS", "name": "Hamburguesa de Salmón", "price": 37800, "desc": "Salmón ahumado, rúgula y salsa de la casa."},
            {"cat": "HAMBURGUESAS", "name": "Hamburguesa Chocoana", "price": 34560, "desc": "Carne artesanal, tocino, longaniza y queso parmesano."},
            {"cat": "HAMBURGUESAS", "name": "Hamburguesa Dulce Tentación", "price": 27000, "desc": "Carne artesanal, tocino, queso y maduro caramelizado."},
            
            # SMASH BURGUER
            {"cat": "HAMBURGUESAS", "name": "La Sencilla (Smash)", "price": 27000, "desc": "Carne artesanal, queso cheddar, tocino y cebolla crispy."},
            {"cat": "HAMBURGUESAS", "name": "La Doble (Smash)", "price": 37800, "desc": "Doble carne artesanal, queso cheddar, tocino y cebolla crispy."},
            {"cat": "HAMBURGUESAS", "name": "La Triple Onion (Smash)", "price": 48600, "desc": "Triple carne, triple queso, triple onion."},

            # ENTRADAS
            {"cat": "ENTRADAS", "name": "Papas Simples", "price": 17280, "desc": "Papas, tocino y especias."},
            {"cat": "ENTRADAS", "name": "Papas al Ajo", "price": 17280, "desc": "Papas, mantequilla y ajo."},
            {"cat": "ENTRADAS", "name": "Papas en Crema", "price": 17280, "desc": "Papas, especias y queso crema."},

            # SALCHIPAPAS
            {"cat": "SALCHIPAPAS", "name": "La Clásica", "price": 21600, "desc": "Papas francesas, salchicha, tocino, queso y salsas de la casa."},
            {"cat": "SALCHIPAPAS", "name": "La Rústica", "price": 30240, "desc": "Papas en cascos, salchichas, tocino, queso, jamón, lechuga, ripio y carne en bistec."},
            {"cat": "SALCHIPAPAS", "name": "La Criolla", "price": 37800, "desc": "Papas criollas, salchicha ranchera, tocino, queso, pollo, jamón, parmesano y salsas de la casa."},
            
            # ADICIONES
            {"cat": "ADICIONES", "name": "Adición Papas", "price": 8640, "desc": ""},
            {"cat": "ADICIONES", "name": "Adición Queso", "price": 5400, "desc": ""},
            {"cat": "ADICIONES", "name": "Adición Tocineta", "price": 7560, "desc": ""},
            {"cat": "ADICIONES", "name": "Adición Pollo", "price": 16200, "desc": ""},
            {"cat": "ADICIONES", "name": "Adición Salchicha", "price": 10800, "desc": ""},
            {"cat": "ADICIONES", "name": "Adición Carne", "price": 16200, "desc": ""},

            # HOT DOGS
            {"cat": "HOT DOGS", "name": "Perro Americano", "price": 21600, "desc": "Pan artesano, salchicha, ripio, cebolla, tocino y queso."},
            {"cat": "HOT DOGS", "name": "Perro de la Casa", "price": 27000, "desc": "Pan artesano, salchicha, lechuga, carne, cebolla, tocino y queso."},

            # MAICITOS
            {"cat": "MAICITOS", "name": "Maicito Tres Carnes (P)", "price": 27000, "desc": "Maíz tierno, jamón, tocineta, queso y carne."},
            {"cat": "MAICITOS", "name": "Maicito Tres Carnes (G)", "price": 37800, "desc": "Maíz tierno, jamón, tocineta, queso y carne."},
            {"cat": "MAICITOS", "name": "Maicito Pollo (P)", "price": 27000, "desc": "Maíz tierno, tocineta, queso y pollo."},
            {"cat": "MAICITOS", "name": "Maicito Pollo (G)", "price": 37800, "desc": "Maíz tierno, tocineta, queso y pollo."},

            # BURRITOS
            {"cat": "BURRITOS", "name": "Burrito de Pollo", "price": 27000, "desc": "Tortilla de harina, pollo y vegetales."},
            {"cat": "BURRITOS", "name": "Burrito de Carne", "price": 27000, "desc": "Tortilla de harina, carne y vegetales."},

            # PLATOS ESPECIALES
            {"cat": "ESPECIALES", "name": "Alitas (S)", "price": 27000, "desc": "Sabores: Picantes, BBQ o Miel Mostaza."},
            {"cat": "ESPECIALES", "name": "Alitas (G)", "price": 32400, "desc": "Sabores: Picantes, BBQ o Miel Mostaza."},
            {"cat": "ESPECIALES", "name": "Costilla Apanada", "price": 37800, "desc": "Jugosa costilla con rebozado crujiente."},
            {"cat": "ESPECIALES", "name": "Chicharrón Apanado", "price": 37800, "desc": "Chicharrón crocante apanado."},

            # BEBIDAS - LIMONADAS ESPECIALES
            {"cat": "BEBIDAS", "name": "Limonada Cerezada", "price": 17200, "desc": ""},
            {"cat": "BEBIDAS", "name": "Limonada de Coco", "price": 17200, "desc": ""},
            {"cat": "BEBIDAS", "name": "Limonada de Vino", "price": 22600, "desc": ""},
            {"cat": "BEBIDAS", "name": "Limonada Hierbabuena", "price": 18280, "desc": ""},
            {"cat": "BEBIDAS", "name": "Limonada de Fresa", "price": 15040, "desc": ""},
            
            # BEBIDAS - SODAS
            {"cat": "BEBIDAS", "name": "Soda Saborizada", "price": 17200, "desc": "Sabores: Maracuyá, Mango, Fresa, Frutos Rojos, Mora, Lulo."},
            {"cat": "BEBIDAS", "name": "Michelada", "price": 13960, "desc": ""},
            
            # CERVEZAS Y GASEOSAS
            {"cat": "BEBIDAS", "name": "Cerveza Nacional", "price": 5400, "desc": "Águila, Águila Light, Poker, Club Colombia."},
            {"cat": "BEBIDAS", "name": "Cerveza Premium", "price": 10800, "desc": "Corona, Stella Artois."},
            {"cat": "BEBIDAS", "name": "Gaseosa Personal", "price": 5400, "desc": "Coca-Cola, Postobon, etc."},
            {"cat": "BEBIDAS", "name": "Gaseosa Mega", "price": 21600, "desc": "3 Litros."},
        ]

        # Jugos Naturales (Agua y Leche)
        flavors = ["Maracuyá", "Mango", "Fresa", "Guanábana", "Mora", "Lulo Chocoano"]
        for f in flavors:
            items.append({"cat": "BEBIDAS", "name": f"Jugo de {f} (Agua)", "price": 10720, "desc": ""})
            items.append({"cat": "BEBIDAS", "name": f"Jugo de {f} (Leche)", "price": 17200, "desc": ""})

        for item in items:
            cursor.execute(
                "INSERT INTO menu_items (business_id, name, description, price, category, is_active) VALUES (%s, %s, %s, %s, %s, %s)",
                (BUSINESS_ID, item["name"], item["desc"], item["price"], item["cat"], True)
            )
            count += 1

        db.commit()
        print(f"Éxito: Se han cargado {count} productos para el negocio {BUSINESS_ID}.")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
    finally:
        cursor.close()
        db.close()

if __name__ == "__main__":
    load_gourmet_menu()
