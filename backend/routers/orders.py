from fastapi import APIRouter, HTTPException, status
from typing import List, Optional
import uuid
from database import get_db
from schemas import OrderCreate, OrderResponse, OrderDetailResponse, OrderRatingCreate
import json
from .push import send_push_notification

router = APIRouter()

# Variable global para el manager de conexiones WebSocket
websocket_manager = None

def set_websocket_manager(manager):
    global websocket_manager
    websocket_manager = manager

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_order(order: OrderCreate):
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = db.cursor(dictionary=True)
    order_id = str(uuid.uuid4())[:8]
    
    try:
        # Insertar pedido
        cursor.execute(
            """INSERT INTO orders (id, business_id, user_id, customer_name, customer_phone, 
               delivery_address, payment_method, notes, total, latitude, longitude, status,
               order_type, origin_name, origin_address, open_order_description, batch_id) 
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (order_id, order.business_id, order.user_id, order.customer_name, order.customer_phone,
             order.delivery_address, order.payment_method, order.notes, order.total, 
             order.latitude, order.longitude, 'pending',
             order.order_type, order.origin_name, order.origin_address, order.open_order_description,
             order.batch_id)
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
            send_push_notification(business_info['owner_id'], {
                "title": "¡Nuevo Pedido!",
                "body": f"Has recibido un nuevo pedido de {order.customer_name}.",
                "url": "/negocio/pedidos"
            })

        # Notify Couriers
        if should_notify_couriers:
            cursor.execute("SELECT user_id FROM couriers WHERE status = 'online'")
            online_couriers = cursor.fetchall()
            for courier in online_couriers:
                send_push_notification(courier['user_id'], {
                    "title": "¡Nuevo Pedido Disponible!",
                    "body": f"Hay un nuevo pedido de {notification_data['business_name']}.",
                    "url": "/domiciliario"
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
    query = "SELECT * FROM orders"
    params = []
    if status_filter:
        query += " WHERE status = %s"
        params.append(status_filter)
    query += " ORDER BY created_at DESC"
    
    cursor.execute(query, params)
    orders = cursor.fetchall()
    db.close()
    return orders

@router.get("/user/{user_id}", response_model=List[OrderResponse])
def get_user_orders(user_id: int):
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT o.*, b.name as business_name, b.emoji as business_emoji 
            FROM orders o 
            LEFT JOIN businesses b ON o.business_id = b.id 
            WHERE o.user_id = %s 
            ORDER BY o.created_at DESC
        """, (user_id,))
        orders = cursor.fetchall()
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
        
        db.close()
        return order
    except Exception as e:
        db.close()
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{order_id}/status")
async def update_order_status(order_id: str, status_data: dict):
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
                if new_status in status_messages:
                    send_push_notification(user_id, {
                        "title": "Actualización de Pedido",
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
