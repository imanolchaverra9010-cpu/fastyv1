from fastapi import APIRouter, HTTPException, status, BackgroundTasks, Depends
from typing import List, Optional
from datetime import timedelta
import uuid
from database import get_db
from schemas import OrderCreate, OrderResponse, OrderDetailResponse, OrderRatingCreate, FeeCalculationRequest, FeeCalculationResponse
from utils import get_bogota_time, calculate_distance
from security import get_current_user, get_optional_user, assert_order_access
from order_validation import compute_order_pricing
import json
import math
from .push import send_push_notification

router = APIRouter()

COURIER_TO_PICKUP_SPEED_KMH = 25
DELIVERY_SPEED_KMH = 22
PICKUP_HANDOFF_MINUTES = 4
PREPARING_BUFFER_MINUTES = 12
VALID_ORDER_STATUSES = {"pending_payment", "pending", "confirmed", "preparing", "shipped", "in_transit", "delivered", "cancelled"}
FINAL_ORDER_STATUSES = {"delivered", "cancelled"}
ORDER_STATUS_TRANSITIONS = {
    "pending_payment": {"pending", "confirmed", "cancelled"},
    "pending": {"preparing", "shipped", "cancelled"},
    "confirmed": {"preparing", "cancelled"},
    "preparing": {"shipped", "cancelled"},
    "shipped": {"in_transit", "cancelled"},
    "in_transit": {"delivered", "cancelled"},
    "delivered": set(),
    "cancelled": set(),
}


def validate_order_status_transition(current_status: str | None, new_status: str | None, courier_id: int | None = None):
    if not new_status:
        return
    if new_status not in VALID_ORDER_STATUSES:
        raise HTTPException(status_code=400, detail="Estado de pedido inválido")
    if current_status == new_status:
        return
    if current_status not in VALID_ORDER_STATUSES:
        raise HTTPException(status_code=400, detail=f"El estado actual '{current_status}' no es válido")
    if current_status in FINAL_ORDER_STATUSES:
        raise HTTPException(status_code=400, detail=f"No se puede cambiar un pedido en estado '{current_status}'")
    if new_status not in ORDER_STATUS_TRANSITIONS[current_status]:
        raise HTTPException(
            status_code=400,
            detail=f"Transición inválida: no puedes cambiar un pedido de '{current_status}' a '{new_status}'"
        )
    if new_status in {"shipped", "in_transit", "delivered"} and not courier_id:
        raise HTTPException(status_code=400, detail="El pedido debe tener un domiciliario asignado para avanzar a este estado")

def _safe_alter_table_column(cursor, db, table_name, column_name, column_def):
    try:
        cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_def}")
        db.commit()
    except Exception as e:
        db.rollback()
        if "Duplicate column name" not in str(e) and "1060" not in str(e):
            raise


def _safe_create_table(cursor, db, create_sql):
    try:
        cursor.execute(create_sql)
        db.commit()
    except Exception as e:
        db.rollback()
        if "already exists" not in str(e).lower() and "1050" not in str(e):
            raise


def ensure_open_order_support_schema(db):
    cursor = db.cursor()
    try:
        for column_name, column_def in [
            ("origin_latitude", "DECIMAL(10, 8) NULL"),
            ("origin_longitude", "DECIMAL(11, 8) NULL"),
            ("origin_name", "VARCHAR(100) NULL"),
            ("origin_address", "VARCHAR(255) NULL"),
            ("open_order_description", "TEXT NULL"),
            ("batch_id", "VARCHAR(50) NULL"),
            ("delivery_fee", "INT NOT NULL DEFAULT 0"),
            ("night_fee", "INT NOT NULL DEFAULT 0"),
            ("is_rated", "BOOLEAN NOT NULL DEFAULT FALSE"),
        ]:
            _safe_alter_table_column(cursor, db, "orders", column_name, column_def)

        _safe_create_table(cursor, db, """
            CREATE TABLE IF NOT EXISTS used_coupons (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                code VARCHAR(50) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_user_coupon (user_id, code),
                INDEX idx_used_coupons_user (user_id)
            )
        """)

        _safe_create_table(cursor, db, """
            CREATE TABLE IF NOT EXISTS order_ratings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_id VARCHAR(50),
                business_id VARCHAR(50),
                courier_id INT,
                business_rating INT NOT NULL,
                courier_rating INT,
                comment TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        _safe_create_table(cursor, db, """
            CREATE TABLE IF NOT EXISTS order_rejections (
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_id VARCHAR(50) NOT NULL,
                courier_id INT NOT NULL,
                reason TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_order_rejections_order (order_id),
                INDEX idx_order_rejections_courier (courier_id)
            )
        """)

        _safe_create_table(cursor, db, """
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

        _safe_create_table(cursor, db, """
            CREATE TABLE IF NOT EXISTS order_delivery_proofs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_id VARCHAR(50) NOT NULL,
                courier_id INT NOT NULL,
                proof_type ENUM('photo', 'code', 'note') NOT NULL DEFAULT 'note',
                proof_value TEXT,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_order_delivery_proofs_order (order_id),
                INDEX idx_order_delivery_proofs_courier (courier_id)
            )
        """)

        _safe_create_table(cursor, db, """
            CREATE TABLE IF NOT EXISTS order_incidents (
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_id VARCHAR(50) NOT NULL,
                reporter_role VARCHAR(30) NOT NULL,
                reporter_id INT NOT NULL,
                incident_type VARCHAR(80) NOT NULL,
                description TEXT,
                status ENUM('open', 'reviewed', 'resolved') NOT NULL DEFAULT 'open',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_order_incidents_order (order_id),
                INDEX idx_order_incidents_status (status)
            )
        """)
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
    if status_value in ["pending", "confirmed", "preparing"]:
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
            AND o.status IN ('pending', 'confirmed', 'preparing', 'shipped', 'in_transit')
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

def normalize_payment_method(payment_method: str | None) -> str:
    normalized = (payment_method or "cash").strip().lower()
    payment_aliases = {
        "efectivo": "cash",
        "cash": "cash",
        "tarjeta": "card",
        "card": "card",
        "datafono": "card",
        "datáfono": "card",
        "transferencia": "Transferencia",
        "transfer": "Transferencia",
        "wallet": "wallet",
        "billetera": "wallet",
    }
    return payment_aliases.get(normalized, "cash")

def ensure_order_type_support(cursor, db, order_type: str):
    if order_type != "business_requested":
        return

    cursor.execute("SHOW COLUMNS FROM orders LIKE 'order_type'")
    column = cursor.fetchone()
    if column and "business_requested" in str(column.get("Type", "")):
        return

    cursor.execute(
        "ALTER TABLE orders MODIFY COLUMN order_type ENUM('regular','open','business_requested') NULL DEFAULT 'regular'"
    )
    db.commit()

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_order(
    order: OrderCreate,
    background_tasks: BackgroundTasks,
    current_user: dict | None = Depends(get_optional_user),
):
    if order.user_id:
        if not current_user:
            raise HTTPException(status_code=401, detail="Debes iniciar sesión para crear este pedido")
        if current_user["id"] != order.user_id and current_user["role"] != "admin":
            raise HTTPException(status_code=403, detail="No puedes crear pedidos para otro usuario")

    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = db.cursor(dictionary=True)
    order_id = str(uuid.uuid4())[:8]

    try:
        ensure_open_order_support_schema(db)
        ensure_order_type_support(cursor, db, order.order_type)

        pricing = compute_order_pricing(cursor, order)
        if abs(pricing["total"] - int(order.total)) > 100:
            raise HTTPException(
                status_code=400,
                detail="El total del pedido no coincide. Recarga la página e intenta de nuevo.",
            )

        validated_total = pricing["total"]
        delivery_fee = pricing["delivery_fee"]
        night_fee = pricing["night_fee"]
        validated_items = pricing["validated_items"]
        promo_code = pricing["promo_code"]

        payment_method = normalize_payment_method(order.payment_method)
        raw_method = (order.payment_method or "").strip().lower()
        is_digital_payment = payment_method in ["card", "wallet", "Transferencia"] or raw_method in ["transfer", "transferencia"]

        # Set initial status based on payment method
        initial_status = 'pending_payment' if is_digital_payment else 'pending'
        should_notify_couriers = not is_digital_payment

        # Insertar pedido
        cursor.execute(
            """INSERT INTO orders (id, business_id, user_id, customer_name, customer_phone, 
               delivery_address, payment_method, notes, total, latitude, longitude, status,
               order_type, origin_name, origin_address, origin_latitude, origin_longitude, open_order_description, batch_id,
               delivery_fee, night_fee) 
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (order_id, order.business_id, order.user_id, order.customer_name, order.customer_phone,
             order.delivery_address, payment_method, order.notes, validated_total, 
             order.latitude, order.longitude, initial_status,
             order.order_type, order.origin_name, order.origin_address, order.origin_latitude, order.origin_longitude, order.open_order_description,
             order.batch_id, delivery_fee, night_fee)
        )
        
        # Log inicial
        cursor.execute(
            "INSERT INTO order_status_logs (order_id, status) VALUES (%s, %s)",
            (order_id, initial_status)
        )
        
        # Insertar items
        for item in validated_items:
            cursor.execute(
                "INSERT INTO order_items (order_id, name, price, quantity, emoji) VALUES (%s, %s, %s, %s, %s)",
                (order_id, item["name"], item["price"], item["quantity"], item["emoji"])
            )
            
        # Registrar uso del cupón
        if promo_code and order.user_id:
            cursor.execute(
                "INSERT INTO used_coupons (user_id, code) VALUES (%s, %s)",
                (order.user_id, promo_code)
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
            "total": validated_total,
            "items": validated_items,
            "description": order.open_order_description
        }

        # 1. WebSocket Notifications (if manager exists)
        if websocket_manager and should_notify_couriers:
            await websocket_manager.notify_couriers(notification_data)

        if websocket_manager and should_notify_couriers and order.business_id and business_info and business_info.get('owner_id'):
            biz_notif = {**notification_data, "order_id": order_id}
            await websocket_manager.notify_business(order.business_id, biz_notif)

        # 2. Push Notifications
        # Notify Business Owner only when payment is not pending
        if should_notify_couriers and order.business_id and business_info and business_info.get('owner_id'):
            background_tasks.add_task(send_push_notification, business_info['owner_id'], {
                "title": "¡Nuevo Pedido!",
                "body": f"Has recibido un nuevo pedido de {order.customer_name}.",
                "url": "/negocio/pedidos"
            })

        # Notify couriers only when payment is not pending
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
                push_body = f"Destino: {order.delivery_address}" if order.order_type == "open" else f"Destino: {order.delivery_address} | Valor aprox: ${validated_total}"
                push_url = "/domiciliario"
                background_tasks.add_task(send_push_notification, courier['user_id'], {
                    "title": push_title,
                    "body": push_body,
                    "url": push_url
                })

        return {"id": order_id, "message": "Order created successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()

@router.get("", response_model=List[OrderResponse])
def get_orders(status_filter: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="No tienes permiso para ver todos los pedidos")
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
            
        # Calculation formula: Base 6000 + 1000 per km
        base_fee = 6000
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
def get_user_orders(user_id: int, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin" and current_user["id"] != user_id:
        raise HTTPException(status_code=403, detail="No tienes permiso para ver estos pedidos")
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

@router.patch("/{order_id}")
async def update_order(order_id: str, order_data: dict, background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")

    cursor = db.cursor(dictionary=True)
    try:
        # Fetch order info with business owner and courier user IDs for notifications
        cursor.execute("""
            SELECT o.id, o.business_id, o.user_id, o.courier_id, o.status,
                   b.owner_id as business_user_id, c.user_id as courier_user_id,
                   b.name as business_name
            FROM orders o
            LEFT JOIN businesses b ON o.business_id = b.id
            LEFT JOIN couriers c ON o.courier_id = c.id
            WHERE o.id = %s
        """, (order_id,))
        order = cursor.fetchone()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        if current_user["role"] != "admin":
            if current_user["role"] == "customer" and order["user_id"] != current_user["id"]:
                raise HTTPException(status_code=403, detail="No tienes permiso para actualizar este pedido")
            if current_user["role"] == "business" and order["business_user_id"] != current_user["id"]:
                raise HTTPException(status_code=403, detail="No tienes permiso para actualizar este pedido")
            if current_user["role"] == "courier" and order["courier_user_id"] != current_user["id"]:
                raise HTTPException(status_code=403, detail="No tienes permiso para actualizar este pedido")
        if current_user["role"] != "admin" and "status" in order_data:
            raise HTTPException(status_code=403, detail="Solo un administrador puede editar el estado desde este endpoint")
        if "status" in order_data:
            validate_order_status_transition(
                order.get("status"),
                order_data.get("status"),
                order.get("courier_id")
            )

        allowed_fields = {
            "customer_name",
            "customer_phone",
            "delivery_address",
            "payment_method",
            "notes",
            "status",
            "delivery_fee",
            "night_fee",
            "latitude",
            "longitude",
        }
        updates = []
        params = []

        for field in allowed_fields:
            if field in order_data:
                updates.append(f"{field} = %s")
                params.append(order_data[field])

        if "delivery_fee" in order_data or "night_fee" in order_data:
            cursor.execute("SELECT SUM(price * quantity) as items_total FROM order_items WHERE order_id = %s", (order_id,))
            items_total = cursor.fetchone()["items_total"] or 0
            delivery_fee = order_data.get("delivery_fee")
            night_fee = order_data.get("night_fee")

            if delivery_fee is None or night_fee is None:
                cursor.execute("SELECT delivery_fee, night_fee FROM orders WHERE id = %s", (order_id,))
                current_fees = cursor.fetchone() or {}
                delivery_fee = current_fees.get("delivery_fee") if delivery_fee is None else delivery_fee
                night_fee = current_fees.get("night_fee") if night_fee is None else night_fee

            updates.append("total = %s")
            params.append(int(items_total or 0) + int(delivery_fee or 0) + int(night_fee or 0))

        if not updates:
            raise HTTPException(status_code=400, detail="No valid fields provided")

        query = f"UPDATE orders SET {', '.join(updates)} WHERE id = %s"
        params.append(order_id)
        cursor.execute(query, params)

        # Handle status change notifications
        if "status" in order_data:
            new_status = order_data["status"]
            cursor.execute(
                "INSERT INTO order_status_logs (order_id, status) VALUES (%s, %s)",
                (order_id, new_status)
            )

            user_id = order.get('user_id')
            business_id = order.get('business_id')
            business_user_id = order.get('business_user_id')
            courier_user_id = order.get('courier_user_id')
            real_courier_id = order.get('courier_id')

            # 1. WebSocket Notifications
            if websocket_manager:
                if business_id:
                    await websocket_manager.notify_business(business_id, {
                        "type": "order_status_update", "order_id": order_id, "status": new_status
                    })
                if real_courier_id:
                    await websocket_manager.notify_courier_direct(real_courier_id, {
                        "type": "order_status_update", "order_id": order_id, "status": new_status
                    })
                if user_id:
                    await websocket_manager.notify_user(user_id, {
                        "type": "order_status_update", "order_id": order_id, "status": new_status
                    })

            # 2. Push Notifications
            client_messages = {
                "preparing": "Tu pedido está siendo preparado 👨‍🍳",
                "shipped": "Tu pedido va en camino 🛵",
                "in_transit": "El domiciliario ya recogio tu pedido y va hacia ti",
                "delivered": "¡Tu pedido ha sido entregado! 🎉",
                "cancelled": "Tu pedido ha sido cancelado ❌"
            }
            if user_id and new_status in client_messages:
                background_tasks.add_task(send_push_notification, user_id, {
                    "title": "Actualización de Pedido",
                    "body": client_messages[new_status],
                    "url": f"/rastreo/{order_id}"
                })

            if new_status == "cancelled":
                if business_user_id:
                    background_tasks.add_task(send_push_notification, business_user_id, {
                        "title": "Pedido Cancelado",
                        "body": f"El pedido de {order.get('business_name', 'un cliente')} ha sido cancelado.",
                        "url": "/negocio/pedidos"
                    })
                if courier_user_id:
                    background_tasks.add_task(send_push_notification, courier_user_id, {
                        "title": "Pedido Cancelado",
                        "body": "El pedido que tenías asignado ha sido cancelado ❌",
                        "url": "/domiciliario"
                    })

        db.commit()
        return {"message": "Order updated successfully"}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()

@router.delete("/{order_id}")
def delete_order(order_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")

    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT id, user_id FROM orders WHERE id = %s", (order_id,))
        order = cursor.fetchone()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        if current_user["role"] != "admin" and order["user_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="No tienes permiso para eliminar este pedido")

        for table in ["order_courier_offers", "order_rejections", "order_ratings", "order_status_logs", "order_items"]:
            cursor.execute("SHOW TABLES LIKE %s", (table,))
            if cursor.fetchone():
                cursor.execute(f"DELETE FROM {table} WHERE order_id = %s", (order_id,))

        cursor.execute("DELETE FROM orders WHERE id = %s", (order_id,))
        db.commit()
        return {"message": "Order deleted successfully"}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()

@router.get("/{order_id}", response_model=OrderDetailResponse)
def get_order_detail(
    order_id: str,
    current_user: dict | None = Depends(get_optional_user),
):
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
                   c.rating as courier_rating, c.user_id as courier_user_id,
                   b.latitude as business_lat, b.longitude as business_lng,
                   b.name as business_name, b.emoji as business_emoji,
                   b.owner_id as business_owner_id
            FROM orders o 
            LEFT JOIN couriers c ON o.courier_id = c.id 
            LEFT JOIN businesses b ON o.business_id = b.id
            WHERE o.id = %s
        """, (order_id,))
        order = cursor.fetchone()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        if current_user:
            assert_order_access(cursor, order, current_user)
        
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
        
        return order
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()


@router.post("/{order_id}/offers/{offer_id}/accept")
def accept_open_order_offer(
    order_id: str,
    offer_id: int,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
):
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
            INNER JOIN order_courier_offers oco ON oco.order_id = o.id COLLATE utf8mb4_general_ci
            INNER JOIN couriers c ON c.id = oco.courier_id
            WHERE o.id = %s AND oco.id = %s
        """, (order_id, offer_id))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Offer not found")
        if row["order_type"] != "open":
            raise HTTPException(status_code=400, detail="Only open orders can accept offers")
        if current_user["role"] != "admin" and row.get("user_id") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Solo el cliente del pedido puede aceptar ofertas")
        if row.get("courier_id"):
            raise HTTPException(status_code=400, detail="Order already has a courier assigned")
        if row["status"] not in ["pending", "confirmed", "preparing"]:
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
async def update_order_status(order_id: str, status_data: dict, background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    new_status = status_data.get("status")
    reason = status_data.get("reason")
    courier_id = status_data.get("courier_id")
    if new_status and new_status not in VALID_ORDER_STATUSES:
        raise HTTPException(status_code=400, detail="Estado de pedido inválido")
        
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = db.cursor(dictionary=True)
    try:
        # Fetch order info with business owner and courier user IDs
        cursor.execute("""
            SELECT o.id, o.business_id, o.user_id, o.courier_id, o.status,
                   b.owner_id as business_user_id, c.user_id as courier_user_id,
                   b.name as business_name
            FROM orders o
            LEFT JOIN businesses b ON o.business_id = b.id
            LEFT JOIN couriers c ON o.courier_id = c.id
            WHERE o.id = %s OR o.batch_id = %s
        """, (order_id, order_id))
        orders = cursor.fetchall()
        
        if not orders:
            db.close()
            raise HTTPException(status_code=404, detail="Order(s) not found")

        for order in orders:
            effective_courier_id = courier_id or order.get("courier_id")
            if current_user["role"] != "admin":
                if new_status == "preparing" and (
                    current_user["role"] != "business" or order.get("business_user_id") != current_user["id"]
                ):
                    raise HTTPException(status_code=403, detail="Solo el negocio asignado puede preparar este pedido")
                if new_status in {"in_transit", "delivered"} and (
                    current_user["role"] != "courier" or order.get("courier_user_id") != current_user["id"]
                ):
                    raise HTTPException(status_code=403, detail="Solo el domiciliario asignado puede avanzar este pedido")
                if new_status == "cancelled" and current_user["role"] not in {"customer", "business"}:
                    raise HTTPException(status_code=403, detail="No tienes permiso para cancelar este pedido")
                if current_user["role"] == "customer" and order.get("user_id") != current_user["id"]:
                    raise HTTPException(status_code=403, detail="No tienes permiso para actualizar este pedido")
                if current_user["role"] == "business" and order.get("business_user_id") != current_user["id"]:
                    raise HTTPException(status_code=403, detail="No tienes permiso para actualizar este pedido")
            validate_order_status_transition(order.get("status"), new_status, effective_courier_id)

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
        
        # Log del cambio y notificaciones
        for order in orders:
            real_id = order['id']
            user_id = order.get('user_id')
            business_id = order.get('business_id')
            business_user_id = order.get('business_user_id')
            courier_user_id = order.get('courier_user_id')
            real_courier_id = order.get('courier_id')
            
            if new_status:
                cursor.execute(
                    "INSERT INTO order_status_logs (order_id, status) VALUES (%s, %s)",
                    (real_id, new_status)
                )
            
            # 1. Notificaciones WebSocket
            if websocket_manager:
                # Al negocio
                if business_id:
                    await websocket_manager.notify_business(business_id, {
                        "type": "order_status_update",
                        "order_id": real_id,
                        "status": new_status
                    })
                
                # Al domiciliario (Directa si está asignado)
                if real_courier_id:
                    await websocket_manager.notify_courier_direct(real_courier_id, {
                        "type": "order_status_update",
                        "order_id": real_id,
                        "status": new_status
                    })
                
                # Al cliente
                if user_id:
                    await websocket_manager.notify_user(user_id, {
                        "type": "order_status_update",
                        "order_id": real_id,
                        "status": new_status
                    })

            # 2. Notificaciones Push (Background Tasks)
            # Mensajes para el cliente
            client_messages = {
                "preparing": "Tu pedido está siendo preparado 👨‍🍳",
                "shipped": "Tu pedido va en camino 🛵",
                "delivered": "¡Tu pedido ha sido entregado! 🎉",
                "cancelled": "Tu pedido ha sido cancelado ❌"
            }
            client_messages["in_transit"] = "El domiciliario ya recogio tu pedido y va hacia ti"
            
            if user_id and new_status in client_messages:
                background_tasks.add_task(send_push_notification, user_id, {
                    "title": "Actualización de Pedido",
                    "body": client_messages[new_status],
                    "url": f"/rastreo/{real_id}"
                })

            # Notificaciones especiales para CANCELACIÓN (Negocio y Domiciliario)
            if new_status == "cancelled":
                # Al Negocio
                if business_user_id:
                    background_tasks.add_task(send_push_notification, business_user_id, {
                        "title": "Pedido Cancelado",
                        "body": f"El pedido de {order.get('business_name', 'un cliente')} ha sido cancelado.",
                        "url": "/negocio/pedidos"
                    })
                
                # Al Domiciliario
                if courier_user_id:
                    background_tasks.add_task(send_push_notification, courier_user_id, {
                        "title": "Pedido Cancelado",
                        "body": "El pedido que tenías asignado ha sido cancelado ❌",
                        "url": "/domiciliario"
                    })

        db.commit()
        db.close()
        return {"message": f"Updated {len(orders)} order(s) successfully"}
    except HTTPException:
        db.rollback()
        db.close()
        raise
    except Exception as e:
        db.rollback()
        db.close()
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/{order_id}/business-controls")
def update_business_order_controls(order_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in {"business", "admin"}:
        raise HTTPException(status_code=403, detail="Solo negocio o admin puede gestionar este pedido")
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT o.id, o.status, b.owner_id
            FROM orders o
            LEFT JOIN businesses b ON b.id = o.business_id
            WHERE o.id = %s
        """, (order_id,))
        order = cursor.fetchone()
        if not order:
            raise HTTPException(status_code=404, detail="Pedido no encontrado")
        if current_user["role"] != "admin" and order.get("owner_id") != current_user["id"]:
            raise HTTPException(status_code=403, detail="No puedes gestionar pedidos de otro negocio")

        updates = []
        params = []
        if data.get("estimated_preparation_minutes") is not None:
            minutes = max(1, min(int(data["estimated_preparation_minutes"]), 180))
            updates.append("estimated_delivery_time = %s")
            params.append((get_bogota_time() + timedelta(minutes=minutes)).replace(tzinfo=None))
        if data.get("notes") is not None:
            updates.append("notes = %s")
            params.append(str(data["notes"]))
        if data.get("reject_reason"):
            validate_order_status_transition(order.get("status"), "cancelled", order.get("courier_id"))
            updates.append("status = 'cancelled'")
            updates.append("cancellation_reason = %s")
            params.append(str(data["reject_reason"]))
        if not updates:
            raise HTTPException(status_code=400, detail="No hay cambios para aplicar")
        params.append(order_id)
        cursor.execute(f"UPDATE orders SET {', '.join(updates)} WHERE id = %s", params)
        if data.get("reject_reason"):
            cursor.execute("INSERT INTO order_status_logs (order_id, status) VALUES (%s, 'cancelled')", (order_id,))
        db.commit()
        return {"message": "Pedido actualizado por negocio"}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()

@router.post("/{order_id}/delivery-proof")
def add_delivery_proof(order_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in {"courier", "admin"}:
        raise HTTPException(status_code=403, detail="Solo domiciliario o admin puede agregar prueba de entrega")
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    ensure_open_order_support_schema(db)
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT o.id, o.courier_id, c.user_id AS courier_user_id
            FROM orders o
            LEFT JOIN couriers c ON c.id = o.courier_id
            WHERE o.id = %s
        """, (order_id,))
        order = cursor.fetchone()
        if not order:
            raise HTTPException(status_code=404, detail="Pedido no encontrado")
        if current_user["role"] != "admin" and order.get("courier_user_id") != current_user["id"]:
            raise HTTPException(status_code=403, detail="No puedes agregar prueba a un pedido que no tienes asignado")
        cursor.execute("""
            INSERT INTO order_delivery_proofs (order_id, courier_id, proof_type, proof_value, notes)
            VALUES (%s, %s, %s, %s, %s)
        """, (order_id, order.get("courier_id"), data.get("proof_type", "note"), data.get("proof_value"), data.get("notes")))
        db.commit()
        return {"message": "Prueba de entrega registrada"}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()

@router.post("/{order_id}/incident")
def report_order_incident(order_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in {"courier", "business", "admin"}:
        raise HTTPException(status_code=403, detail="No tienes permiso para reportar incidencias")
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    ensure_open_order_support_schema(db)
    cursor = db.cursor()
    try:
        cursor.execute("""
            INSERT INTO order_incidents (order_id, reporter_role, reporter_id, incident_type, description)
            VALUES (%s, %s, %s, %s, %s)
        """, (order_id, current_user["role"], current_user["id"], data.get("incident_type", "general"), data.get("description")))
        db.commit()
        log_event("order_incident_reported", order_id=order_id, reporter_role=current_user["role"], reporter_id=current_user["id"])
        return {"message": "Incidencia reportada"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()

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

        validate_order_status_transition(order.get("status"), "shipped", selected["id"])
        cursor.execute(
            "UPDATE orders SET courier_id = %s, status = 'shipped', estimated_delivery_time = %s WHERE id = %s AND courier_id IS NULL AND status IN ('pending', 'preparing')",
            (selected["id"], estimated_delivery_time, order_id)
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=409, detail="El pedido ya fue asignado o cambió de estado")
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
def assign_courier(order_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Solo un administrador puede asignar domiciliarios")
    courier_id = data.get("courier_id")
    if not courier_id:
        raise HTTPException(status_code=400, detail="courier_id es requerido")
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT id, status, courier_id FROM orders WHERE id = %s", (order_id,))
        order = cursor.fetchone()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        if order.get("courier_id"):
            raise HTTPException(status_code=400, detail="Order already has a courier assigned")
        validate_order_status_transition(order.get("status"), "shipped", courier_id)
        cursor.execute(
            "UPDATE orders SET courier_id = %s, status = 'shipped' WHERE id = %s AND courier_id IS NULL AND status IN ('pending', 'preparing')",
            (courier_id, order_id)
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=409, detail="El pedido ya fue asignado o cambió de estado")
        cursor.execute("INSERT INTO order_status_logs (order_id, status) VALUES (%s, 'shipped')", (order_id,))
        db.commit()
        db.close()
        return {"message": "Courier assigned and status updated to shipped"}
    except HTTPException:
        db.rollback()
        db.close()
        raise
    except Exception as e:
        db.rollback()
        db.close()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{order_id}/rate")
def rate_order(order_id: str, rating: OrderRatingCreate, current_user: dict = Depends(get_current_user)):
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = db.cursor(dictionary=True)
    try:
        # 1. Verificar el pedido
        cursor.execute("SELECT business_id, courier_id, status, is_rated, user_id FROM orders WHERE id = %s", (order_id,))
        order = cursor.fetchone()
        
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        if current_user["role"] != "admin" and order.get("user_id") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Solo el cliente puede calificar este pedido")

        if rating.business_rating < 1 or rating.business_rating > 5:
            raise HTTPException(status_code=400, detail="La calificación del negocio debe estar entre 1 y 5")
        if rating.courier_rating is not None and (rating.courier_rating < 1 or rating.courier_rating > 5):
            raise HTTPException(status_code=400, detail="La calificación del domiciliario debe estar entre 1 y 5")
        
        if order['status'] != 'delivered':
            raise HTTPException(status_code=400, detail="Only delivered orders can be rated")
            
        if order['is_rated']:
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
        return {"message": "Rating submitted successfully"}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()
