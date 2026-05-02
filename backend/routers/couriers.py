from fastapi import APIRouter, HTTPException, status, UploadFile, File, Response, BackgroundTasks
from pydantic import BaseModel
from database import get_db
from utils import get_bogota_time
from typing import List, Optional
from datetime import datetime, timedelta
import os
import shutil
from .push import send_push_notification

router = APIRouter()

class CourierOfferCreate(BaseModel):
    amount: int

def ensure_offer_schema(db):
    cursor = db.cursor()
    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS order_courier_offers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_id VARCHAR(50) NOT NULL,
                courier_id INT NOT NULL,
                user_id INT NOT NULL,
                amount INT NOT NULL,
                status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_order_courier_offer (order_id, courier_id),
                INDEX idx_order_courier_offers_order (order_id),
                INDEX idx_order_courier_offers_courier (courier_id),
                INDEX idx_order_courier_offers_user (user_id)
            )
        """)
        db.commit()
    finally:
        cursor.close()

# Variable global para el manager de conexiones WebSocket
websocket_manager = None

def set_websocket_manager(manager):
    global websocket_manager
    websocket_manager = manager

@router.post("/{user_id}/photo")
async def upload_courier_photo(user_id: int, file: UploadFile = File(...)):
    try:
        from lib.storage import upload_file
    except ImportError:
        from _storage_fallback import upload_file
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

        # Upload to cloud (Cloudinary/Vercel Blob) or fallback to /tmp
        photo_url = upload_file(file, folder="profiles")
        
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
def get_courier_profile(user_id: int, response: Response):
    # Cache in browser for 10 seconds, but do not cache at Edge because it's user-specific
    response.headers["Cache-Control"] = "private, max-age=10"
    
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT name, phone, vehicle, image_url, rating, deliveries, earnings, status FROM couriers WHERE user_id = %s", (user_id,))
        profile = cursor.fetchone()
        if not profile:
            raise HTTPException(status_code=404, detail="Courier profile not found")
        return profile
    finally:
        cursor.close()
        db.close()

@router.patch("/{user_id}/profile")
def update_courier_profile(user_id: int, profile_data: dict):
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

        # Prepare update fields
        fields = []
        values = []
        if "name" in profile_data:
            fields.append("name = %s")
            values.append(profile_data["name"])
        if "phone" in profile_data:
            fields.append("phone = %s")
            values.append(profile_data["phone"])
        if "vehicle" in profile_data:
            fields.append("vehicle = %s")
            values.append(profile_data["vehicle"])
        
        if not fields:
            return {"message": "No changes provided"}
            
        values.append(user_id)
        query = f"UPDATE couriers SET {', '.join(fields)} WHERE user_id = %s"
        cursor.execute(query, tuple(values))
        db.commit()
        
        return {"message": "Profile updated successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()

@router.get("/{user_id}/stats")
def get_courier_stats(user_id: int, response: Response):
    # Cache in browser for 10 seconds
    response.headers["Cache-Control"] = "private, max-age=10"
    
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

        # Ganancias hoy (Hora Bogotá)
        # Se añade el recargo nocturno de 2000 si el pedido se creó entre las 7pm y 6am
        # Como ya reciben el 10% del total (que incluye los 2000), sumamos los 1800 restantes
        today = get_bogota_time().date()
        cursor.execute("""
            SELECT 
                SUM(total * 0.1 + (CASE WHEN HOUR(CONVERT_TZ(created_at, '+00:00', '-05:00')) >= 19 OR HOUR(CONVERT_TZ(created_at, '+00:00', '-05:00')) < 6 THEN 1800 ELSE 0 END)) as earnings, 
                COUNT(*) as deliveries 
            FROM orders 
            WHERE courier_id = %s AND status = 'delivered' AND DATE(created_at) = %s
        """, (real_courier_id, today))
        stats = cursor.fetchone()
        
        return {
            "earnings_today": float(stats["earnings"] or 0),
            "deliveries_today": int(stats["deliveries"] or 0),
            "rating": rating,
            "km_today": 12.5 # Mock km por ahora
        }
    finally:
        cursor.close()
        db.close()

@router.get("/available-orders")
def get_available_orders(response: Response):
    # Enable Edge Caching for 5 seconds to shield DB from aggressive polling
    # public means Vercel Edge can cache it, s-maxage tells Edge to keep for 5s, 
    # stale-while-revalidate allows serving stale content while fetching fresh
    response.headers["Cache-Control"] = "public, max-age=5, s-maxage=5, stale-while-revalidate=10"
    
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

        return list(bundles.values()) + standalone
    finally:
        cursor.close()
        db.close()


@router.get("/{user_id}/my-orders")
def get_my_orders(user_id: int, response: Response):
    # Cache in browser for 5 seconds
    response.headers["Cache-Control"] = "private, max-age=5"
    
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    cursor = db.cursor(dictionary=True)
    try:
        # Localizar el ID del domiciliario asociado al usuario
        cursor.execute("SELECT id, name, image_url, vehicle FROM couriers WHERE user_id = %s", (user_id,))
        courier_data = cursor.fetchone()
        real_courier_id = courier_data["id"]

        cursor.execute("""
            SELECT o.*, b.name as business_name, b.address as business_address, b.emoji as business_emoji
            FROM orders o
            LEFT JOIN businesses b ON o.business_id = b.id
            WHERE o.courier_id = %s AND o.status IN ('pending', 'preparing', 'shipped', 'in_transit', 'delivered')
            ORDER BY o.created_at DESC
        """, (real_courier_id,))
        orders = cursor.fetchall()

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
                bundles[bid]["total"] += (order.get("total") or 0)
                bundles[bid]["orders"].append({
                    "id": order["id"],
                    "business_name": order.get("business_name") or order.get("origin_name", ""),
                    "business_address": order.get("business_address") or order.get("origin_address", ""),
                    "business_emoji": order.get("business_emoji", "🏪"),
                    "total": (order.get("total") or 0),
                    "items_summary": []   # could be enriched later
                })
            else:
                # Single-store order – return as-is (not a batch)
                order["is_batch"] = False
                order["orders"] = []
                standalone.append(order)

        result = list(bundles.values()) + standalone
        return result
    finally:
        cursor.close()
        db.close()

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
        return {"message": "Status updated"}
    finally:
        cursor.close()
        db.close()

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
        return {"message": "Location updated", "active_orders_notified": len(active_orders)}
    finally:
        cursor.close()
        db.close()

@router.post("/{user_id}/accept-order/{order_id}")
async def accept_order(user_id: int, order_id: str, background_tasks: BackgroundTasks):
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

        for order in orders_to_notify:
            if order.get("user_id"):
                background_tasks.add_task(send_push_notification, order["user_id"], {
                    "title": "Domiciliario asignado",
                    "body": f"{courier_name} acepto tu pedido y va a recogerlo.",
                    "url": f"/rastreo/{order['id']}"
                })

        return {"message": "Order accepted"}
    finally:
        cursor.close()
        db.close()

@router.post("/{user_id}/offer/{order_id}")
def create_open_order_offer(user_id: int, order_id: str, offer: CourierOfferCreate, background_tasks: BackgroundTasks):
    if offer.amount <= 0:
        raise HTTPException(status_code=400, detail="Offer amount must be greater than zero")

    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")

    ensure_offer_schema(db)
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT id, name FROM couriers WHERE user_id = %s", (user_id,))
        courier = cursor.fetchone()
        if not courier:
            raise HTTPException(status_code=404, detail="Courier profile not found")

        cursor.execute("""
            SELECT id, user_id, order_type, status, courier_id, origin_name
            FROM orders
            WHERE id = %s
        """, (order_id,))
        order = cursor.fetchone()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        if order["order_type"] != "open":
            raise HTTPException(status_code=400, detail="Offers are only available for open orders")
        if order.get("courier_id"):
            raise HTTPException(status_code=400, detail="Order already has an accepted courier")
        if order["status"] not in ["pending", "preparing"]:
            raise HTTPException(status_code=400, detail="Order is not accepting offers")

        cursor.execute("""
            INSERT INTO order_courier_offers (order_id, courier_id, user_id, amount, status)
            VALUES (%s, %s, %s, %s, 'pending')
            ON DUPLICATE KEY UPDATE amount = VALUES(amount), status = 'pending', updated_at = CURRENT_TIMESTAMP
        """, (order_id, courier["id"], user_id, offer.amount))
        db.commit()

        if order.get("user_id"):
            background_tasks.add_task(send_push_notification, order["user_id"], {
                "title": "Nueva oferta de domiciliario",
                "body": f"{courier['name']} ofrece hacer tu encargo por ${offer.amount:,}.",
                "url": f"/rastreo/{order_id}"
            })

        if websocket_manager and order.get("user_id"):
            # Fire-and-forget websockets are not guaranteed in Vercel, push is the source of truth.
            pass

        return {
            "message": "Offer submitted",
            "order_id": order_id,
            "courier_id": courier["id"],
            "courier_name": courier["name"],
            "amount": offer.amount
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()

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
def complete_order(user_id: int, order_id: str, data: dict = None):
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
        delivery_fee = data.get("delivery_fee") if data else None

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
            
            # Calcular ganancias
            if delivery_fee is not None:
                order_earnings = float(delivery_fee)
            else:
                # 10% del total de las órdenes del paquete + recargo nocturno si aplica
                cursor.execute("SELECT SUM(total) as batch_total, MIN(created_at) as created_at FROM orders WHERE batch_id = %s", (order_id,))
                batch_data = cursor.fetchone()
                batch_total = batch_data["batch_total"] if batch_data and batch_data["batch_total"] else 0
                order_earnings = batch_total * 0.1
                
                # Verificar si es horario nocturno para añadir los 1800 restantes del recargo
                created_at = batch_data["created_at"]
                if created_at:
                    # Convertir a hora de Bogotá
                    bogota_hour = (created_at + timedelta(hours=-5)).hour
                    if bogota_hour >= 19 or bogota_hour < 6:
                        order_earnings += 1800

            cursor.execute("UPDATE couriers SET deliveries = deliveries + %s, earnings = earnings + %s WHERE id = %s", (len(batch_orders), order_earnings, real_courier_id))
        else:
            # Obtener tipo de pedido
            cursor.execute("SELECT order_type, total, night_fee FROM orders WHERE id = %s", (order_id,))
            order_info = cursor.fetchone()

            if delivery_fee is not None and order_info and order_info.get("order_type") == "open":
                final_total = int(round(float(delivery_fee)))
                current_night_fee = int(order_info.get("night_fee") or 0)
                final_delivery_fee = max(final_total - current_night_fee, 0)
                cursor.execute(
                    "UPDATE orders SET status = 'delivered', total = %s, delivery_fee = %s WHERE id = %s AND courier_id = %s",
                    (final_total, final_delivery_fee, order_id, real_courier_id)
                )
            else:
                cursor.execute(
                    "UPDATE orders SET status = 'delivered' WHERE id = %s AND courier_id = %s",
                    (order_id, real_courier_id)
                )

            cursor.execute(
                "INSERT INTO order_status_logs (order_id, status) VALUES (%s, %s)",
                (order_id, 'delivered')
            )
            
            # Si se proporcionó cobro manual (usualmente para pedidos abiertos)
            if delivery_fee is not None:
                order_earnings = float(delivery_fee)
            else:
                # Calcular ganancias (10% del total) + recargo nocturno si aplica
                order_total = order_info['total'] if order_info else 0
                order_earnings = order_total * 0.1
                
                # Verificar horario nocturno
                cursor.execute("SELECT created_at FROM orders WHERE id = %s", (order_id,))
                created_row = cursor.fetchone()
                if created_row and created_row['created_at']:
                    bogota_hour = (created_row['created_at'] + timedelta(hours=-5)).hour
                    if bogota_hour >= 19 or bogota_hour < 6:
                        order_earnings += 1800

            # Actualizar estadísticas del domiciliario
            cursor.execute("UPDATE couriers SET deliveries = deliveries + 1, earnings = earnings + %s WHERE id = %s", (order_earnings, real_courier_id))
        
        db.commit()
        return {"message": "Order completed"}
    finally:
        cursor.close()
        db.close()
