"""Push notifications for admin operational alerts with deduplication."""
from datetime import timedelta
from database import get_db
from utils import get_bogota_time
from routers.push import send_push_notification

ADMIN_ALERT_COOLDOWN_MINUTES = 30
UNASSIGNED_ORDER_THRESHOLD_MINUTES = 10


def ensure_admin_push_schema(db):
    cursor = db.cursor()
    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS admin_push_dedup (
                alert_key VARCHAR(120) PRIMARY KEY,
                sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_admin_push_dedup_sent (sent_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
        """)
        db.commit()
    finally:
        cursor.close()


def _get_admin_user_ids(cursor) -> list[int]:
    cursor.execute("SELECT id FROM users WHERE role = 'admin'")
    return [int(row["id"]) for row in cursor.fetchall()]


def _should_send_alert(cursor, alert_key: str, cooldown_minutes: int) -> bool:
    cursor.execute(
        "SELECT sent_at FROM admin_push_dedup WHERE alert_key = %s",
        (alert_key,),
    )
    row = cursor.fetchone()
    if not row or not row.get("sent_at"):
        return True
    sent_at = row["sent_at"]
    if hasattr(sent_at, "tzinfo") and sent_at.tzinfo is not None:
        elapsed = get_bogota_time() - sent_at
    else:
        elapsed = get_bogota_time().replace(tzinfo=None) - sent_at
    return elapsed >= timedelta(minutes=cooldown_minutes)


def _mark_alert_sent(cursor, db, alert_key: str):
    cursor.execute(
        """
        INSERT INTO admin_push_dedup (alert_key, sent_at)
        VALUES (%s, %s)
        ON DUPLICATE KEY UPDATE sent_at = VALUES(sent_at)
        """,
        (alert_key, get_bogota_time()),
    )
    db.commit()


def notify_admins_push(
    title: str,
    body: str,
    url: str = "/admin",
    alert_key: str | None = None,
    cooldown_minutes: int = ADMIN_ALERT_COOLDOWN_MINUTES,
) -> int:
    """Send push to all admins. Returns count of admins notified."""
    db = get_db()
    if not db:
        return 0

    cursor = db.cursor(dictionary=True)
    try:
        ensure_admin_push_schema(db)
        if alert_key and not _should_send_alert(cursor, alert_key, cooldown_minutes):
            return 0

        admin_ids = _get_admin_user_ids(cursor)
        sent = 0
        payload = {"title": title, "body": body, "url": url, "type": "admin_alert"}
        for admin_id in admin_ids:
            if send_push_notification(admin_id, payload):
                sent += 1

        if sent > 0 and alert_key:
            _mark_alert_sent(cursor, db, alert_key)
        return sent
    except Exception as exc:
        print(f"notify_admins_push error: {exc}")
        return 0
    finally:
        cursor.close()
        db.close()


def scan_and_push_operational_alerts() -> dict:
    """Scan DB for operational issues and push admins (deduped)."""
    db = get_db()
    if not db:
        return {"sent": 0, "scanned": 0}

    cursor = db.cursor(dictionary=True)
    sent_count = 0
    scanned = 0
    try:
        ensure_admin_push_schema(db)

        cursor.execute(
            f"""
            SELECT o.id, o.customer_name, o.order_type, o.origin_name,
                   TIMESTAMPDIFF(MINUTE, o.created_at, NOW()) AS waiting_minutes,
                   b.name AS business_name
            FROM orders o
            LEFT JOIN businesses b ON b.id = o.business_id
            WHERE o.courier_id IS NULL
              AND o.status IN ('pending', 'confirmed', 'preparing')
              AND TIMESTAMPDIFF(MINUTE, o.created_at, NOW()) > %s
            ORDER BY o.created_at ASC
            LIMIT 20
            """,
            (UNASSIGNED_ORDER_THRESHOLD_MINUTES,),
        )
        for order in cursor.fetchall():
            scanned += 1
            label = order.get("origin_name") if order.get("order_type") == "open" else order.get("business_name")
            sent_count += notify_admins_push(
                title="⏳ Pedido sin asignar",
                body=f"#{order['id']} · {order['customer_name']} · {order['waiting_minutes']} min esperando",
                url="/admin/pedidos",
                alert_key=f"unassigned:{order['id']}",
            )

        cursor.execute(
            """
            SELECT c.id, c.name, c.status, COUNT(o.id) AS active_orders
            FROM couriers c
            INNER JOIN orders o ON o.courier_id = c.id
            WHERE c.status != 'online'
              AND o.status IN ('confirmed', 'preparing', 'shipped', 'in_transit')
            GROUP BY c.id, c.name, c.status
            LIMIT 15
            """
        )
        for courier in cursor.fetchall():
            scanned += 1
            sent_count += notify_admins_push(
                title="📴 Domiciliario offline",
                body=f"{courier['name']} ({courier['status']}) con {courier['active_orders']} pedido(s) activo(s)",
                url="/admin/domiciliarios",
                alert_key=f"offline:{courier['id']}",
            )

        today = get_bogota_time().date()
        cursor.execute(
            """
            SELECT order_id, reconciliation_status FROM (
            SELECT o.id AS order_id,
                   CASE
                       WHEN o.payment_method IN ('card', 'wallet', 'Transferencia', 'transfer') AND p.id IS NULL THEN 'missing_payment'
                       WHEN p.status = 'APPROVED' AND o.status NOT IN ('confirmed', 'preparing', 'shipped', 'in_transit', 'delivered') THEN 'payment_approved_order_not_confirmed'
                       WHEN p.id IS NOT NULL AND ROUND(COALESCE(p.amount, 0), 0) != ROUND(COALESCE(o.total, 0), 0) THEN 'amount_mismatch'
                       WHEN p.status IN ('DECLINED', 'VOIDED', 'ERROR') AND o.status NOT IN ('cancelled', 'pending_payment') THEN 'failed_payment_active_order'
                       ELSE 'ok'
                   END AS reconciliation_status
            FROM orders o
            LEFT JOIN payments p ON p.order_id = o.id
            WHERE DATE(o.created_at) = %s
            ) AS wompi_rows
            WHERE reconciliation_status != 'ok'
            LIMIT 15
            """,
            (today,),
        )
        for row in cursor.fetchall():
            scanned += 1
            sent_count += notify_admins_push(
                title="💳 Alerta Wompi",
                body=f"Pedido #{row['order_id']}: {row['reconciliation_status']}",
                url="/admin/operacion",
                alert_key=f"wompi:{row['order_id']}:{row['reconciliation_status']}",
            )

        try:
            from routers.rides import ensure_rides_schema
            ensure_rides_schema(db)
            cursor.execute(
                """
                SELECT s.id, s.ride_id, u.username, r.pickup_address, r.dropoff_address
                FROM ride_sos_events s
                JOIN users u ON u.id = s.user_id
                JOIN ride_requests r ON r.id = s.ride_id
                WHERE s.status = 'active'
                ORDER BY s.created_at DESC
                LIMIT 10
                """
            )
            for sos in cursor.fetchall():
                scanned += 1
                sent_count += notify_admins_push(
                    title="🚨 SOS viaje activo",
                    body=f"{sos['username']} · viaje {sos['ride_id']}",
                    url="/admin/viajes",
                    alert_key=f"sos:{sos['id']}",
                    cooldown_minutes=15,
                )
        except Exception:
            pass

        return {"sent": sent_count, "scanned": scanned}
    finally:
        cursor.close()
        db.close()


def notify_courier_offline_with_orders(courier_id: int, courier_name: str, courier_status: str, active_orders: int):
    notify_admins_push(
        title="📴 Domiciliario offline",
        body=f"{courier_name} ({courier_status}) tiene {active_orders} pedido(s) activo(s)",
        url="/admin/domiciliarios",
        alert_key=f"offline:{courier_id}",
        cooldown_minutes=15,
    )


def notify_wompi_issue(order_id: str, issue_type: str, detail: str = ""):
    body = f"Pedido #{order_id}: {issue_type}"
    if detail:
        body = f"{body} · {detail}"
    notify_admins_push(
        title="💳 Alerta Wompi",
        body=body,
        url="/admin/operacion",
        alert_key=f"wompi:{order_id}:{issue_type}",
        cooldown_minutes=20,
    )
