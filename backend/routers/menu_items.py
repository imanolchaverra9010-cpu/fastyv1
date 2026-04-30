from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File
from typing import List, Optional
from database import get_db
from schemas import MenuItemCreate, MenuItemUpdate, MenuItemResponse
import mysql.connector
import os
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
        image = Image.open(io.BytesIO(contents))
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
        Si no encuentras productos, devuelve un array vacío [].
        """

        response = model.generate_content([prompt, image])
        text_response = response.text
        if "```json" in text_response:
            text_response = text_response.split("```json")[1].split("```")[0]
        elif "```" in text_response:
            text_response = text_response.split("```")[1].split("```")[0]
        
        text_response = text_response.strip()
        return json.loads(text_response)

    except Exception as e:
        print(f"Error en Gemini: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error procesando la imagen: {str(e)}")

@router.post("/{business_id}/menu", response_model=MenuItemResponse, status_code=status.HTTP_201_CREATED)
def create_menu_item(business_id: str, menu_item: MenuItemCreate):
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = db.cursor(dictionary=True)
    try:
        # Verificar que el business_id existe
        cursor.execute("SELECT id FROM businesses WHERE id = %s", (business_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")

        cursor.execute(
            """INSERT INTO menu_items (business_id, name, description, price, category, image_url, emoji, is_active) 
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
            (business_id, menu_item.name, menu_item.description, menu_item.price, 
             menu_item.category, menu_item.image_url, menu_item.emoji, menu_item.is_active)
        )
        db.commit()
        
        item_id = cursor.lastrowid
        cursor.execute("SELECT * FROM menu_items WHERE id = %s", (item_id,))
        new_item = cursor.fetchone()
        db.close()
        return new_item
    except mysql.connector.Error as err:
        db.rollback()
        db.close()
        raise HTTPException(status_code=500, detail=f"Database error: {err}")
    except Exception as e:
        db.rollback()
        db.close()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{business_id}/menu", response_model=List[MenuItemResponse])
def get_menu_items(business_id: str, active: Optional[bool] = None):
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = db.cursor(dictionary=True)
    try:
        query = "SELECT * FROM menu_items WHERE business_id = %s"
        params = [business_id]
        
        if active is not None:
            query += " AND is_active = %s"
            params.append(active)
            
        cursor.execute(query, params)
        items = cursor.fetchall()
        db.close()
        return items
    except mysql.connector.Error as err:
        db.close()
        raise HTTPException(status_code=500, detail=f"Database error: {err}")
    except Exception as e:
        db.close()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{business_id}/menu/{item_id}", response_model=MenuItemResponse)
def get_menu_item(business_id: str, item_id: int):
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM menu_items WHERE business_id = %s AND id = %s", (business_id, item_id))
        item = cursor.fetchone()
        db.close()
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Menu item not found")
        return item
    except mysql.connector.Error as err:
        db.close()
        raise HTTPException(status_code=500, detail=f"Database error: {err}")
    except Exception as e:
        db.close()
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/{business_id}/menu/{item_id}", response_model=MenuItemResponse)
def update_menu_item(business_id: str, item_id: int, menu_item_update: MenuItemUpdate):
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = db.cursor(dictionary=True)
    try:
        update_data = menu_item_update.dict(exclude_unset=True)
        if not update_data:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No data to update")
            
        query_parts = []
        params = []
        for key, value in update_data.items():
            query_parts.append(f"{key} = %s")
            params.append(value)
        
        query = f"UPDATE menu_items SET {', '.join(query_parts)} WHERE business_id = %s AND id = %s"
        params.extend([business_id, item_id])
        
        cursor.execute(query, params)
        db.commit()
        
        cursor.execute("SELECT * FROM menu_items WHERE business_id = %s AND id = %s", (business_id, item_id))
        updated_item = cursor.fetchone()
        db.close()
        if not updated_item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Menu item not found after update")
        return updated_item
    except mysql.connector.Error as err:
        db.rollback()
        db.close()
        raise HTTPException(status_code=500, detail=f"Database error: {err}")
    except Exception as e:
        db.rollback()
        db.close()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{business_id}/menu/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_menu_item(business_id: str, item_id: int):
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("DELETE FROM menu_items WHERE business_id = %s AND id = %s", (business_id, item_id))
        db.commit()
        db.close()
        return {"message": "Menu item deleted successfully"}
    except mysql.connector.Error as err:
        db.rollback()
        db.close()
        raise HTTPException(status_code=500, detail=f"Database error: {err}")
    except Exception as e:
        db.rollback()
        db.close()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{business_id}/menu/{item_id}/image")
async def upload_menu_item_image(business_id: str, item_id: int, file: UploadFile = File(...)):
    try:
        from lib.storage import upload_file
    except ImportError:
        from _storage_fallback import upload_file
    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Formato de imagen no permitido.")

    # Upload to cloud
    image_url = upload_file(file, folder="menu_items")

    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("UPDATE menu_items SET image_url = %s WHERE id = %s AND business_id = %s", (image_url, item_id, business_id))
        db.commit()
        db.close()
        return {"image_url": image_url}
    except Exception as e:
        db.rollback()
        db.close()
        raise HTTPException(status_code=500, detail=str(e))
