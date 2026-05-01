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

BUSINESS_ID = "72744de5"

def load_fire_menu():
    db = get_db()
    if not db: return
    cursor = db.cursor()
    count = 0
    try:
        items = [
            # CERDO FUEGO
            {"cat": "CERDO FUEGO", "name": "Costillas al Horno (P)", "price": 41040, "desc": "Costilla tierna al horno con ensalada y guarnición."},
            {"cat": "CERDO FUEGO", "name": "Costillas al Horno (G)", "price": 59400, "desc": "Costilla tierna al horno con ensalada y guarnición."},
            {"cat": "CERDO FUEGO", "name": "Costichips (P)", "price": 41040, "desc": "Corte único bañado en el mejor chimichurri."},
            {"cat": "CERDO FUEGO", "name": "Costichips (G)", "price": 58040, "desc": "Corte único bañado en el mejor chimichurri."},
            {"cat": "CERDO FUEGO", "name": "Plato Mixto (P)", "price": 73440, "desc": "Costilla, costichips y chorizo en tres salsas."},
            {"cat": "CERDO FUEGO", "name": "Plato Mixto (G)", "price": 108000, "desc": "Costilla, costichips y chorizo en tres salsas."},
            {"cat": "CERDO FUEGO", "name": "Chicharrón de Cerdo (P)", "price": 41040, "desc": "250gr de chicharrón carnudo con guarnición y ensalada."},
            {"cat": "CERDO FUEGO", "name": "Chicharrón de Cerdo (G)", "price": 53200, "desc": "Chicharrón carnudo con guarnición y ensalada."},
            {"cat": "CERDO FUEGO", "name": "Lomo de Cerdo", "price": 43200, "desc": "Lomo de cerdo jugoso con acompañamientos."},

            # RES
            {"cat": "RES", "name": "Punta de Anca", "price": 70200, "desc": "250-300g de res nacional/importada con guarnición y ensalada."},
            {"cat": "RES", "name": "Churrasco", "price": 70200, "desc": "250-300g de carne con guarnición de preferencia."},
            {"cat": "RES", "name": "Costilla de Res", "price": 84240, "desc": "650-700g de pura carne con macarrones con queso y ensalada."},
            {"cat": "RES", "name": "New York", "price": 62640, "desc": "300-320g de carne Angus con ensalada y papas."},
            {"cat": "RES", "name": "Rib Eye", "price": 85600, "desc": "400g de carne de alto marmoleo con macarrones y ensalada."},

            # AVES Y PESCADO
            {"cat": "AVES Y PESCADO", "name": "Pollo Negro", "price": 43200, "desc": "Perniles al horno en salsa tai, quinua y especias."},
            {"cat": "AVES Y PESCADO", "name": "Pollo a la Brasa (200g)", "price": 32400, "desc": "Pechuga magra con ensalada y guarnición."},
            {"cat": "AVES Y PESCADO", "name": "Pollo a la Brasa (300g)", "price": 37800, "desc": "Pechuga magra con ensalada y guarnición."},
            {"cat": "AVES Y PESCADO", "name": "Pollo Ahumado", "price": 43200, "desc": "1/4 de pollo especiado con vegetales salteados."},
            {"cat": "AVES Y PESCADO", "name": "Atún Albacora (P)", "price": 46947, "desc": "Posta a la brasa con guarnición."},
            {"cat": "AVES Y PESCADO", "name": "Atún Albacora (G)", "price": 55654, "desc": "Posta a la brasa con guarnición."},

            # PASTAS Y MARISCOS
            {"cat": "PASTAS", "name": "Pasta Carbonara", "price": 41040, "desc": "Clásica salsa blanca con tocineta."},
            {"cat": "PASTAS", "name": "Pasta Alfredo", "price": 41040, "desc": "Salsa cremosa de mantequilla y parmesano."},
            {"cat": "PASTAS", "name": "Pasta Boloñesa", "price": 41040, "desc": "Salsa de carne tradicional."},
            {"cat": "PASTAS", "name": "Pasta al Pesto", "price": 41040, "desc": "Salsa de albahaca y frutos secos."},
            {"cat": "PASTAS", "name": "Pasta Marinera", "price": 48600, "desc": "Pasta especial con frutos del mar."},
            {"cat": "PASTAS", "name": "Pasta Atún con Pollo", "price": 48600, "desc": "Combinación especial de mar y tierra."},
            {"cat": "MARISCOS", "name": "Ceviche de Camarón", "price": 34560, "desc": ""},
            {"cat": "MARISCOS", "name": "Cazuela de Mariscos", "price": 41040, "desc": ""},
            {"cat": "MARISCOS", "name": "Salmón al Horno", "price": 45360, "desc": ""},

            # MENÚ ESPECIAL
            {"cat": "ESPECIAL", "name": "Chicharrón Apanado", "price": 37800, "desc": ""},
            {"cat": "ESPECIAL", "name": "Costillas al Panko", "price": 41040, "desc": ""},
            {"cat": "ESPECIAL", "name": "Arroz Chino (P)", "price": 32400, "desc": ""},
            {"cat": "ESPECIAL", "name": "Arroz Chino (M)", "price": 48600, "desc": ""},
            {"cat": "ESPECIAL", "name": "Arroz Chino (G)", "price": 64800, "desc": ""},

            # BEBIDAS
            {"cat": "BEBIDAS", "name": "Limonada Cerezada", "price": 16200, "desc": ""},
            {"cat": "BEBIDAS", "name": "Limonada Coco", "price": 16200, "desc": ""},
            {"cat": "BEBIDAS", "name": "Limonada de Vino", "price": 21600, "desc": ""},
            {"cat": "BEBIDAS", "name": "Limonada Yerbabuena", "price": 17280, "desc": ""},
            {"cat": "BEBIDAS", "name": "Limonada de Fresa", "price": 14040, "desc": ""},
            {"cat": "BEBIDAS", "name": "Jugo en Leche", "price": 16200, "desc": "Sabores naturales variados."},
            {"cat": "BEBIDAS", "name": "Milo Frío", "price": 16200, "desc": ""},
            {"cat": "BEBIDAS", "name": "Jarra de Jugo", "price": 30240, "desc": "1 Litro."},
            {"cat": "BEBIDAS", "name": "Jarra Limonada Cerezada", "price": 41040, "desc": ""},
            {"cat": "BEBIDAS", "name": "Michelada", "price": 12960, "desc": ""},

            # SODAS
            {"cat": "SODAS", "name": "Soda Lulo", "price": 16200, "desc": ""},
            {"cat": "SODAS", "name": "Soda Maracuyá", "price": 16200, "desc": ""},
            {"cat": "SODAS", "name": "Soda Mango", "price": 16200, "desc": ""},
            {"cat": "SODAS", "name": "Soda Frutos Rojos", "price": 16200, "desc": ""},
            {"cat": "SODAS", "name": "Soda Cerezada", "price": 16200, "desc": ""},

            # NACIONALES E IMPORTADAS
            {"cat": "CERVEZAS", "name": "Cerveza Poker/Águila", "price": 7560, "desc": ""},
            {"cat": "CERVEZAS", "name": "Club Colombia", "price": 7650, "desc": ""},
            {"cat": "CERVEZAS", "name": "Corona", "price": 10800, "desc": ""},
            {"cat": "CERVEZAS", "name": "Paulaner Cero", "price": 21600, "desc": ""},
            {"cat": "CERVEZAS", "name": "Importada Premium", "price": 21600, "desc": "Liefmans, Weidmann, Paulaner."},
            {"cat": "BEBIDAS", "name": "Coca-Cola/Gaseosa", "price": 7560, "desc": ""},
            {"cat": "CERVEZAS", "name": "Mojito", "price": 21600, "desc": ""},
            {"cat": "CERVEZAS", "name": "Four Loko", "price": 27000, "desc": ""},
        ]

        # Jugos Naturales (Agua)
        flavors = ["Lulo Chocoano", "Maracuyá", "Mango", "Fresa", "Guanábana", "Mora"]
        for f in flavors:
            items.append({"cat": "BEBIDAS", "name": f"Jugo de {f} (Agua)", "price": 9720, "desc": ""})

        for item in items:
            cursor.execute(
                "INSERT INTO menu_items (business_id, name, description, price, category, is_active) VALUES (%s, %s, %s, %s, %s, %s)",
                (BUSINESS_ID, item["name"], item["desc"], item["price"], item["cat"], True)
            )
            count += 1

        db.commit()
        print(f"Éxito: Se han cargado {count} productos para el negocio FIRE (72744de5).")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
    finally:
        cursor.close()
        db.close()

if __name__ == "__main__":
    load_fire_menu()
