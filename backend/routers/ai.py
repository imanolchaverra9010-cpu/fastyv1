import os
from fastapi import APIRouter, UploadFile, File, HTTPException
import google.generativeai as genai
import json
from PIL import Image
import io

router = APIRouter()

# Configurar Gemini (se recomienda usar variable de entorno)
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

@router.post("/scan-menu")
async def scan_menu(file: UploadFile = File(...)):
    if not GEMINI_API_KEY:
        # Si no hay key, devolvemos un error informativo
        raise HTTPException(
            status_code=400, 
            detail="GEMINI_API_KEY no configurada. Por favor, añade tu API Key de Google AI Studio."
        )

    try:
        # Leer la imagen
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))

        # Configurar el modelo
        model = genai.GenerativeModel('gemini-1.5-flash')

        prompt = """
        Analiza esta imagen de un menú de restaurante. 
        Extrae todos los platos, bebidas y productos.
        Para cada producto, identifica:
        - name: Nombre del plato.
        - price: Precio numérico (sin símbolos de moneda ni puntos de miles, solo el número).
        - description: Una descripción breve de los ingredientes si están visibles.
        - category: La categoría a la que pertenece (ej: Hamburguesas, Bebidas, Entradas).
        
        Devuelve el resultado ÚNICAMENTE como un array JSON válido. 
        Ejemplo de formato:
        [
          {"name": "Hamburguesa XL", "price": 25000, "description": "Carne 200g, queso y tocino", "category": "Hamburguesas"},
          {"name": "Coca Cola", "price": 5000, "description": "Gaseosa 350ml", "category": "Bebidas"}
        ]
        Si no encuentras productos, devuelve un array vacío [].
        """

        # Generar respuesta
        response = model.generate_content([prompt, image])
        
        # Limpiar la respuesta para asegurar que solo sea JSON
        text_response = response.text
        if "```json" in text_response:
            text_response = text_response.split("```json")[1].split("```")[0]
        elif "```" in text_response:
            text_response = text_response.split("```")[1].split("```")[0]
        
        text_response = text_response.strip()
        
        try:
            items = json.loads(text_response)
            return items
        except json.JSONDecodeError:
            # Reintento simple si el formato no es perfecto
            raise HTTPException(status_code=500, detail="La IA devolvió un formato inválido. Intenta de nuevo.")

    except Exception as e:
        print(f"Error en Gemini: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error procesando la imagen: {str(e)}")
