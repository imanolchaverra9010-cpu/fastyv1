import os
from fastapi import APIRouter, UploadFile, File, HTTPException
import google.generativeai as genai
import json
from PIL import Image
import io

router = APIRouter()

# Configurar Gemini
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

@router.post("/scan-menu")
async def scan_menu(file: UploadFile = File(...)):
    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=400, 
            detail="GEMINI_API_KEY no configurada. Por favor, añade tu API Key de Google AI Studio en las variables de entorno."
        )

    try:
        contents = await file.read()
        
        # Intentar autodetectar el mejor modelo disponible
        model_name = 'gemini-1.5-flash' # Default
        try:
            available_models = [m.name for m in genai.list_models() if 'generateContent' in m.supported_generation_methods]
            # Preferir flash 1.5, luego pro 1.5, luego vision clásico
            if any('gemini-1.5-flash' in m for m in available_models):
                model_name = next(m for m in available_models if 'gemini-1.5-flash' in m)
            elif any('gemini-1.5-pro' in m for m in available_models):
                model_name = next(m for m in available_models if 'gemini-1.5-pro' in m)
            elif any('gemini-pro-vision' in m for m in available_models):
                model_name = next(m for m in available_models if 'gemini-pro-vision' in m)
        except:
            pass # Si falla el listado, usamos el default

        model = genai.GenerativeModel(model_name)

        image_part = {
            "mime_type": file.content_type or "image/jpeg",
            "data": contents
        }

        prompt = """
        Analiza esta imagen de un menú de restaurante. 
        Extrae todos los platos, bebidas y productos.
        Para cada producto, identifica:
        - name: Nombre del plato.
        - price: Precio numérico (sin símbolos de moneda ni puntos de miles, solo el número).
        - description: Una descripción breve de los ingredientes si están visibles.
        - category: La categoría a la que pertenece (ej: Hamburguesas, Bebidas, Entradas).
        
        Devuelve el resultado ÚNICAMENTE como un array JSON válido. 
        Si no encuentras productos, devuelve [].
        """

        response = model.generate_content([prompt, image_part])
        text_response = response.text
        
        # Limpiar respuesta markdown si existe
        if "```json" in text_response:
            text_response = text_response.split("```json")[1].split("```")[0]
        elif "```" in text_response:
            text_response = text_response.split("```")[1].split("```")[0]
        
        text_response = text_response.strip()
        
        return json.loads(text_response)

    except Exception as e:
        print(f"Error en Gemini: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error procesando la imagen: {str(e)}")
