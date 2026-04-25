from fastapi import APIRouter, HTTPException, status, UploadFile, File
from database import get_db
from typing import List, Optional
from datetime import datetime
import os
import shutil

router = APIRouter()

# Variable global para el manager de conexiones WebSocket
websocket_manager = None

def set_websocket_manager(manager):
    global websocket_manager
    websocket_manager = manager

# Directory for profile pictures
UPLOAD_DIR = "static/profiles"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

@router.post("/{user_id}/photo")
async def upload_courier_photo(user_id: int, file: UploadFile = File(...)):
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = db.cursor(dictionary=True)
    try:
        # Check if courier exists
        cursor.execute("SELECT id FROM couriers WHERE user_id = %s", (user_id,))
        courier = cursor.fetchone()
        if not courier:
            raise HTTPException(status_code=404, detail="Courier not found")

        # Save file
        file_extension = file.filename.split(".")[-1]
        filename = f"courier_{user_id}.{file_extension}"
        file_path = os.path.join(UPLOAD_DIR, filename)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Public URL (assuming static files are served)
        photo_url = f"http://localhost:8000/static/profiles/{filename}"
        
        # Update courier record
        cursor.execute("UPDATE couriers SET image_url = %s WHERE user_id = %s", (photo_url, user_id))
        db.commit()
        
        return {"image_url": photo_url}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()

@router.get("/{user_id}/profile")
def get_courier_profile(user_id: int):
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT name, phone, vehicle, image_url, rating, deliveries, earnings FROM couriers WHERE user_id = %s", (user_id,))
        profile = cursor.fetchone()
        if not profile:
            raise HTTPException(status_code=404, detail="Courier profile not found")
        return profile
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()

@router.get("/{user_id}/stats")
def get_courier_stats(user_id: int):
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = db.cursor(dictionary=True)
    try:
        # Localizar el ID del domiciliario asociado al usuario
        cursor.execute("SELECT id, rating FROM couriers WHERE user_id = %s", (user_id,))
        courier_data = cursor.fetchone()
        if not courier_data:
            db.close()
            return {
                "earnings_today": 0,
                "deliveries_today": 0,
                "rating": 5.0,
                "km_today": 0
            }
        
        real_courier_id = courier_data["id"]
        rating = float(courier_data["rating"])

        # Ganancias hoy
        today = datetime.now().date()
        cursor.execute("""
            SELECT SUM(total * 0.1) as earnings, COUNT(*) as deliveries 
            FROM orders 
            WHERE courier_id = %s AND status = 'delivered' AND DATE(created_at) = %s
        """, (real_courier_id, today))
        stats = cursor.fetchone()
        
        db.close()
        return {
            "earnings_today": float(stats["earnings"] or 0),
            "deliveries_today": int(stats["deliveries"] or 0),
            "rating": rating,
            "km_today": 12.5 # Mock km por ahora
        }
    except Exception as e:
        db.close()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/available-orders")
def get_available_orders():
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT o.*, b.name as business_name, b.address as business_address, b.emoji as business_emoji
            FROM orders o
            LEFT JOIN businesses b ON o.business_id = b.id
            WHERE o.status IN ('pending', 'preparing') AND o.courier_id IS NULL
            ORDER BY o.created_at ASC
        """)
        orders = cursor.fetchall()
        db.close()

        # Group orders that share the same batch_id into a single "bundle"
        bundles = {}
        standalone = []

        for order in orders:
            bid = order.get("batch_id")
            if bid:
                if bid not in bundles:
                    bundles[bid] = {
                        "id": bid,                        # use batch_id as the bundle id
                        "is_batch": True,
                        "batch_id": bid,
                        "customer_name": order["customer_name"],
                        "customer_phone": order.get("customer_phone"),
                        "delivery_address": order["delivery_address"],
                        "payment_method": order.get("payment_method"),
                        "notes": order.get("notes"),
                        "latitude": order.get("latitude"),
                        "longitude": order.get("longitude"),
                        "status": order["status"],
                        "courier_id": order.get("courier_id"),
                        "total": 0,
                        "order_type": "batch",
                        "orders": []
                    }
                bundles[bid]["total"] += order.get("total", 0)
                bundles[bid]["orders"].append({
                    "id": order["id"],
                    "business_name": order.get("business_name") or order.get("origin_name", ""),
                    "business_address": order.get("business_address") or order.get("origin_address", ""),
                    "business_emoji": order.get("business_emoji", "🏪"),
                    "total": order.get("total", 0),
                    "items_summary": []   # could be enriched later
                })
            else:
                # Single-store order – return as-is (not a batch)
                order["is_batch"] = False
                order["orders"] = []
                standalone.append(order)

        result = list(bundles.values()) + standalone
        return result

    except Exception as e:
        db.close()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{user_id}/my-orders")
def get_my_orders(user_id: int):
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    cursor = db.cursor(dictionary=True)
    try:
        # Localizar el ID del domiciliario asociado al usuario
        cursor.execute("SELECT id, name, image_url, vehicle FROM couriers WHERE user_id = %s", (user_id,))
        courier_data = cursor.fetchone()
        if not courier_data:
            db.close()
            return []
            
        real_courier_id = courier_data["id"]

        cursor.execute("""
            SELECT o.*, b.name as business_name, b.address as business_address, b.emoji as business_emoji
            FROM orders o
            LEFT JOIN businesses b ON o.business_id = b.id
            WHERE o.courier_id = %s AND o.status IN ('pending', 'preparing', 'shipped', 'in_transit', 'delivered')
            ORDER BY o.created_at DESC
        """, (real_courier_id,))
        orders = cursor.fetchall()
        db.close()

        # Group orders that share the same batch_id into a single "bundle"
        bundles = {}
        standalone = []

        for order in orders:
            bid = order.get("batch_id")
            if bid:
                if bid not in bundles:
                    bundles[bid] = {
                        "id": bid,                        # use batch_id as the bundle id
                        "is_batch": True,
                        "batch_id": bid,
                        "customer_name": order["customer_name"],
                        "customer_phone": order.get("customer_phone"),
                        "delivery_address": order["delivery_address"],
                        "payment_method": order.get("payment_method"),
                        "notes": order.get("notes"),
                        "latitude": order.get("latitude"),
                        "longitude": order.get("longitude"),
                        "status": order["status"],
                        "courier_id": order.get("courier_id"),
                        "total": 0,
                        "order_type": "batch",
                        "orders": []
                    }
                bundles[bid]["total"] += order.get("total", 0)
                bundles[bid]["orders"].append({
                    "id": order["id"],
                    "business_name": order.get("business_name") or order.get("origin_name", ""),
                    "business_address": order.get("business_address") or order.get("origin_address", ""),
                    "business_emoji": order.get("business_emoji", "🏪"),
                    "total": order.get("total", 0),
                    "items_summary": []   # could be enriched later
                })
            else:
                # Single-store order – return as-is (not a batch)
                order["is_batch"] = False
                order["orders"] = []
                standalone.append(order)

        result = list(bundles.values()) + standalone
        return result
    except Exception as e:
        if db:
            db.close()
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/{user_id}/status")
def update_courier_status(user_id: int, status_data: dict):
    new_status = status_data.get("status")
    if new_status not in ['online', 'offline', 'busy']:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    cursor = db.cursor()
    try:
        # Localizar el ID del domiciliario asociado al usuario
        cursor.execute("SELECT id FROM couriers WHERE user_id = %s", (user_id,))
        courier_data = cursor.fetchone()
        if not courier_data:
            db.close()
            raise HTTPException(status_code=404, detail="Courier profile not found")
        
        real_courier_id = courier_data[0]
        
        cursor.execute("UPDATE couriers SET status = %s WHERE id = %s", (new_status, real_courier_id))
        db.commit()
        db.close()
        return {"message": "Status updated"}
    except Exception as e:
        db.rollback()
        db.close()
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/{user_id}/location")
async def update_courier_location(user_id: int, location_data: dict):
    lat = location_data.get("lat")
    lng = location_data.get("lng")
    
    if lat is None or lng is None:
        raise HTTPException(status_code=400, detail="Latitude and longitude are required")
        
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = db.cursor(dictionary=True)
    try:
        # 1. Update courier location
        cursor.execute("UPDATE couriers SET lat = %s, lng = %s WHERE user_id = %s", (lat, lng, user_id))
        
        # 2. Get courier ID
        cursor.execute("SELECT id FROM couriers WHERE user_id = %s", (user_id,))
        courier = cursor.fetchone()
        if not courier:
            db.close()
            raise HTTPException(status_code=404, detail="Courier not found")
        
        courier_id = courier["id"]
        
        # 3. Find active orders for this courier to notify relevant parties
        cursor.execute(
            "SELECT id, business_id, user_id FROM orders WHERE courier_id = %s AND status IN ('shipped', 'in_transit')",
            (courier_id,)
        )
        active_orders = cursor.fetchall()
        
        if websocket_manager:
            for order in active_orders:
                update_msg = {
                    "type": "courier_location_update",
                    "order_id": order["id"],
                    "courier_id": courier_id,
                    "lat": float(lat),
                    "lng": float(lng)
                }
                # Notify business
                if order["business_id"]:
                    await websocket_manager.notify_business(order["business_id"], update_msg)
                # Notify customer
                if order["user_id"]:
                    await websocket_manager.notify_user(order["user_id"], update_msg)
        
        db.commit()
        db.close()
        return {"message": "Location updated", "active_orders_notified": len(active_orders)}
    except Exception as e:
        if db:
            db.rollback()
            db.close()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{user_id}/accept-order/{order_id}")
async def accept_order(user_id: int, order_id: str):
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    cursor = db.cursor(dictionary=True)
    try:
        # Localizar el ID del domiciliario asociado al usuario
        cursor.execute("SELECT id FROM couriers WHERE user_id = %s", (user_id,))
        courier_data = cursor.fetchone()
        if not courier_data:
            db.close()
            raise HTTPException(status_code=404, detail="Courier profile not found")
            
        real_courier_id = courier_data["id"]
        courier_name = courier_data.get("name", "Un domiciliario")
        courier_image = courier_data.get("image_url")
        courier_vehicle = courier_data.get("vehicle")

        # Check if order_id is actually a batch_id
        cursor.execute("SELECT id, courier_id, user_id FROM orders WHERE batch_id = %s", (order_id,))
        batch_orders = cursor.fetchall()

        orders_to_notify = []

        if batch_orders:
            # It's a batch – assign all orders in the batch to this courier
            for order in batch_orders:
                if order["courier_id"] is not None:
                    if order["courier_id"] != real_courier_id:
                        raise HTTPException(status_code=400, detail=f"Order {order['id']} already assigned to another courier")
                    continue
                
                cursor.execute(
                    "UPDATE orders SET courier_id = %s, status = 'shipped' WHERE id = %s",
                    (real_courier_id, order["id"])
                )
                cursor.execute(
                    "INSERT INTO order_status_logs (order_id, status) VALUES (%s, %s)",
                    (order["id"], 'shipped')
                )
                orders_to_notify.append(order)
        else:
            # Single order
            cursor.execute("SELECT courier_id, user_id FROM orders WHERE id = %s", (order_id,))
            order = cursor.fetchone()
            if not order:
                raise HTTPException(status_code=404, detail="Order not found")
            if order["courier_id"] is not None:
                if order["courier_id"] != real_courier_id:
                    raise HTTPException(status_code=400, detail="Order already assigned to another courier")
            else:
                cursor.execute(
                    "UPDATE orders SET courier_id = %s, status = 'shipped' WHERE id = %s",
                    (real_courier_id, order_id)
                )
                cursor.execute(
                    "INSERT INTO order_status_logs (order_id, status) VALUES (%s, %s)",
                    (order_id, 'shipped')
                )
                orders_to_notify.append({"id": order_id, "user_id": order["user_id"]})

        db.commit()

        # Notificar a los usuarios
        if websocket_manager:
            for order in orders_to_notify:
                await websocket_manager.notify_user(order["user_id"], {
                    "type": "order_accepted",
                    "order_id": order["id"],
                    "status": "shipped",
                    "courier": {
                        "name": courier_name,
                        "image_url": courier_image,
                        "vehicle": courier_vehicle
                    }
                })

        db.close()
        return {"message": "Order accepted"}
    except HTTPException:
        db.rollback()
        db.close()
        raise
    except Exception as e:
        if db:
            db.rollback()
            db.close()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{user_id}/reject-order/{order_id}")
def reject_order(user_id: int, order_id: str):
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    cursor = db.cursor(dictionary=True)
    try:
        # Check if it's a batch
        cursor.execute("SELECT id, courier_id FROM orders WHERE id = %s OR batch_id = %s", (order_id, order_id))
        orders = cursor.fetchall()
        
        if not orders:
            raise HTTPException(status_code=404, detail="Order(s) not found")
        
        # Check if any order in the batch is already assigned to someone else
        for order in orders:
            if order["courier_id"] is not None:
                raise HTTPException(status_code=400, detail=f"Order {order['id']} already assigned to another courier")

        # For rejection, we don't necessarily need to do anything in the DB if we haven't assigned it yet.
        # But if we wanted to log it, we could do it here for each order in the batch.
        
        db.close()
        return {"message": f"Rejected {len(orders)} order(s)"}
    except HTTPException:
        db.close()
        raise
    except Exception as e:
        if db:
            db.close()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{user_id}/complete-order/{order_id}")
def complete_order(user_id: int, order_id: str):
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    cursor = db.cursor(dictionary=True)
    try:
        # Localizar el ID del domiciliario asociado al usuario
        cursor.execute("SELECT id FROM couriers WHERE user_id = %s", (user_id,))
        courier_data = cursor.fetchone()
        if not courier_data:
            db.close()
            raise HTTPException(status_code=404, detail="Courier profile not found")
            
        real_courier_id = courier_data["id"]

        # Check if it's a batch
        cursor.execute("SELECT id FROM orders WHERE batch_id = %s", (order_id,))
        batch_orders = cursor.fetchall()

        if batch_orders:
            for order in batch_orders:
                cursor.execute(
                    "UPDATE orders SET status = 'delivered' WHERE id = %s AND courier_id = %s",
                    (order["id"], real_courier_id)
                )
                cursor.execute(
                    "INSERT INTO order_status_logs (order_id, status) VALUES (%s, %s)",
                    (order["id"], 'delivered')
                )
            # Solo sumar una entrega por el paquete completo? 
            # O una por cada tienda? Generalmente es un solo viaje, pero múltiples paradas.
            # Vamos a sumar 1 entrega por cada tienda para incentivar multi-tienda.
            cursor.execute("UPDATE couriers SET deliveries = deliveries + %s WHERE id = %s", (len(batch_orders), real_courier_id))
        else:
            cursor.execute(
                "UPDATE orders SET status = 'delivered' WHERE id = %s AND courier_id = %s",
                (order_id, real_courier_id)
            )
            cursor.execute(
                "INSERT INTO order_status_logs (order_id, status) VALUES (%s, %s)",
                (order_id, 'delivered')
            )
            # Actualizar estadísticas del domiciliario
            cursor.execute("UPDATE couriers SET deliveries = deliveries + 1 WHERE id = %s", (real_courier_id,))
        
        db.commit()
        db.close()
        return {"message": "Order completed"}
    except Exception as e:
        if db:
            db.rollback()
            db.close()
        raise HTTPException(status_code=500, detail=str(e))
