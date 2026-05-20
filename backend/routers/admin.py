from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from database import get_db
from typing import List, Dict, Optional
from datetime import datetime, timedelta
from utils import pwd_context, hash_password, get_bogota_time
from pydantic import BaseModel
from security import get_current_user
from .push import broadcast_push_notification

router = APIRouter()

# WebSocket Manager support
websocket_manager = None

def set_websocket_manager(manager):
    global websocket_manager
    websocket_manager = manager

# Schema de notificaciones masivas
class BroadcastRequest(BaseModel):
    title: str
    body: str
    redirect_url: Optional[str] = "/"

# Inicializar tabla de notificaciones masivas
def init_broadcast_table():
    conn = get_db()
    if not conn:
        print("Error: No se pudo conectar a la base de datos para inicializar broadcast_notifications")
        return
    cursor = conn.cursor()
    try:
        sql = """
        CREATE TABLE IF NOT EXISTS broadcast_notifications (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            body TEXT NOT NULL,
            redirect_url VARCHAR(255) DEFAULT '/',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
        """
        cursor.execute(sql)
        conn.commit()
        print("Tabla 'broadcast_notifications' inicializada exitosamente.")
    except Exception as e:
        print(f"Error al crear tabla broadcast_notifications: {e}")
    finally:
        cursor.close()
        conn.close()

# Auto ejecutar al importar
init_broadcast_table()

# Schema para crear un domiciliario con credenciales manuales
class CourierCreateRequest(BaseModel):
    name: str
    phone: str
    vehicle: str
    username: str
    email: str
    password: str

@router.get("/stats")
def get_admin_stats():
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = db.cursor(dictionary=True)
    try:
        # 1. Ingresos Totales (solo domicilio + cuota nocturna) y Ticket Promedio de fees
        cursor.execute("""
            SELECT
                SUM(
                    CASE
                        WHEN COALESCE(o.delivery_fee, 0) + COALESCE(o.night_fee, 0) > 0
                        THEN COALESCE(o.delivery_fee, 0) + COALESCE(o.night_fee, 0)
                        ELSE GREATEST(COALESCE(o.total, 0) - COALESCE(items.items_total, 0), 0)
                    END
                ) as total_revenue,
                COUNT(*) as total_orders,
                AVG(
                    CASE
                        WHEN COALESCE(o.delivery_fee, 0) + COALESCE(o.night_fee, 0) > 0
                        THEN COALESCE(o.delivery_fee, 0) + COALESCE(o.night_fee, 0)
                        ELSE GREATEST(COALESCE(o.total, 0) - COALESCE(items.items_total, 0), 0)
                    END
                ) as avg_ticket
            FROM orders o
            LEFT JOIN (
                SELECT order_id, SUM(price * quantity) as items_total
                FROM order_items
                GROUP BY order_id
            ) items ON items.order_id = o.id
            WHERE o.status != 'cancelled'
        """)
        revenue_data = cursor.fetchone()
        
        # 2. Pagos por Método
        cursor.execute("SELECT payment_method, COUNT(*) as count FROM orders GROUP BY payment_method")
        payments = {row['payment_method']: row['count'] for row in cursor.fetchall()}
        
        # 3. Negocios Activos y Pendientes
        cursor.execute("SELECT status, COUNT(*) as count FROM businesses GROUP BY status")
        biz_stats = {row['status']: row['count'] for row in cursor.fetchall()}
        
        # 4. Domiciliarios (Reales)
        cursor.execute("SELECT COUNT(*) as total FROM couriers")
        total_couriers = cursor.fetchone()['total'] or 0
        
        cursor.execute("SELECT COUNT(*) as online FROM couriers WHERE status = 'online'")
        online_couriers = cursor.fetchone()['online'] or 0

        stats = {
            "total_revenue": float(revenue_data['total_revenue'] or 0),
            "total_orders": int(revenue_data['total_orders'] or 0),
            "avg_ticket": float(revenue_data['avg_ticket'] or 0),
            "payments": {
                "card": payments.get('card', 0),
                "cash": payments.get('cash', 0),
                "wallet": payments.get('wallet', 0)
            },
            "businesses": {
                "active": biz_stats.get('active', 0),
                "pending": biz_stats.get('pending', 0),
                "total": sum(biz_stats.values())
            },
            "couriers": {
                "online": online_couriers,
                "total": total_couriers
            }
        }
        db.close()
        return stats
    except Exception as e:
        db.close()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/revenue-chart")
def get_revenue_chart_data():
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    cursor = db.cursor(dictionary=True)
    try:
        # Últimos 7 días en hora Bogotá
        end_date = get_bogota_time()
        start_date = end_date - timedelta(days=6)
        
        cursor.execute("""
            SELECT
                DATE(o.created_at) as date,
                SUM(
                    CASE
                        WHEN COALESCE(o.delivery_fee, 0) + COALESCE(o.night_fee, 0) > 0
                        THEN COALESCE(o.delivery_fee, 0) + COALESCE(o.night_fee, 0)
                        ELSE GREATEST(COALESCE(o.total, 0) - COALESCE(items.items_total, 0), 0)
                    END
                ) as revenue 
            FROM orders o
            LEFT JOIN (
                SELECT order_id, SUM(price * quantity) as items_total
                FROM order_items
                GROUP BY order_id
            ) items ON items.order_id = o.id
            WHERE o.created_at >= %s AND o.status != 'cancelled'
            GROUP BY DATE(o.created_at)
            ORDER BY date ASC
        """, (start_date.date(),))
        
        results = cursor.fetchall()
        db.close()
        
        # Rellenar días faltantes con 0
        data = []
        current = start_date
        while current <= end_date:
            day_str = current.strftime("%Y-%m-%d")
            day_data = next((row for row in results if str(row['date']) == day_str), None)
            data.append({
                "name": current.strftime("%a"),
                "revenue": float(day_data['revenue'] or 0) if day_data else 0
            })
            current += timedelta(days=1)
            
        return data
    except Exception as e:
        db.close()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/hours-chart")
def get_hours_chart_data():
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    cursor = db.cursor(dictionary=True)
    try:
        # Pedidos por hora hoy (Hora Bogotá)
        today = get_bogota_time().date()
        
        cursor.execute("""
            SELECT HOUR(created_at) as hour, COUNT(*) as count 
            FROM orders 
            WHERE DATE(created_at) = %s
            GROUP BY HOUR(created_at)
            ORDER BY hour ASC
        """, (today,))
        
        results = cursor.fetchall()
        db.close()
        
        data = []
        for h in range(24):
            hour_data = next((row for row in results if row['hour'] == h), None)
            data.append({
                "name": f"{h}:00",
                "orders": int(hour_data['count'] if hour_data else 0)
            })
        return data
    except Exception as e:
        db.close()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/top-businesses")
def get_top_businesses_chart():
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT
                b.name,
                COUNT(o.id) as orders,
                SUM(
                    CASE
                        WHEN COALESCE(o.delivery_fee, 0) + COALESCE(o.night_fee, 0) > 0
                        THEN COALESCE(o.delivery_fee, 0) + COALESCE(o.night_fee, 0)
                        ELSE GREATEST(COALESCE(o.total, 0) - COALESCE(items.items_total, 0), 0)
                    END
                ) as revenue
            FROM businesses b
            JOIN orders o ON b.id = o.business_id
            LEFT JOIN (
                SELECT order_id, SUM(price * quantity) as items_total
                FROM order_items
                GROUP BY order_id
            ) items ON items.order_id = o.id
            WHERE o.status != 'cancelled'
            GROUP BY b.id
            ORDER BY revenue DESC
            LIMIT 5
        """)
        results = cursor.fetchall()
        db.close()
        
        return [
            {
                "name": row['name'],
                "orders": int(row['orders'] or 0),
                "revenue": float(row['revenue'] or 0)
            } for row in results
        ]
    except Exception as e:
        db.close()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/couriers")
def get_couriers(status_filter: Optional[str] = None):
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = db.cursor(dictionary=True)
    query = """
        SELECT c.*, u.email, u.username, u.visible_password
        FROM couriers c 
        JOIN users u ON c.user_id = u.id
    """
    params = []
    if status_filter:
        query += " WHERE c.status = %s"
        params.append(status_filter)
    
    cursor.execute(query, params)
    couriers = cursor.fetchall()
    db.close()
    return couriers

@router.post("/couriers")
def create_courier(courier_data: CourierCreateRequest):
    """
    Crea un nuevo domiciliario y su cuenta de usuario asociada.
    """
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        if not courier_data.username or len(courier_data.username.strip()) == 0:
            raise HTTPException(status_code=400, detail="El nombre de usuario no puede estar vacío")
        
        if not courier_data.email or len(courier_data.email.strip()) == 0:
            raise HTTPException(status_code=400, detail="El correo electrónico no puede estar vacío")
        
        email_lower = courier_data.email.strip().lower()
        if "@" not in email_lower or "." not in email_lower:
            raise HTTPException(status_code=400, detail="El correo electrónico no es válido")
        
        if not courier_data.password or len(courier_data.password.strip()) == 0:
            raise HTTPException(status_code=400, detail="La contraseña no puede estar vacía")
        
        if len(courier_data.password) < 6:
            raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 6 caracteres")
        
        username = courier_data.username.strip()
        email = email_lower
        password = courier_data.password
        
        cursor.execute("SELECT id FROM users WHERE username = %s", (username,))
        if cursor.fetchone():
            db.close()
            raise HTTPException(status_code=400, detail=f"El nombre de usuario '{username}' ya está en uso")
        
        cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
        if cursor.fetchone():
            db.close()
            raise HTTPException(status_code=400, detail=f"El correo electrónico '{email}' ya está registrado")
        
        hashed_password = hash_password(password)
        
        cursor.execute(
            "INSERT INTO users (username, email, password_hash, visible_password, role) VALUES (%s, %s, %s, %s, %s)",
            (username, email, hashed_password, password, 'courier')
        )
        db.commit()
        
        cursor.execute("SELECT id FROM users WHERE username = %s", (username,))
        user_result = cursor.fetchone()
        user_id = user_result['id'] if user_result else None
        
        cursor.execute(
            """INSERT INTO couriers (user_id, name, phone, vehicle, status, rating, earnings, deliveries) 
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
            (user_id, courier_data.name, courier_data.phone, courier_data.vehicle, 'online', 5.0, 0, 0)
        )
        db.commit()
        
        db.close()
        return {"message": "Domiciliario y usuario creados exitosamente"}
    except HTTPException:
        db.close()
        raise
    except Exception as e:
        db.rollback()
        db.close()
        raise HTTPException(status_code=500, detail=f"Error al crear el domiciliario: {str(e)}")

@router.patch("/couriers/{courier_id}")
def update_courier(courier_id: int, courier_data: dict):
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = db.cursor(dictionary=True)
    try:
        # 1. Obtener el user_id asociado al domiciliario
        cursor.execute("SELECT user_id FROM couriers WHERE id = %s", (courier_id,))
        result = cursor.fetchone()
        if not result:
            db.close()
            raise HTTPException(status_code=404, detail="Courier not found")
        
        user_id = result['user_id']
        
        # 2. Actualizar tabla users si se proporciona email o password
        user_updates = []
        user_params = []
        
        if 'email' in courier_data and courier_data['email']:
            email = courier_data['email'].strip().lower()
            # Verificar duplicados
            cursor.execute("SELECT id FROM users WHERE email = %s AND id != %s", (email, user_id))
            if cursor.fetchone():
                raise HTTPException(status_code=400, detail="El correo electrónico ya está en uso por otro usuario")
            
            user_updates.append("email = %s")
            user_params.append(email)
            
        if 'password' in courier_data and courier_data['password']:
            password = courier_data['password']
            if len(password) < 6:
                raise HTTPException(status_code=400, detail="La nueva contraseña debe tener al menos 6 caracteres")
            
            hashed_password = hash_password(password)
            user_updates.append("password_hash = %s")
            user_params.append(hashed_password)
            user_updates.append("visible_password = %s")
            user_params.append(password)
            
        if user_updates:
            user_query = f"UPDATE users SET {', '.join(user_updates)} WHERE id = %s"
            user_params.append(user_id)
            cursor.execute(user_query, user_params)

        # 3. Actualizar tabla couriers
        courier_updates = []
        courier_params = []
        for k, v in courier_data.items():
            if k in ['name', 'phone', 'vehicle', 'status', 'rating', 'earnings', 'deliveries']:
                courier_updates.append(f"{k} = %s")
                courier_params.append(v)
        
        if courier_updates:
            courier_query = f"UPDATE couriers SET {', '.join(courier_updates)} WHERE id = %s"
            courier_params.append(courier_id)
            cursor.execute(courier_query, courier_params)
            
        db.commit()
        db.close()
        return {"message": "Courier and User updated successfully"}
    except HTTPException as he:
        db.close()
        raise he
    except Exception as e:
        if db: db.rollback()
        if db: db.close()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/maintenance")
def get_maintenance_mode():
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT config_value FROM system_config WHERE config_key = 'maintenance_mode'")
        result = cursor.fetchone()
        return {"maintenance_mode": result['config_value'] == 'true' if result else False}
    finally:
        db.close()

@router.post("/maintenance")
def toggle_maintenance_mode(data: dict):
    enabled = data.get("enabled", False)
    db = get_db()
    cursor = db.cursor()
    try:
        val = 'true' if enabled else 'false'
        cursor.execute("UPDATE system_config SET config_value = %s WHERE config_key = 'maintenance_mode'", (val,))
        db.commit()
        
        # Opcional: Notificar vía websocket a todos que la plataforma entró en mantenimiento
        return {"message": "Maintenance mode updated", "maintenance_mode": enabled}
    finally:
        db.close()

@router.get("/theme-color")
def get_theme_color_admin():
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT config_value FROM system_config WHERE config_key = 'theme_color'")
        result = cursor.fetchone()
        return {"theme_color": result['config_value'] if result else "#f97316"}
    finally:
        db.close()

@router.post("/theme-color")
def save_theme_color(data: dict):
    theme_color = data.get("theme_color", "#f97316").strip()
    if not theme_color.startswith("#") or len(theme_color) not in [4, 7]:
        raise HTTPException(status_code=400, detail="Formato de color hexadecimal inválido")
        
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT config_value FROM system_config WHERE config_key = 'theme_color'")
        result = cursor.fetchone()
        if result:
            cursor.execute("UPDATE system_config SET config_value = %s WHERE config_key = 'theme_color'", (theme_color,))
        else:
            cursor.execute("INSERT INTO system_config (config_key, config_value) VALUES ('theme_color', %s)", (theme_color,))
        db.commit()
        return {"message": "Color de tema actualizado correctamente", "theme_color": theme_color}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()

@router.delete("/theme-color")
def reset_theme_color():
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    cursor = db.cursor()
    try:
        cursor.execute("DELETE FROM system_config WHERE config_key = 'theme_color'")
        db.commit()
        return {"message": "Color restaurado al naranja original de Fasty", "theme_color": "#f97316"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()

@router.delete("/couriers/{courier_id}")
def delete_courier(courier_id: int):
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("DELETE FROM couriers WHERE id = %s", (courier_id,))
        db.commit()
        db.close()
        return {"message": "Courier deleted"}
    except Exception as e:
        db.rollback()
        db.close()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/daily-report")
def get_daily_report():
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    cursor = db.cursor(dictionary=True)
    try:
        today = get_bogota_time().date()
        # Traer repartidores y sus totales de hoy
        cursor.execute("""
            SELECT 
                c.id, c.name,
                COUNT(o.id) as total_deliveries,
                SUM(
                    CASE
                        WHEN COALESCE(o.delivery_fee, 0) + COALESCE(o.night_fee, 0) > 0
                        THEN COALESCE(o.delivery_fee, 0) + COALESCE(o.night_fee, 0)
                        ELSE GREATEST(COALESCE(o.total, 0) - COALESCE(items.items_total, 0), 0)
                    END
                ) as total_revenue
            FROM couriers c
            LEFT JOIN orders o ON c.id = o.courier_id AND o.status = 'delivered' AND DATE(o.created_at) = %s
            LEFT JOIN (
                SELECT order_id, SUM(price * quantity) as items_total
                FROM order_items
                GROUP BY order_id
            ) items ON items.order_id = o.id
            GROUP BY c.id
            ORDER BY total_deliveries DESC
        """, (today,))
        
        report = cursor.fetchall()
        
        # Detalle de pedidos por repartidor
        for courier in report:
            cursor.execute("""
                SELECT
                       o.id, o.customer_name,
                       CASE
                           WHEN COALESCE(o.delivery_fee, 0) + COALESCE(o.night_fee, 0) > 0
                           THEN COALESCE(o.delivery_fee, 0) + COALESCE(o.night_fee, 0)
                           ELSE GREATEST(COALESCE(o.total, 0) - COALESCE(items.items_total, 0), 0)
                       END as total,
                       o.created_at, b.name as business_name
                FROM orders o
                JOIN businesses b ON o.business_id = b.id
                LEFT JOIN (
                    SELECT order_id, SUM(price * quantity) as items_total
                    FROM order_items
                    GROUP BY order_id
                ) items ON items.order_id = o.id
                WHERE o.courier_id = %s AND o.status = 'delivered' AND DATE(o.created_at) = %s
                ORDER BY o.created_at DESC
            """, (courier['id'], today))
            courier['orders'] = cursor.fetchall()
            
        return report
    finally:
        cursor.close()
        db.close()

@router.post("/broadcast")
async def send_broadcast(data: BroadcastRequest, background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="No tienes permisos de administrador")
        
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
        
    cursor = db.cursor(dictionary=True)
    try:
        # 1. Guardar en base de datos
        sql = """
        INSERT INTO broadcast_notifications (title, body, redirect_url)
        VALUES (%s, %s, %s)
        """
        cursor.execute(sql, (data.title, data.body, data.redirect_url))
        db.commit()
        broadcast_id = cursor.lastrowid
        
        # 2. Notificación en Tiempo Real vía WebSocket
        if websocket_manager:
            payload = {
                "type": "admin_broadcast",
                "id": broadcast_id,
                "title": data.title,
                "body": data.body,
                "redirect_url": data.redirect_url
            }
            
            import asyncio
            ws_tasks = []
            
            for ws in list(websocket_manager.user_connections.values()):
                ws_tasks.append(ws.send_json(payload))
            for ws in list(websocket_manager.courier_connections.values()):
                ws_tasks.append(ws.send_json(payload))
            for ws in list(websocket_manager.business_connections.values()):
                ws_tasks.append(ws.send_json(payload))
                
            if ws_tasks:
                async def safe_ws_broadcast(tasks):
                    await asyncio.gather(*tasks, return_exceptions=True)
                background_tasks.add_task(safe_ws_broadcast, ws_tasks)
        
        # 3. Notificación Push Masiva vía Web Push (Segundo plano)
        push_payload = {
            "title": data.title,
            "body": data.body,
            "url": data.redirect_url
        }
        background_tasks.add_task(broadcast_push_notification, push_payload)
        
        return {
            "id": broadcast_id,
            "title": data.title,
            "body": data.body,
            "redirect_url": data.redirect_url,
            "message": "Notificación masiva en proceso de envío"
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()

@router.get("/broadcasts", response_model=List[dict])
def get_broadcasts_history(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="No tienes permisos de administrador")
        
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
        
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM broadcast_notifications ORDER BY id DESC")
        return cursor.fetchall()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()
