import os
import json
import google.generativeai as genai
import pandas as pd

# 1. CONFIGURACIÓN
# Sustituye 'TU_API_KEY_AQUÍ' por tu clave real de Google AI Studio
API_KEY = 'TU_API_KEY_AQUÍ'
genai.configure(api_key=API_KEY)

def procesar_menu(ruta_imagen):
    """
    Usa Gemini para extraer datos de una imagen de menú y guardarlos en Excel.
    """
    print(f"--- Iniciando procesamiento de: {ruta_imagen} ---")
    
    # 2. SELECCIÓN DEL MODELO (Flash es más rápido y económico para OCR)
    model = genai.GenerativeModel('gemini-1.5-flash')

    # 3. CARGA DE LA IMAGEN
    # Es necesario subir el archivo a la API de Google temporalmente
    try:
        sample_file = genai.upload_file(path=ruta_imagen, display_name="Menu de Restaurante")
        print("Imagen cargada exitosamente.")
    except Exception as e:
        return f"Error al cargar la imagen: {e}"

    # 4. EL PROMPT (Instrucciones precisas para la IA)
    prompt = """
    Analiza la imagen de este menú de restaurante. 
    Extrae todos los platos y bebidas disponibles.
    Devuelve los datos estrictamente en un formato JSON que sea una lista de objetos.
    Cada objeto debe tener estas llaves: 
    - "categoria": (ej. Entradas, Platos Fuertes, Bebidas)
    - "plato": (nombre del producto)
    - "descripcion": (detalles o ingredientes si aparecen, si no, poner "Sin descripción")
    - "precio": (solo el número, sin símbolos de moneda)

    No incluyas explicaciones, solo el bloque JSON.
    """

    # 5. GENERACIÓN DE CONTENIDO
    response = model.generate_content([prompt, sample_file])
    
    # Limpiar la respuesta (a veces la IA pone marcas de código ```json)
    texto_limpio = response.text.replace('```json', '').replace('```', '').strip()

    try:
        datos_json = json.loads(texto_limpio)
        
        # 6. CREACIÓN DEL EXCEL CON PANDAS
        df = pd.DataFrame(datos_json)
        
        nombre_excel = "Menu_Extraido.xlsx"
        df.to_excel(nombre_excel, index=False)
        
        print(f"¡Éxito! Datos guardados en: {nombre_excel}")
        return nombre_excel

    except Exception as e:
        print("Error al parsear el JSON o generar el Excel.")
        print("Respuesta raw de la IA:", texto_limpio)
        return str(e)

if __name__ == "__main__":
    # Asegúrate de tener una imagen llamada 'menu.jpg' en la misma carpeta
    # o cambia el nombre aquí abajo.
    archivo_imagen = "menu.jpg" 
    
    if os.path.exists(archivo_imagen):
        procesar_menu(archivo_imagen)
    else:
        print(f"No se encontró el archivo {archivo_imagen}. Por favor, verifica la ruta.")