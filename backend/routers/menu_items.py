from fastapi import APIRouter, HTTPException, status, Depends
from typing import List, Optional
from database import get_db
from schemas import MenuItemCreate, MenuItemUpdate, MenuItemResponse
import mysql.connector

router = APIRouter()

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
        
        if cursor.rowcount == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Menu item not found")
            
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
