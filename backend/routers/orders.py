from fastapi import APIRouter, HTTPException, status, BackgroundTasks
from typing import List, Optional
from datetime import timedelta
import uuid
from database import get_db
from schemas import OrderCreate, OrderResponse, OrderDetailResponse, OrderRatingCreate, FeeCalculationRequest, FeeCalculationResponse
from utils import get_bogota_time, calculate_distance
import json
import math
from .push import send_push_notification

router = APIRouter()

COURIER_TO_PICKUP_SPEED_KMH = 25
DELIVERY_SPEED_KMH = 22
PICKUP_HANDOFF_MINUTES = 4
PREPARING_BUFFER_MINUTES = 12

def ensure_open_order_support_schema(db):
    cursor = db.cursor()
    try:
        for column_name, column_def in [
            ("origin_latitude", "DECIMAL(10, 8) NULL"),
            ("origin_longitude", "DECIMAL(11, 8) NULL"),
        ]:
            try:
                cursor.execute(f"ALTER TABLE orders ADD COLUMN {column_name} {column_def}")
                db.commit()
            except Exception as e:
                db.rollback()
                if "Duplicate column name" not in str(e) and "1060" not in str(e):
                    raise

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

def _as_float(value):
    return float(value) if value is not None else None

def _estimate_minutes(distance_km: float, speed_kmh: float) -> int:
    if distance_km <= 0:
        return 0
    return max(1, int(math.ceil((distance_km / speed_kmh) * 60)))

def _estimate_order_eta(order: dict) -> dict:
    business_lat = _as_float(order.get("business_lat") or order.get("origin_latitude"))
    business_lng = _as_float(order.get("business_lng") or order.get("origin_longitude"))
    customer_lat = _as_float(order.get("latitude"))
    customer_lng = _as_float(order.get("longitude"))
    courier_lat = _as_float(order.get("courier_lat"))
    courier_lng = _as_float(order.get("courier_lng"))
    status_value = order.get("status")

    if status_value == "delivered":
        return {"estimated_delivery_minutes": 0, "eta_text": "Entregado"}
    if status_value == "cancelled":
        return {"estimated_delivery_minutes": None, "eta_text": "Cancelado"}
    if customer_lat is None or customer_lng is None:
        return {"estimated_delivery_minutes": None, "eta_text": None}

    minutes = 0
    if status_value in ["pending", "preparing"]:
        minutes += PREPARING_BUFFER_MINUTES

    if status_value == "in_transit":
        if courier_lat is not None and courier_lng is not None:
            distance_to_customer = calculate_distance(courier_lat, courier_lng, customer_lat, customer_lng)
            minutes += _estimate_minutes(distance_to_customer, DELIVERY_SPEED_KMH)
        elif business_lat is not None and business_lng is not None:
            delivery_distance = calculate_distance(business_lat, business_lng, customer_lat, customer_lng)
            minutes += _estimate_minutes(delivery_distance, DELIVERY_SPEED_KMH)
    else:
        if courier_lat is not None and courier_lng is not None and business_lat is not None and business_lng is not None:
            pickup_distance = calculate_distance(courier_lat, courier_lng, business_lat, business_lng)
            minutes += _estimate_minutes(pickup_distance, COURIER_TO_PICKUP_SPEED_KMH)
            minutes += PICKUP_HANDOFF_MINUTES
        if business_lat is not None and business_lng is not None:
            delivery_distance = calculate_distance(business_lat, business_lng, customer_lat, customer_lng)
            minutes += _estimate_minutes(delivery_distance, DELIVERY_SPEED_KMH)

    if minutes <= 0:
        return {"estimated_delivery_minutes": None, "eta_text": None}

    return {
        "estimated_delivery_minutes": minutes,
        "eta_text": f"{minutes}-{minutes + 5} min"
    }

def _attach_eta(order: dict) -> dict:
    order.update(_estimate_order_eta(order))
    return order

def _rank_couriers_for_order(cursor, order: dict) -> list[dict]:
    business_lat = _as_float(order.get("business_lat") or order.get("origin_latitude"))
    business_lng = _as_float(order.get("business_lng") or order.get("origin_longitude"))

    if business_lat is None or business_lng is None:
        return []

    cursor.execute("""
        SELECT
            c.id,
            c.user_id,
            c.name,
            c.status,
            c.lat,
            c.lng,
            c.rating,
            COUNT(o.id) AS active_load
        FROM couriers c
        LEFT JOIN orders o
            ON o.courier_id = c.id
            AND o.status IN ('pending', 'preparing', 'shipped', 'in_transit')
        WHERE c.user_id IS NOT NULL
          AND c.lat IS NOT NULL
          AND c.lng IS NOT NULL
          AND c.status IN ('online', 'busy')
        GROUP BY c.id, c.user_id, c.name, c.status, c.lat, c.lng, c.rating
    """)
    candidates = cursor.fetchall()

    ranked = []
    for courier in candidates:
        distance_km = calculate_distance(
            business_lat,
            business_lng,
            float(courier["lat"]),
            float(courier["lng"])
        )
        active_load = int(courier.get("active_load") or 0)
        rating = float(courier.get("rating") or 5)
        status_penalty = 0 if courier["status"] == "online" else 8
        score = (distance_km * 10) + (active_load * 12) + status_penalty - (rating * 2)
        courier["distance_to_pickup_km"] = round(distance_km, 2)
        courier["estimated_pickup_minutes"] = _estimate_minutes(distance_km, COURIER_TO_PICKUP_SPEED_KMH)
        courier["assignment_score"] = round(score, 2)
        ranked.append(courier)

    return sorted(ranked, key=lambda c: c["assignment_score"])

# Variable global para el manager de conexiones WebSocket
websocket_manager = None

def set_websocket_manager(manager):
    global websocket_manager
    websocket_manager = manager

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_order(order: OrderCreate, background_tasks: BackgroundTasks):
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = db.cursor(dictionary=True)
    order_id = str(uuid.uuid4())[:8]
    
    try:
        if order.order_type == "open":
            ensure_open_order_support_schema(db)

        # Insertar pedido
        cursor.execute(
            """INSERT INTO orders (id, business_id, user_id, customer_name, customer_phone, 
               delivery_address, payment_method, notes, total, latitude, longitude, status,
               order_type, origin_name, origin_address, origin_latitude, origin_longitude, open_order_description, batch_id,
               delivery_fee, night_fee) 
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (order_id, order.business_id, order.user_id, order.customer_name, order.customer_phone,
             order.delivery_address, order.payment_method, order.notes, order.total, 
             order.latitude, order.longitude, 'pending',
             order.order_type, order.origin_name, order.origin_address, order.origin_latitude, order.origin_longitude, order.open_order_description,
             order.batch_id, order.delivery_fee, order.night_fee)
        )
        
        # Log inicial
        cursor.execute(
            "INSERT INTO order_status_logs (order_id, status) VALUES (%s, %s)",
            (order_id, 'pending')
        )
        
        # Insertar items
        for item in order.items:
            cursor.execute(
                "INSERT INTO order_items (order_id, name, price, quantity, emoji) VALUES (%s, %s, %s, %s, %s)",
                (order_id, item.name, item.price, item.quantity, item.emoji)
            )
            
        # Registrar uso del cupón
        if order.promo_code and order.user_id:
            cursor.execute(
                "INSERT IGNORE INTO used_coupons (user_id, code) VALUES (%s, %s)",
                (order.user_id, order.promo_code)
            )
        db.commit()

        # Obtener detalles del negocio para la notificación
        business_info = None
        if order.business_id:
            cursor.execute("SELECT name, address, emoji, owner_id FROM businesses WHERE id = %s", (order.business_id,))
            business_info = cursor.fetchone()

        # Logic for notifications
        # For batch orders: only send ONE courier notification (for the first order in the batch)
        should_notify_couriers = True
        if order.batch_id:
            cursor.execute(
                "SELECT COUNT(*) as cnt FROM orders WHERE batch_id = %s AND id != %s",
                (order.batch_id, order_id)
            )
            row = cursor.fetchone()
            already_in_batch = row["cnt"] if row else 0
            if already_in_batch > 0:
                should_notify_couriers = False

        action_id = order.batch_id if order.batch_id else order_id

        notification_data = {
            "type": "new_order",
            "order_id": action_id,
            "real_order_id": order_id,
            "batch_id": order.batch_id,
            "is_batch": bool(order.batch_id and str(order.batch_id).strip()),
            "order_type": order.order_type,
            "business_name": business_info['name'] if business_info else (order.origin_name if order.order_type == "open" else "Negocio"),
            "business_address": business_info['address'] if business_info else (order.origin_address if order.order_type == "open" else ""),
            "business_emoji": business_info['emoji'] if business_info else ("🛍️" if order.order_type == "open" else "🏪"),
            "customer_name": order.customer_name,
            "delivery_address": order.delivery_address,
            "total": order.total,
            "items": [item.dict() for item in order.items],
            "description": order.open_order_description
        }

        # 1. WebSocket Notifications (if manager exists)
        if websocket_manager:
            if should_notify_couriers:
                await websocket_manager.notify_couriers(notification_data)

            if order.business_id and business_info and business_info.get('owner_id'):
                biz_notif = {**notification_data, "order_id": order_id}
                await websocket_manager.notify_business(order.business_id, biz_notif)

        # 2. Push Notifications (Always try)
        # Notify Business Owner
        if order.business_id and business_info and business_info.get('owner_id'):
            background_tasks.add_task(send_push_notification, business_info['owner_id'], {
                "title": "¡Nuevo Pedido!",
                "body": f"Has recibido un nuevo pedido de {order.customer_name}.",
                "url": "/negocio/pedidos"
            })

        # Notify every courier with a saved push subscription. A locked phone or
        # closed PWA should not depend on the courier being marked "online".
        if should_notify_couriers:
            cursor.execute("""
                SELECT DISTINCT c.user_id
                FROM couriers c
                INNER JOIN push_subscriptions ps ON ps.user_id = c.user_id
                WHERE c.user_id IS NOT NULL
            """)
            subscribed_couriers = cursor.fetchall()
            for courier in subscribed_couriers:
                push_title = f"Nuevo encargo: {notification_data['business_name']}" if order.order_type == "open" else f"Nuevo pedido: {notification_data['business_name']}"
                push_body = "Envia tu oferta para hacer este domicilio." if order.order_type == "open" else f"Destino: {order.delivery_address} | Valor aprox: ${order.total}"
                background_tasks.add_task(send_push_notification, courier['user_id'], {
                    "title": f"🚨 ¡NUEVO PEDIDO: {notification_data['business_name']}!",
                    "body": f"Destino: {order.delivery_address} | Valor aprox: ${order.total}",
                    "url": "/domiciliario",
                    "title": push_title,
                    "body": push_body
                })

        return {"id": order_id, "message": "Order created successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()

@router.get("", response_model=List[OrderResponse])
def get_orders(status_filter: Optional[str] = None):
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = db.cursor(dictionary=True)
    try:
        query = """
            SELECT o.*, b.name as business_name, c.name as courier_name,
                   b.latitude as business_lat, b.longitude as business_lng,
                   c.lat as courier_lat, c.lng as courier_lng
            FROM orders o
            LEFT JOIN businesses b ON o.business_id = b.id
            LEFT JOIN couriers c ON o.courier_id = c.id
        """
        params = []
        if status_filter:
            query += " WHERE o.status = %s"
            params.append(status_filter)
        query += " ORDER BY o.created_at DESC"
        
        cursor.execute(query, params)
        orders = cursor.fetchall()
        
        if orders:
            order_ids = [o['id'] for o in orders]
            format_strings = ','.join(['%s'] * len(order_ids))
            cursor.execute(f"SELECT * FROM order_items WHERE order_id IN ({format_strings})", tuple(order_ids))
            all_items = cursor.fetchall()
            
            # Agrupar items por order_id
            items_map = {}
            for item in all_items:
                oid = item['order_id']
                if oid not in items_map:
                    items_map[oid] = []
                items_map[oid].append(item)
                
            for o in orders:
                o['items'] = items_map.get(o['id'], [])

        for o in orders:
            _attach_eta(o)
                
        return orders
    finally:
        cursor.close()
        db.close()

@router.post("/calculate-open-fee", response_model=FeeCalculationResponse)
def calculate_open_fee(request: FeeCalculationRequest):
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = db.cursor(dictionary=True)
    try:
        # Find all online couriers with valid coordinates
        cursor.execute("SELECT id, lat, lng FROM couriers WHERE status = 'online' AND lat IS NOT NULL AND lng IS NOT NULL")
        couriers = cursor.fetchall()
        
        min_distance = 0.0
        
        if couriers:
            distances = []
            for c in couriers:
                dist = calculate_distance(request.latitude, request.longitude, float(c['lat']), float(c['lng']))
                distances.append(dist)
            min_distance = min(distances)
            
        # Calculation formula: Base 5000 + 1000 per km
        base_fee = 5000
        distance_fee = int(math.ceil(min_distance)) * 1000
        
        # Check night fee (7 PM to 6 AM)
        bogota_time = get_bogota_time()
        hour = bogota_time.hour
        is_night = hour >= 19 or hour < 6
        night_fee = 2000 if is_night else 0
        
        total_fee = base_fee + distance_fee + night_fee
        
        return {
            "fee": total_fee,
            "distance_km": min_distance,
            "base_fee": base_fee,
            "distance_fee": distance_fee,
            "night_fee": night_fee
        }
    finally:
        cursor.close()
        db.close()

@router.get("/user/{user_id}", response_model=List[OrderResponse])
def get_user_orders(user_id: int):
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT o.*, b.name as business_name, b.emoji as business_emoji,
                   b.latitude as business_lat, b.longitude as business_lng,
                   c.lat as courier_lat, c.lng as courier_lng
            FROM orders o 
            LEFT JOIN businesses b ON o.business_id = b.id 
            LEFT JOIN couriers c ON o.courier_id = c.id
            WHERE o.user_id = %s 
            ORDER BY o.created_at DESC
        """, (user_id,))
        orders = cursor.fetchall()
        for order in orders:
            _attach_eta(order)
        return orders
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()

@router.get("/{order_id}", response_model=OrderDetailResponse)
def get_order_detail(order_id: str):
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    cursor = db.cursor(dictionary=True)
    try:
        # Datos del pedido, incluyendo información del domiciliario y coordenadas del negocio
        cursor.execute("""
            SELECT o.*, 
                   c.lat as courier_lat, c.lng as courier_lng, 
                   c.name as courier_name, c.image_url as courier_image, 
                   c.vehicle as courier_vehicle, c.phone as courier_phone,
                   c.rating as courier_rating,
                   b.latitude as business_lat, b.longitude as business_lng,
                   b.name as business_name, b.emoji as business_emoji
            FROM orders o 
            LEFT JOIN couriers c ON o.courier_id = c.id 
            LEFT JOIN businesses b ON o.business_id = b.id
            WHERE o.id = %s
        """, (order_id,))
        order = cursor.fetchone()
        if not order:
            db.close()
            raise HTTPException(status_code=404, detail="Order not found")
        
        # Items
        cursor.execute("SELECT * FROM order_items WHERE order_id = %s", (order_id,))
        order['items'] = cursor.fetchall()
        
        # Logs
        cursor.execute("SELECT status, changed_at FROM order_status_logs WHERE order_id = %s ORDER BY changed_at ASC", (order_id,))
        order['logs'] = cursor.fetchall()
        if order.get("order_type") == "open":
            ensure_open_order_support_schema(db)
            cursor.execute("""
                SELECT oco.id, oco.order_id, oco.courier_id, oco.user_id, oco.amount, oco.status,
                       oco.created_at, c.name as courier_name, c.vehicle as courier_vehicle,
                       c.rating as courier_rating
                FROM order_courier_offers oco
                LEFT JOIN couriers c ON c.id = oco.courier_id
                WHERE oco.order_id = %s
                ORDER BY
                    CASE oco.status WHEN 'accepted' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
                    oco.amount ASC,
                    oco.created_at ASC
            """, (order_id,))
            order['offers'] = cursor.fetchall()
        _attach_eta(order)
        
        db.close()
        return order
    except Exception as e:
        db.close()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{order_id}/offers/{offer_id}/accept")
def accept_open_order_offer(order_id: str, offer_id: int, background_tasks: BackgroundTasks):
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")

    ensure_open_order_support_schema(db)
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT o.id, o.user_id, o.order_type, o.status, o.courier_id,
                   oco.id as offer_id, oco.courier_id as offer_courier_id,
                   oco.user_id as courier_user_id, oco.amount,
                   c.name as courier_name
            FROM orders o
            INNER JOIN order_courier_offers oco ON oco.order_id = o.id
            INNER JOIN couriers c ON c.id = oco.courier_id
            WHERE o.id = %s AND oco.id = %s
        """, (order_id, offer_id))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Offer not found")
        if row["order_type"] != "open":
            raise HTTPException(status_code=400, detail="Only open orders can accept offers")
        if row.get("courier_id"):
            raise HTTPException(status_code=400, detail="Order already has a courier assigned")
        if row["status"] not in ["pending", "preparing"]:
            raise HTTPException(status_code=400, detail="Order is not accepting offers")

        cursor.execute("""
            UPDATE orders
            SET courier_id = %s, status = 'shipped', total = %s, delivery_fee = %s
            WHERE id = %s
        """, (row["offer_courier_id"], row["amount"], row["amount"], order_id))
        cursor.execute("UPDATE order_courier_offers SET status = 'accepted' WHERE id = %s", (offer_id,))
        cursor.execute("""
            UPDATE order_courier_offers
            SET status = 'rejected'
            WHERE order_id = %s AND id != %s AND status = 'pending'
        """, (order_id, offer_id))
        cursor.execute(
            "INSERT INTO order_status_logs (order_id, status) VALUES (%s, %s)",
            (order_id, 'shipped')
        )
        db.commit()

        background_tasks.add_task(send_push_notification, row["courier_user_id"], {
            "title": "Oferta aceptada",
            "body": "El cliente acepto tu oferta. Ve a recoger el encargo.",
            "url": "/domiciliario"
        })
        if row.get("user_id"):
            background_tasks.add_task(send_push_notification, row["user_id"], {
                "title": "Domiciliario asignado",
                "body": f"Aceptaste la oferta de {row['courier_name']} por ${row['amount']:,}.",
                "url": f"/rastreo/{order_id}"
            })

        return {
            "message": "Offer accepted",
            "order_id": order_id,
            "courier_id": row["offer_courier_id"],
            "courier_name": row["courier_name"],
            "amount": row["amount"]
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


@router.patch("/{order_id}/status")
async def update_order_status(order_id: str, status_data: dict, background_tasks: BackgroundTasks):
    new_status = status_data.get("status")
    reason = status_data.get("reason")
    courier_id = status_data.get("courier_id")
    if new_status and new_status not in ["pending", "preparing", "shipped", "in_transit", "delivered", "cancelled"]:
        raise HTTPException(status_code=400, detail="Invalid status")
        
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = db.cursor(dictionary=True)
    try:
        # Check if it's a batch_id or a single order_id
        cursor.execute("SELECT id, business_id, user_id FROM orders WHERE id = %s OR batch_id = %s", (order_id, order_id))
        orders = cursor.fetchall()
        
        if not orders:
            db.close()
            raise HTTPException(status_code=404, detail="Order(s) not found")

        # Construir query dinámica
        updates = []
        params = []
        
        if new_status:
            updates.append("status = %s")
            params.append(new_status)
        if courier_id:
            updates.append("courier_id = %s")
            params.append(courier_id)
        if reason:
            updates.append("cancellation_reason = %s")
            params.append(reason)
            
        if not updates:
            raise HTTPException(status_code=400, detail="No updates provided")
            
        # Actualizar todas las órdenes encontradas (una o varias si es batch)
        query = f"UPDATE orders SET {', '.join(updates)} WHERE id = %s OR batch_id = %s"
        params.extend([order_id, order_id])
        
        cursor.execute(query, params)
        
        # Log del cambio para cada orden y notificar a cada negocio y usuario
        for order in orders:
            real_id = order['id']
            user_id = order.get('user_id')
            if new_status:
                cursor.execute(
                    "INSERT INTO order_status_logs (order_id, status) VALUES (%s, %s)",
                    (real_id, new_status)
                )
            
            # Notificar al negocio de esta orden específica
            if websocket_manager and order['business_id']:
                await websocket_manager.notify_business(order['business_id'], {
                    "type": "order_status_update",
                    "order_id": real_id,
                    "status": new_status
                })
            
            # Notificar al usuario (cliente)
            if websocket_manager and user_id:
                await websocket_manager.notify_user(user_id, {
                    "type": "order_status_update",
                    "order_id": real_id,
                    "status": new_status
                })
                
                # Push Notification for Client
                status_messages = {
                    "preparing": "Tu pedido está siendo preparado 👨‍🍳",
                    "shipped": "Tu pedido va en camino 🛵",
                    "delivered": "¡Tu pedido ha sido entregado! 🎉",
                    "cancelled": "Tu pedido ha sido cancelado ❌"
                }
                status_messages["in_transit"] = "El domiciliario ya recogio tu pedido y va hacia ti"
                if new_status in status_messages:
                    background_tasks.add_task(send_push_notification, user_id, {
                        "title": "Actualización de Pedido",
                        "body": status_messages[new_status],
                        "url": f"/rastreo/{real_id}"
                    })
            
        # Vercel serverless does not keep a websocket manager alive, so client
        # push notifications must also work when websocket_manager is missing.
        if not websocket_manager:
            for order in orders:
                user_id = order.get('user_id')
                real_id = order['id']
                status_messages = {
                    "preparing": "Tu pedido esta siendo preparado",
                    "shipped": "Tu pedido va en camino",
                    "delivered": "Tu pedido ha sido entregado",
                    "cancelled": "Tu pedido ha sido cancelado"
                }
                status_messages["in_transit"] = "El domiciliario ya recogio tu pedido y va hacia ti"
                if user_id and new_status in status_messages:
                    background_tasks.add_task(send_push_notification, user_id, {
                        "title": "Actualizacion de Pedido",
                        "body": status_messages[new_status],
                        "url": f"/rastreo/{real_id}"
                    })

        db.commit()
        db.close()
        return {"message": f"Updated {len(orders)} order(s) successfully"}
    except Exception as e:
        db.rollback()
        db.close()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{order_id}/smart-assign")
def smart_assign_courier(order_id: str, background_tasks: BackgroundTasks):
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")

    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT o.*,
                   COALESCE(b.latitude, o.origin_latitude) as business_lat,
                   COALESCE(b.longitude, o.origin_longitude) as business_lng,
                   b.name as business_name
            FROM orders o
            LEFT JOIN businesses b ON o.business_id = b.id
            WHERE o.id = %s
        """, (order_id,))
        order = cursor.fetchone()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        if order.get("courier_id"):
            raise HTTPException(status_code=400, detail="Order already has a courier assigned")

        candidates = _rank_couriers_for_order(cursor, order)
        if not candidates:
            raise HTTPException(status_code=404, detail="No eligible couriers with location available")

        selected = candidates[0]
        order_with_courier = {
            **order,
            "courier_lat": selected.get("lat"),
            "courier_lng": selected.get("lng"),
        }
        eta = _estimate_order_eta(order_with_courier)
        eta_minutes = eta.get("estimated_delivery_minutes")
        estimated_delivery_time = None
        if eta_minutes:
            estimated_delivery_time = (get_bogota_time() + timedelta(minutes=eta_minutes)).replace(tzinfo=None)

        cursor.execute(
            "UPDATE orders SET courier_id = %s, status = 'shipped', estimated_delivery_time = %s WHERE id = %s",
            (selected["id"], estimated_delivery_time, order_id)
        )
        cursor.execute(
            "INSERT INTO order_status_logs (order_id, status) VALUES (%s, %s)",
            (order_id, 'shipped')
        )
        db.commit()

        if order.get("user_id"):
            background_tasks.add_task(send_push_notification, order["user_id"], {
                "title": "Domiciliario asignado",
                "body": f"{selected['name']} fue asignado a tu pedido. ETA: {eta.get('eta_text') or 'calculando'}",
                "url": f"/rastreo/{order_id}"
            })

        if selected.get("user_id"):
            background_tasks.add_task(send_push_notification, selected["user_id"], {
                "title": "Pedido asignado",
                "body": f"Te asignamos un pedido en {order.get('business_name') or 'un negocio'}.",
                "url": "/domiciliario"
            })

        return {
            "message": "Courier assigned",
            "order_id": order_id,
            "courier": {
                "id": selected["id"],
                "user_id": selected["user_id"],
                "name": selected["name"],
                "status": selected["status"],
                "rating": float(selected.get("rating") or 0),
                "active_load": int(selected.get("active_load") or 0),
                "distance_to_pickup_km": selected["distance_to_pickup_km"],
                "estimated_pickup_minutes": selected["estimated_pickup_minutes"],
                "assignment_score": selected["assignment_score"],
            },
            "eta": eta,
            "alternatives": [
                {
                    "id": c["id"],
                    "user_id": c["user_id"],
                    "name": c["name"],
                    "status": c["status"],
                    "rating": float(c.get("rating") or 0),
                    "active_load": int(c.get("active_load") or 0),
                    "distance_to_pickup_km": c["distance_to_pickup_km"],
                    "estimated_pickup_minutes": c["estimated_pickup_minutes"],
                    "assignment_score": c["assignment_score"],
                }
                for c in candidates[1:4]
            ]
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

@router.patch("/{order_id}/assign")
def assign_courier(order_id: str, data: dict):
    courier_id = data.get("courier_id")
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("UPDATE orders SET courier_id = %s, status = 'shipped' WHERE id = %s", (courier_id, order_id))
        cursor.execute("INSERT INTO order_status_logs (order_id, status) VALUES (%s, 'shipped')", (order_id,))
        db.commit()
        db.close()
        return {"message": "Courier assigned and status updated to shipped"}
    except Exception as e:
        db.rollback()
        db.close()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{order_id}/rate")
def rate_order(order_id: str, rating: OrderRatingCreate):
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = db.cursor(dictionary=True)
    try:
        # 1. Verificar el pedido
        cursor.execute("SELECT business_id, courier_id, status, is_rated FROM orders WHERE id = %s", (order_id,))
        order = cursor.fetchone()
        
        if not order:
            db.close()
            raise HTTPException(status_code=404, detail="Order not found")
        
        if order['status'] != 'delivered':
            db.close()
            raise HTTPException(status_code=400, detail="Only delivered orders can be rated")
            
        if order['is_rated']:
            db.close()
            raise HTTPException(status_code=400, detail="Order already rated")

        # 2. Insertar calificación
        cursor.execute(
            """INSERT INTO order_ratings (order_id, business_id, courier_id, business_rating, courier_rating, comment) 
               VALUES (%s, %s, %s, %s, %s, %s)""",
            (order_id, order['business_id'], order['courier_id'], 
             rating.business_rating, rating.courier_rating, rating.comment)
        )
        
        # 3. Marcar pedido como calificado
        cursor.execute("UPDATE orders SET is_rated = TRUE WHERE id = %s", (order_id,))
        
        # 4. Recalcular promedio del Negocio
        cursor.execute("""
            UPDATE businesses 
            SET rating = (SELECT AVG(business_rating) FROM order_ratings WHERE business_id = %s) 
            WHERE id = %s
        """, (order['business_id'], order['business_id']))
        
        # 5. Recalcular promedio del Domiciliario (si aplica)
        if order['courier_id']:
            cursor.execute("""
                UPDATE couriers 
                SET rating = (SELECT AVG(courier_rating) FROM order_ratings WHERE courier_id = %s AND courier_rating IS NOT NULL) 
                WHERE id = %s
            """, (order['courier_id'], order['courier_id']))
            
        db.commit()
        db.close()
        return {"message": "Rating submitted successfully"}
    except Exception as e:
        db.rollback()
        db.close()
        raise HTTPException(status_code=500, detail=str(e))
