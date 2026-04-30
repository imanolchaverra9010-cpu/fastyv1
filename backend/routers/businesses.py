from fastapi import APIRouter, HTTPException, status, UploadFile, File
from typing import List, Optional, Dict
from database import get_db
from schemas import BusinessCreate, BusinessResponse, BusinessUpdate
from datetime import datetime, timedelta
import os
import shutil
import uuid

router = APIRouter()

# Variable global para el manager de conexiones WebSocket (se setea desde main.py)
websocket_manager = None

def set_websocket_manager(manager):
    global websocket_manager
    websocket_manager = manager

@router.post("", response_model=BusinessResponse, status_code=status.HTTP_201_CREATED)
def create_business(business: BusinessCreate):
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute(
            """INSERT INTO businesses (id, name, description, category, address, phone, emoji, image_url, delivery_fee, eta, status, latitude, longitude) 
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (business.id, business.name, business.description, business.category, business.address, business.phone, 
             business.emoji, business.image_url, business.delivery_fee, business.eta, 'active', business.latitude, business.longitude)
        )
        db.commit()
        
        cursor.execute("SELECT * FROM businesses WHERE id = %s", (business.id,))
        new_business = cursor.fetchone()
        db.close()
        return new_business
    except Exception as e:
        db.rollback()
        db.close()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("", response_model=List[BusinessResponse])
@router.get("/", response_model=List[BusinessResponse])
def get_businesses(status_filter: Optional[str] = None, category: Optional[str] = None, q: Optional[str] = None):
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = db.cursor(dictionary=True)
    query = """
        SELECT DISTINCT b.*, u.username, u.email, u.visible_password
        FROM businesses b
        LEFT JOIN users u ON b.owner_id = u.id
        LEFT JOIN menu_items m ON b.id = m.business_id
        WHERE 1=1
    """
    params = []
    
    if status_filter:
        query += " AND b.status = %s"
        params.append(status_filter)
    if category:
        query += " AND b.category = %s"
        params.append(category)
    if q:
        search_term = f"%{q}%"
        query += " AND (b.name LIKE %s OR b.description LIKE %s OR m.name LIKE %s OR m.description LIKE %s)"
        params.extend([search_term, search_term, search_term, search_term])
        
    query += " ORDER BY b.rating DESC"
    
    cursor.execute(query, params)
    businesses = cursor.fetchall()
    db.close()
    return businesses

@router.get("/{business_id}", response_model=BusinessResponse)
def get_business(business_id: str):
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM businesses WHERE id = %s", (business_id,))
        business = cursor.fetchone()
        db.close()
        if not business:
            raise HTTPException(status_code=404, detail="Business not found")
        return business
    except Exception as e:
        db.close()
        raise HTTPException(status_code=500, detail=str(e))

# --- Nuevos endpoints para el Panel de Negocios ---

@router.get("/{user_id}/stats")
def get_business_stats(user_id: int):
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = db.cursor(dictionary=True)
    try:
        # 1. Obtener el business_id asociado al usuario
        cursor.execute("SELECT id FROM businesses WHERE owner_id = %s", (user_id,))
        biz = cursor.fetchone()
        
        if not biz:
            db.close()
            return {
                "business_id": None,
                "revenue_today": 0,
                "orders_today": 0,
                "top_products": [],
                "recent_orders": []
            }
        
        business_id = biz['id']
        
        # Ventas totales hoy
        today = datetime.now().date()
        cursor.execute("""
            SELECT SUM(total) as revenue, COUNT(*) as orders 
            FROM orders 
            WHERE business_id = %s AND status != 'cancelled' AND DATE(created_at) = %s
        """, (business_id, today))
        today_stats = cursor.fetchone()

        # Productos más vendidos
        cursor.execute("""
            SELECT name, SUM(quantity) as total_sold
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            WHERE o.business_id = %s AND o.status = 'delivered'
            GROUP BY name
            ORDER BY total_sold DESC
            LIMIT 5
        """, (business_id,))
        top_products = cursor.fetchall()

        # Pedidos recientes
        cursor.execute("""
            SELECT * FROM orders 
            WHERE business_id = %s 
            ORDER BY created_at DESC 
            LIMIT 10
        """, (business_id,))
        recent_orders = cursor.fetchall()

        db.close()
        return {
            "business_id": business_id,
            "revenue_today": float(today_stats['revenue'] or 0),
            "orders_today": int(today_stats['orders'] or 0),
            "top_products": top_products,
            "recent_orders": recent_orders
        }
    except Exception as e:
        db.close()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/owner/{user_id}", response_model=BusinessResponse)
def get_business_by_owner(user_id: int):
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM businesses WHERE owner_id = %s", (user_id,))
        business = cursor.fetchone()
        db.close()
        if not business:
            raise HTTPException(status_code=404, detail="No business found for this owner")
        return business
    except Exception as e:
        db.close()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{business_id}/orders")
def get_business_orders(business_id: str, status_filter: Optional[str] = None):
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    cursor = db.cursor(dictionary=True)
    try:
        query = "SELECT * FROM orders WHERE business_id = %s"
        params = [business_id]
        if status_filter:
            query += " AND status = %s"
            params.append(status_filter)
        query += " ORDER BY created_at DESC"
        
        cursor.execute(query, params)
        orders = cursor.fetchall()
        db.close()
        return orders
    except Exception as e:
        db.close()
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/{business_id}", response_model=BusinessResponse)
def update_business(business_id: str, business_update: BusinessUpdate):
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    cursor = db.cursor(dictionary=True)
    
    update_data = business_update.dict(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
        
    query = "UPDATE businesses SET "
    params = []
    for key, value in update_data.items():
        query += f"{key} = %s, "
        params.append(value)
    
    query = query.rstrip(", ") + " WHERE id = %s"
    params.append(business_id)
    
    try:
        cursor.execute(query, params)
        db.commit()
        
        cursor.execute("SELECT * FROM businesses WHERE id = %s", (business_id,))
        updated = cursor.fetchone()
        db.close()
        return updated
    except Exception as e:
        db.rollback()
        db.close()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{business_id}/image")
async def upload_business_image(business_id: str, file: UploadFile = File(...)):
    try:
        from lib.storage import upload_file
    except ImportError:
        from _storage_fallback import upload_file
    
    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Formato de imagen no permitido. Usa JPG, PNG o WebP.")

    # Upload to cloud (Cloudinary/Vercel Blob) or fallback to /tmp
    try:
        image_url = upload_file(file, folder="business_images")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al subir imagen: {str(e)}")

    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("UPDATE businesses SET image_url = %s WHERE id = %s", (image_url, business_id))
        db.commit()
        db.close()
        return {"image_url": image_url}
    except Exception as e:
        db.rollback()
        db.close()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{business_id}")
def delete_business(business_id: str):
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("DELETE FROM businesses WHERE id = %s", (business_id,))
        db.commit()
        db.close()
        return {"message": "Business deleted successfully"}
    except Exception as e:
        db.rollback()
        db.close()
        raise HTTPException(status_code=500, detail=str(e))
