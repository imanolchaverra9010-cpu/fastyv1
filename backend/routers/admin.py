from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Header
from fastapi.responses import PlainTextResponse
from database import get_db
from typing import List, Dict, Optional
from datetime import datetime, timedelta
import uuid
import os
from utils import pwd_context, hash_password, get_bogota_time, log_event
from pydantic import BaseModel
from security import get_current_user, require_admin
from .push import broadcast_push_notification
from admin_push import scan_and_push_operational_alerts, notify_admins_push

router = APIRouter()

COURIER_EARNINGS_SHARE = 0.60
BUSINESS_COMMISSION_RATE = 0.08
UNASSIGNED_ORDER_THRESHOLD_MINUTES = 10

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
def get_admin_stats(current_user: dict = Depends(get_current_user)):
    require_admin(current_user)
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
def get_revenue_chart_data(current_user: dict = Depends(get_current_user)):
    require_admin(current_user)
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
def get_hours_chart_data(current_user: dict = Depends(get_current_user)):
    require_admin(current_user)
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
def get_top_businesses_chart(current_user: dict = Depends(get_current_user)):
    require_admin(current_user)
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
def get_couriers(status_filter: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    require_admin(current_user)
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
def create_courier(courier_data: CourierCreateRequest, current_user: dict = Depends(get_current_user)):
    require_admin(current_user)
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
def update_courier(courier_id: int, courier_data: dict, current_user: dict = Depends(get_current_user)):
    require_admin(current_user)
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
def get_maintenance_mode(current_user: dict = Depends(get_current_user)):
    require_admin(current_user)
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT config_value FROM system_config WHERE config_key = 'maintenance_mode'")
        result = cursor.fetchone()
        return {"maintenance_mode": result['config_value'] == 'true' if result else False}
    finally:
        db.close()

@router.post("/maintenance")
def toggle_maintenance_mode(data: dict, current_user: dict = Depends(get_current_user)):
    require_admin(current_user)
    enabled = data.get("enabled", False)
    db = get_db()
    cursor = db.cursor()
    try:
        val = 'true' if enabled else 'false'
        cursor.execute("SELECT config_key FROM system_config WHERE config_key = 'maintenance_mode'")
        if cursor.fetchone():
            cursor.execute(
                "UPDATE system_config SET config_value = %s WHERE config_key = 'maintenance_mode'",
                (val,),
            )
        else:
            cursor.execute(
                "INSERT INTO system_config (config_key, config_value) VALUES ('maintenance_mode', %s)",
                (val,),
            )
        db.commit()
        from cache import delete_cache
        delete_cache("config:maintenance")
        
        # Opcional: Notificar vía websocket a todos que la plataforma entró en mantenimiento
        return {"message": "Maintenance mode updated", "maintenance_mode": enabled}
    finally:
        db.close()

@router.get("/theme-color")
def get_theme_color_admin(current_user: dict = Depends(get_current_user)):
    require_admin(current_user)
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
def save_theme_color(data: dict, current_user: dict = Depends(get_current_user)):
    require_admin(current_user)
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
        from cache import delete_cache
        delete_cache("config:theme_color")
        return {"message": "Color de tema actualizado correctamente", "theme_color": theme_color}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()

@router.delete("/theme-color")
def reset_theme_color(current_user: dict = Depends(get_current_user)):
    require_admin(current_user)
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    cursor = db.cursor()
    try:
        cursor.execute("DELETE FROM system_config WHERE config_key = 'theme_color'")
        db.commit()
        from cache import delete_cache
        delete_cache("config:theme_color")
        return {"message": "Color restaurado al naranja original de Fasty", "theme_color": "#f97316"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()

@router.delete("/couriers/{courier_id}")
def delete_courier(courier_id: int, current_user: dict = Depends(get_current_user)):
    require_admin(current_user)
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
def get_daily_report(current_user: dict = Depends(get_current_user)):
    require_admin(current_user)
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

@router.get("/operations")
def get_admin_operations(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="No tienes permisos de administrador")

    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")

    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT
                COUNT(*) as total_orders,
                SUM(CASE WHEN o.status = 'delivered' THEN 1 ELSE 0 END) as delivered_orders,
                SUM(CASE WHEN o.status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_orders,
                SUM(CASE WHEN o.status IN ('pending', 'preparing', 'shipped', 'in_transit') THEN 1 ELSE 0 END) as active_orders,
                SUM(CASE WHEN o.status != 'cancelled' THEN COALESCE(o.total, 0) ELSE 0 END) as gross_sales,
                SUM(CASE WHEN o.status != 'cancelled' THEN COALESCE(o.delivery_fee, 0) + COALESCE(o.night_fee, 0) ELSE 0 END) as delivery_income
            FROM orders o
        """)
        financial = cursor.fetchone() or {}

        cursor.execute("""
            SELECT
                b.id,
                b.name,
                COUNT(o.id) as orders,
                SUM(CASE WHEN o.status != 'cancelled' THEN COALESCE(o.total, 0) ELSE 0 END) as sales,
                SUM(CASE WHEN o.status = 'delivered' THEN COALESCE(o.total, 0) ELSE 0 END) as payable_base
            FROM businesses b
            LEFT JOIN orders o ON o.business_id = b.id
            GROUP BY b.id, b.name
            ORDER BY sales DESC
            LIMIT 10
        """)
        business_sales = cursor.fetchall()

        commission_rate = 0.08
        for row in business_sales:
            payable_base = float(row.get("payable_base") or 0)
            row["commission_rate"] = commission_rate
            row["commission"] = round(payable_base * commission_rate, 2)
            row["settlement"] = round(payable_base - row["commission"], 2)

        cursor.execute("""
            SELECT
                COALESCE(payment_method, 'sin_definir') as payment_method,
                COUNT(*) as count,
                SUM(COALESCE(total, 0)) as amount
            FROM orders
            WHERE status != 'cancelled'
            GROUP BY COALESCE(payment_method, 'sin_definir')
            ORDER BY amount DESC
        """)
        payments = cursor.fetchall()

        cursor.execute("""
            SELECT
                c.id,
                c.name,
                c.status,
                c.rating,
                COUNT(o.id) as assigned_orders,
                SUM(CASE WHEN o.status = 'delivered' THEN 1 ELSE 0 END) as delivered_orders,
                SUM(CASE WHEN o.status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_orders,
                SUM(CASE WHEN o.status = 'delivered' THEN COALESCE(o.delivery_fee, 0) + COALESCE(o.night_fee, 0) ELSE 0 END) as generated_delivery_income
            FROM couriers c
            LEFT JOIN orders o ON o.courier_id = c.id
            GROUP BY c.id, c.name, c.status, c.rating
            ORDER BY delivered_orders DESC
            LIMIT 10
        """)
        courier_performance = cursor.fetchall()

        cursor.execute("""
            SELECT
                osl.order_id,
                osl.status,
                osl.changed_at,
                o.customer_name,
                b.name as business_name
            FROM order_status_logs osl
            LEFT JOIN orders o ON o.id = osl.order_id
            LEFT JOIN businesses b ON b.id = o.business_id
            ORDER BY osl.changed_at DESC
            LIMIT 25
        """)
        audit = cursor.fetchall()

        cursor.execute("""
            SELECT
                id,
                customer_name,
                customer_phone,
                cancellation_reason,
                created_at
            FROM orders
            WHERE status = 'cancelled'
            ORDER BY created_at DESC
            LIMIT 15
        """)
        support_cases = cursor.fetchall()

        cursor.execute("""
            SELECT
                DATE(created_at) as date,
                COUNT(*) as orders,
                SUM(CASE WHEN status != 'cancelled' THEN COALESCE(total, 0) ELSE 0 END) as sales
            FROM orders
            WHERE created_at >= %s
            GROUP BY DATE(created_at)
            ORDER BY date DESC
        """, ((get_bogota_time() - timedelta(days=30)).date(),))
        daily_sales = cursor.fetchall()

        cursor.execute("""
            SELECT
                MIN(delivery_fee) as min_fee,
                MAX(delivery_fee) as max_fee,
                AVG(delivery_fee) as avg_fee,
                MIN(night_fee) as min_night_fee,
                MAX(night_fee) as max_night_fee,
                AVG(night_fee) as avg_night_fee
            FROM orders
            WHERE status != 'cancelled'
        """)
        zone_fees = cursor.fetchone() or {}

        return {
            "financial": financial,
            "business_sales": business_sales,
            "payments": payments,
            "courier_performance": courier_performance,
            "audit": audit,
            "support_cases": support_cases,
            "daily_sales": daily_sales,
            "zone_fees": zone_fees,
            "settings": {
                "commission_rate": commission_rate,
                "zone_pricing_model": "base + distancia + recargo nocturno"
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()


CRON_SECRET = os.getenv("CRON_SECRET") or os.getenv("ADMIN_CRON_SECRET")


@router.post("/jobs/process-pending")
async def admin_process_pending_jobs(current_user: dict = Depends(get_current_user)):
    require_admin(current_user)
    from async_jobs import process_pending_jobs
    return await process_pending_jobs(25)


@router.get("/jobs/{job_id}")
def get_async_job_status(job_id: str, current_user: dict = Depends(get_current_user)):
    require_admin(current_user)
    from async_jobs import get_job_status
    status = get_job_status(job_id)
    if not status:
        raise HTTPException(status_code=404, detail="Job no encontrado")
    return status


@router.post("/push-alerts/scan")
def admin_scan_push_alerts(
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
):
    require_admin(current_user)
    background_tasks.add_task(scan_and_push_operational_alerts)
    return {"message": "Escaneo de alertas iniciado"}


@router.get("/cron/push-alerts")
async def cron_scan_push_alerts(
    x_cron_secret: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
):
    token = x_cron_secret
    if not token and authorization and authorization.startswith("Bearer "):
        token = authorization.removeprefix("Bearer ").strip()
    if not CRON_SECRET or token != CRON_SECRET:
        raise HTTPException(status_code=403, detail="Unauthorized cron")
    result = scan_and_push_operational_alerts()
    from async_jobs import process_pending_jobs
    jobs = await process_pending_jobs(25)
    return {"message": "Cron completed", "alerts": result, "jobs": jobs}


@router.post("/push-alerts/test")
def admin_test_push_alert(current_user: dict = Depends(get_current_user)):
    require_admin(current_user)
    sent = notify_admins_push(
        title="🔔 Prueba de alertas admin",
        body="Las notificaciones operativas están activas en Fasty.",
        url="/admin",
        alert_key=None,
    )
    return {"sent": sent}


def _period_filter(period: str) -> tuple[str, list]:
    today = get_bogota_time().date()
    if period == "today":
        return " AND DATE(o.created_at) = %s", [today]
    if period == "7d":
        return " AND DATE(o.created_at) >= %s", [today - timedelta(days=6)]
    return " AND DATE(o.created_at) >= %s", [today - timedelta(days=29)]


@router.get("/alerts")
def get_admin_alerts(current_user: dict = Depends(get_current_user)):
    require_admin(current_user)
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")

    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute(
            f"""
            SELECT
                o.id,
                o.customer_name,
                o.delivery_address,
                o.status,
                o.order_type,
                o.origin_name,
                o.created_at,
                TIMESTAMPDIFF(MINUTE, o.created_at, NOW()) AS waiting_minutes,
                b.name AS business_name
            FROM orders o
            LEFT JOIN businesses b ON b.id = o.business_id
            WHERE o.courier_id IS NULL
              AND o.status IN ('pending', 'confirmed', 'preparing')
              AND TIMESTAMPDIFF(MINUTE, o.created_at, NOW()) > %s
            ORDER BY o.created_at ASC
            LIMIT 50
            """,
            (UNASSIGNED_ORDER_THRESHOLD_MINUTES,),
        )
        unassigned_orders = cursor.fetchall()

        cursor.execute(
            """
            SELECT
                c.id,
                c.name,
                c.status AS courier_status,
                COUNT(o.id) AS active_orders,
                GROUP_CONCAT(o.id ORDER BY o.created_at SEPARATOR ', ') AS order_ids
            FROM couriers c
            INNER JOIN orders o ON o.courier_id = c.id
            WHERE c.status != 'online'
              AND o.status IN ('confirmed', 'preparing', 'shipped', 'in_transit')
            GROUP BY c.id, c.name, c.status
            ORDER BY active_orders DESC
            LIMIT 30
            """
        )
        offline_couriers = cursor.fetchall()

        ride_sos = []
        try:
            from .rides import ensure_rides_schema
            ensure_rides_schema(db)
            cursor.execute(
                """
                SELECT
                    s.id,
                    s.ride_id,
                    s.user_id,
                    s.lat,
                    s.lng,
                    s.message,
                    s.status,
                    s.created_at,
                    u.username,
                    r.pickup_address,
                    r.dropoff_address,
                    r.status AS ride_status
                FROM ride_sos_events s
                JOIN users u ON u.id = s.user_id
                JOIN ride_requests r ON r.id = s.ride_id
                WHERE s.status = 'active'
                ORDER BY s.created_at DESC
                LIMIT 20
                """
            )
            ride_sos = cursor.fetchall()
        except Exception:
            ride_sos = []

        total = len(unassigned_orders) + len(offline_couriers) + len(ride_sos)
        return {
            "summary": {
                "total": total,
                "unassigned_orders": len(unassigned_orders),
                "offline_couriers": len(offline_couriers),
                "ride_sos": len(ride_sos),
            },
            "unassigned_orders": unassigned_orders,
            "offline_couriers_with_orders": offline_couriers,
            "ride_sos": ride_sos,
            "threshold_minutes": UNASSIGNED_ORDER_THRESHOLD_MINUTES,
        }
    finally:
        cursor.close()
        db.close()


@router.get("/metrics")
def get_admin_metrics(period: str = "7d", current_user: dict = Depends(get_current_user)):
    require_admin(current_user)
    if period not in {"today", "7d", "30d"}:
        raise HTTPException(status_code=400, detail="period debe ser today, 7d o 30d")

    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")

    cursor = db.cursor(dictionary=True)
    try:
        date_clause, date_params = _period_filter(period)

        cursor.execute(
            f"""
            SELECT
                COUNT(*) AS total_orders,
                SUM(CASE WHEN o.status = 'delivered' THEN 1 ELSE 0 END) AS delivered_orders,
                SUM(CASE WHEN o.status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_orders
            FROM orders o
            WHERE 1=1 {date_clause}
            """,
            date_params,
        )
        counts = cursor.fetchone() or {}
        total_orders = int(counts.get("total_orders") or 0)
        cancelled_orders = int(counts.get("cancelled_orders") or 0)
        cancellation_rate_pct = round((cancelled_orders / total_orders) * 100, 1) if total_orders else 0.0

        cursor.execute(
            f"""
            SELECT AVG(delivery_minutes) AS avg_delivery_minutes
            FROM (
                SELECT
                    TIMESTAMPDIFF(
                        MINUTE,
                        o.created_at,
                        MAX(CASE WHEN osl.status = 'delivered' THEN osl.changed_at END)
                    ) AS delivery_minutes
                FROM orders o
                INNER JOIN order_status_logs osl ON osl.order_id = o.id
                WHERE o.status = 'delivered' {date_clause}
                GROUP BY o.id
                HAVING delivery_minutes IS NOT NULL AND delivery_minutes >= 0
            ) delivered_stats
            """,
            date_params,
        )
        avg_row = cursor.fetchone() or {}
        avg_delivery_minutes = round(float(avg_row.get("avg_delivery_minutes") or 0), 1)

        cursor.execute(
            f"""
            SELECT
                c.id,
                c.name,
                COUNT(o.id) AS delivered_orders,
                SUM(COALESCE(o.delivery_fee, 0) + COALESCE(o.night_fee, 0)) AS gross_fees
            FROM couriers c
            INNER JOIN orders o ON o.courier_id = c.id
            WHERE o.status = 'delivered' {date_clause}
            GROUP BY c.id, c.name
            ORDER BY gross_fees DESC
            LIMIT 10
            """,
            date_params,
        )
        courier_earnings = []
        for row in cursor.fetchall():
            gross = float(row.get("gross_fees") or 0)
            courier_earnings.append({
                **row,
                "gross_fees": gross,
                "courier_earnings": round(gross * COURIER_EARNINGS_SHARE, 2),
            })

        cursor.execute(
            f"""
            SELECT
                b.id,
                b.name,
                COUNT(o.id) AS orders,
                SUM(CASE WHEN o.status = 'delivered' THEN COALESCE(o.total, 0) ELSE 0 END) AS gross_sales
            FROM businesses b
            INNER JOIN orders o ON o.business_id = b.id
            WHERE o.status = 'delivered' {date_clause}
            GROUP BY b.id, b.name
            ORDER BY gross_sales DESC
            LIMIT 10
            """,
            date_params,
        )
        business_earnings = []
        for row in cursor.fetchall():
            gross = float(row.get("gross_sales") or 0)
            commission = round(gross * BUSINESS_COMMISSION_RATE, 2)
            business_earnings.append({
                **row,
                "gross_sales": gross,
                "commission": commission,
                "net_settlement": round(gross - commission, 2),
            })

        today = get_bogota_time().date()
        cursor.execute(
            """
            SELECT
                COUNT(*) AS total_checked,
                SUM(
                    CASE
                        WHEN (
                            (o.payment_method IN ('card', 'wallet', 'Transferencia', 'transfer') AND p.id IS NULL)
                            OR (p.status = 'APPROVED' AND o.status NOT IN ('confirmed', 'preparing', 'shipped', 'in_transit', 'delivered'))
                            OR (p.id IS NOT NULL AND ROUND(COALESCE(p.amount, 0), 0) != ROUND(COALESCE(o.total, 0), 0))
                            OR (p.status IN ('DECLINED', 'VOIDED', 'ERROR') AND o.status NOT IN ('cancelled', 'pending_payment'))
                        ) THEN 1 ELSE 0 END
                ) AS issues,
                SUM(CASE WHEN p.status = 'APPROVED' THEN COALESCE(p.amount, 0) ELSE 0 END) AS approved_amount
            FROM orders o
            LEFT JOIN payments p ON p.order_id = o.id
            WHERE DATE(o.created_at) = %s
            """,
            (today,),
        )
        wompi_today = cursor.fetchone() or {}

        return {
            "period": period,
            "avg_delivery_minutes": avg_delivery_minutes,
            "cancellation_rate_pct": cancellation_rate_pct,
            "total_orders": total_orders,
            "delivered_orders": int(counts.get("delivered_orders") or 0),
            "cancelled_orders": cancelled_orders,
            "courier_earnings": courier_earnings,
            "business_earnings": business_earnings,
            "wompi_today": {
                "total_checked": int(wompi_today.get("total_checked") or 0),
                "issues": int(wompi_today.get("issues") or 0),
                "approved_amount": float(wompi_today.get("approved_amount") or 0),
            },
            "settings": {
                "courier_earnings_share": COURIER_EARNINGS_SHARE,
                "business_commission_rate": BUSINESS_COMMISSION_RATE,
            },
        }
    finally:
        cursor.close()
        db.close()


@router.get("/backup.sql", response_class=PlainTextResponse)
def download_database_backup(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="No tienes permisos de administrador")

    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")

    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SHOW TABLES")
        table_key = next(iter(cursor.column_names))
        tables = [row[table_key] for row in cursor.fetchall()]
        lines = [
            "-- Fasty database backup",
            f"-- Generated at {get_bogota_time().isoformat()}",
            "SET FOREIGN_KEY_CHECKS=0;",
        ]
        for table in tables:
            cursor.execute(f"SHOW CREATE TABLE `{table}`")
            create_row = cursor.fetchone()
            lines.append(f"DROP TABLE IF EXISTS `{table}`;")
            lines.append(f"{create_row['Create Table']};")
            cursor.execute(f"SELECT * FROM `{table}`")
            rows = cursor.fetchall()
            for row in rows:
                columns = ", ".join(f"`{column}`" for column in row.keys())
                values = []
                for value in row.values():
                    if value is None:
                        values.append("NULL")
                    else:
                        escaped = str(value).replace("\\", "\\\\").replace("'", "''")
                        values.append(f"'{escaped}'")
                lines.append(f"INSERT INTO `{table}` ({columns}) VALUES ({', '.join(values)});")
        lines.append("SET FOREIGN_KEY_CHECKS=1;")
        log_event("database_backup_generated", admin_id=current_user["id"], tables=len(tables))
        return "\n".join(lines)
    except Exception as e:
        log_event("database_backup_failed", "error", admin_id=current_user["id"], error=str(e))
        raise HTTPException(status_code=500, detail=str(e))
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


class RideReportReview(BaseModel):
    status: str
    admin_notes: Optional[str] = None


@router.get("/rides")
def admin_list_rides(status: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    require_admin(current_user)
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    from .rides import ensure_rides_schema, _serialize_ride
    ensure_rides_schema(db)
    cursor = db.cursor(dictionary=True)
    try:
        query = """
            SELECT r.*, c.name AS driver_name, c.vehicle AS driver_vehicle,
                   c.vehicle_plate AS driver_vehicle_plate, c.ride_verified AS driver_verified
            FROM ride_requests r
            LEFT JOIN couriers c ON c.id = r.driver_id
        """
        params = []
        if status:
            query += " WHERE r.status = %s"
            params.append(status)
        query += " ORDER BY r.created_at DESC LIMIT 300"
        cursor.execute(query, params)
        return [_serialize_ride(row) for row in cursor.fetchall()]
    finally:
        cursor.close()
        db.close()


@router.get("/rides/reports")
def admin_list_ride_reports(status: Optional[str] = "pending", current_user: dict = Depends(get_current_user)):
    require_admin(current_user)
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    from .rides import ensure_rides_schema
    ensure_rides_schema(db)
    cursor = db.cursor(dictionary=True)
    try:
        query = """
            SELECT rep.*, u.username AS reporter_name, r.pickup_address, r.dropoff_address, r.status AS ride_status
            FROM ride_reports rep
            JOIN users u ON u.id = rep.reporter_user_id
            JOIN ride_requests r ON r.id = rep.ride_id
        """
        params = []
        if status:
            query += " WHERE rep.status = %s"
            params.append(status)
        query += " ORDER BY rep.created_at DESC LIMIT 200"
        cursor.execute(query, params)
        return cursor.fetchall()
    finally:
        cursor.close()
        db.close()


@router.patch("/rides/reports/{report_id}")
def admin_review_ride_report(report_id: int, data: RideReportReview, current_user: dict = Depends(get_current_user)):
    require_admin(current_user)
    if data.status not in {"pending", "reviewed", "resolved"}:
        raise HTTPException(status_code=400, detail="Estado inválido")
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    from .rides import ensure_rides_schema, apply_driver_penalty, PENALTY_POINTS
    ensure_rides_schema(db)
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM ride_reports WHERE id = %s", (report_id,))
        report = cursor.fetchone()
        if not report:
            raise HTTPException(status_code=404, detail="Reporte no encontrado")
        cursor.execute(
            "UPDATE ride_reports SET status = %s, admin_notes = COALESCE(%s, admin_notes) WHERE id = %s",
            (data.status, data.admin_notes, report_id),
        )
        if data.status == "resolved" and report.get("target") == "driver":
            cursor.execute("SELECT driver_id FROM ride_requests WHERE id = %s", (report["ride_id"],))
            ride = cursor.fetchone()
            if ride and ride.get("driver_id"):
                reason_key = f"report_{report['category']}"
                points = PENALTY_POINTS.get(reason_key, PENALTY_POINTS.get("report_other", 5))
                apply_driver_penalty(
                    cursor, ride["driver_id"], reason_key, points,
                    report["ride_id"], source="report",
                    notes=data.admin_notes or report.get("description"),
                )
        db.commit()
        return {"message": "Reporte actualizado"}
    finally:
        cursor.close()
        db.close()


@router.get("/rides/sos")
def admin_list_sos_events(active_only: bool = True, current_user: dict = Depends(get_current_user)):
    require_admin(current_user)
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    from .rides import ensure_rides_schema
    ensure_rides_schema(db)
    cursor = db.cursor(dictionary=True)
    try:
        query = """
            SELECT s.*, u.username, r.pickup_address, r.dropoff_address, r.status AS ride_status
            FROM ride_sos_events s
            JOIN users u ON u.id = s.user_id
            JOIN ride_requests r ON r.id = s.ride_id
        """
        if active_only:
            query += " WHERE s.status = 'active'"
        query += " ORDER BY s.created_at DESC LIMIT 100"
        cursor.execute(query)
        return cursor.fetchall()
    finally:
        cursor.close()
        db.close()


@router.patch("/rides/sos/{sos_id}/resolve")
def admin_resolve_sos(sos_id: int, current_user: dict = Depends(get_current_user)):
    require_admin(current_user)
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    from .rides import ensure_rides_schema
    ensure_rides_schema(db)
    cursor = db.cursor()
    try:
        cursor.execute(
            "UPDATE ride_sos_events SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP WHERE id = %s AND status = 'active'",
            (sos_id,),
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Alerta SOS no encontrada o ya resuelta")
        db.commit()
        return {"message": "Alerta SOS marcada como resuelta"}
    finally:
        cursor.close()
        db.close()


@router.patch("/couriers/{courier_id}/ride-verify")
def admin_verify_ride_driver(courier_id: int, data: dict, current_user: dict = Depends(get_current_user)):
    require_admin(current_user)
    verified = bool(data.get("verified", True))
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    cursor = db.cursor()
    try:
        if verified:
            cursor.execute(
                "UPDATE couriers SET ride_verified = TRUE, ride_verified_at = CURRENT_TIMESTAMP WHERE id = %s",
                (courier_id,),
            )
        else:
            cursor.execute(
                "UPDATE couriers SET ride_verified = FALSE, ride_verified_at = NULL WHERE id = %s",
                (courier_id,),
            )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Conductor no encontrado")
        db.commit()
        return {"message": "Verificación de conductor actualizada", "ride_verified": verified}
    finally:
        cursor.close()
        db.close()


@router.get("/rides/penalties")
def admin_list_penalties(driver_id: Optional[int] = None, current_user: dict = Depends(get_current_user)):
    require_admin(current_user)
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    from .rides import ensure_rides_schema
    ensure_rides_schema(db)
    cursor = db.cursor(dictionary=True)
    try:
        query = """
            SELECT p.*, c.name AS driver_name
            FROM ride_penalties p
            JOIN couriers c ON c.id = p.driver_id
        """
        params = []
        if driver_id:
            query += " WHERE p.driver_id = %s"
            params.append(driver_id)
        query += " ORDER BY p.created_at DESC LIMIT 200"
        cursor.execute(query, params)
        return cursor.fetchall()
    finally:
        cursor.close()
        db.close()


@router.post("/rides/penalties")
def admin_add_penalty(data: dict, current_user: dict = Depends(get_current_user)):
    require_admin(current_user)
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    from .rides import ensure_rides_schema, apply_driver_penalty
    ensure_rides_schema(db)
    cursor = db.cursor(dictionary=True)
    try:
        driver_id = data.get("driver_id")
        points = int(data.get("points") or 0)
        reason = data.get("reason") or "admin_manual"
        if not driver_id or points <= 0:
            raise HTTPException(status_code=400, detail="driver_id y points son obligatorios")
        total = apply_driver_penalty(
            cursor, driver_id, reason, points,
            data.get("ride_id"), source="admin", notes=data.get("notes"),
        )
        db.commit()
        return {"message": "Penalización registrada", "total_penalty_points": total}
    finally:
        cursor.close()
        db.close()


@router.patch("/rides/penalties/{penalty_id}/waive")
def admin_waive_penalty(penalty_id: int, current_user: dict = Depends(get_current_user)):
    require_admin(current_user)
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    from .rides import ensure_rides_schema, sync_driver_penalty_points
    ensure_rides_schema(db)
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT driver_id FROM ride_penalties WHERE id = %s", (penalty_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Penalización no encontrada")
        cursor.execute("UPDATE ride_penalties SET waived = TRUE WHERE id = %s", (penalty_id,))
        total = sync_driver_penalty_points(cursor, row["driver_id"])
        db.commit()
        return {"message": "Penalización condonada", "total_penalty_points": total}
    finally:
        cursor.close()
        db.close()


@router.patch("/couriers/{courier_id}/ride-publish-block")
def admin_block_ride_publish(courier_id: int, data: dict, current_user: dict = Depends(get_current_user)):
    require_admin(current_user)
    blocked = bool(data.get("blocked", False))
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    cursor = db.cursor()
    try:
        cursor.execute("UPDATE couriers SET ride_publish_blocked = %s WHERE id = %s", (blocked, courier_id))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Conductor no encontrado")
        db.commit()
        return {"message": "Estado de publicación actualizado", "ride_publish_blocked": blocked}
    finally:
        cursor.close()
        db.close()


@router.get("/rides/driver-requests")
def admin_list_driver_requests(status: Optional[str] = "pending", current_user: dict = Depends(get_current_user)):
    require_admin(current_user)
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    from .rides import ensure_rides_schema
    ensure_rides_schema(db)
    cursor = db.cursor(dictionary=True)
    try:
        query = "SELECT * FROM driver_requests"
        params = []
        if status:
            query += " WHERE status = %s"
            params.append(status)
        query += " ORDER BY created_at DESC LIMIT 200"
        cursor.execute(query, params)
        return cursor.fetchall()
    finally:
        cursor.close()
        db.close()


@router.post("/rides/driver-requests/{request_id}/approve")
def admin_approve_driver_request(request_id: int, current_user: dict = Depends(get_current_user)):
    require_admin(current_user)
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    from .rides import ensure_rides_schema, is_ride_eligible_driver
    ensure_rides_schema(db)
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM driver_requests WHERE id = %s", (request_id,))
        req = cursor.fetchone()
        if not req:
            raise HTTPException(status_code=404, detail="Solicitud no encontrada")
        if req["status"] != "pending":
            raise HTTPException(status_code=400, detail="La solicitud ya fue procesada")
        if not is_ride_eligible_driver({"vehicle": req["vehicle"]}):
            raise HTTPException(status_code=400, detail="El vehículo no es elegible para viajes en carro")

        cursor.execute("SELECT id FROM users WHERE email = %s", (req["email"],))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="El email ya está registrado")

        username = req["name"].lower().replace(" ", "")[:16] + str(uuid.uuid4())[:4]
        password = req["password"]
        hashed_password = hash_password(password)
        cursor.execute(
            "INSERT INTO users (username, email, password_hash, visible_password, role) VALUES (%s, %s, %s, %s, %s)",
            (username, req["email"], hashed_password, password, "courier"),
        )
        user_id = cursor.lastrowid
        cursor.execute("""
            INSERT INTO couriers (
                user_id, name, phone, vehicle, vehicle_plate, vehicle_color, vehicle_model,
                status, rating, earnings, deliveries, ride_verified
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, 'offline', 5.0, 0, 0, FALSE)
        """, (
            user_id, req["name"], req["phone"], req["vehicle"],
            req["vehicle_plate"], req["vehicle_color"], req["vehicle_model"],
        ))
        cursor.execute("UPDATE driver_requests SET status = 'approved' WHERE id = %s", (request_id,))
        db.commit()
        return {
            "message": "Conductor aprobado",
            "username": username,
            "temp_password": password,
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


@router.post("/rides/driver-requests/{request_id}/reject")
def admin_reject_driver_request(request_id: int, current_user: dict = Depends(get_current_user)):
    require_admin(current_user)
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    from .rides import ensure_rides_schema
    ensure_rides_schema(db)
    cursor = db.cursor()
    try:
        cursor.execute(
            "UPDATE driver_requests SET status = 'rejected' WHERE id = %s AND status = 'pending'",
            (request_id,),
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Solicitud no encontrada o ya procesada")
        db.commit()
        return {"message": "Solicitud rechazada"}
    finally:
        cursor.close()
        db.close()
