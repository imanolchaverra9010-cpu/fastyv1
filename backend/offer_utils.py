"""Shared helpers for open-order courier offers."""
import re

OFFER_TTL_MINUTES = 15


def _safe_alter_table_column(cursor, db, table_name, column_name, column_def):
    try:
        cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_def}")
        db.commit()
    except Exception as e:
        db.rollback()
        if "Duplicate column name" not in str(e) and "1060" not in str(e):
            raise


def ensure_offer_expires_column(db):
    cursor = db.cursor()
    try:
        _safe_alter_table_column(
            cursor,
            db,
            "order_courier_offers",
            "expires_at",
            "TIMESTAMP NULL",
        )
    finally:
        cursor.close()


def expire_stale_offers(cursor, db, order_id: str | None = None):
    ensure_offer_expires_column(db)
    if order_id:
        cursor.execute(
            """
            UPDATE order_courier_offers
            SET status = 'rejected', updated_at = CURRENT_TIMESTAMP
            WHERE order_id = %s
              AND status = 'pending'
              AND expires_at IS NOT NULL
              AND expires_at < NOW()
            """,
            (order_id,),
        )
    else:
        cursor.execute(
            """
            UPDATE order_courier_offers
            SET status = 'rejected', updated_at = CURRENT_TIMESTAMP
            WHERE status = 'pending'
              AND expires_at IS NOT NULL
              AND expires_at < NOW()
            """
        )
    db.commit()


def resolve_order_recipient_user_ids(cursor, order: dict) -> list[int]:
    """User IDs that should receive notifications for an order."""
    ids: list[int] = []
    if order.get("user_id"):
        ids.append(int(order["user_id"]))

    phone = (order.get("customer_phone") or "").strip()
    if phone:
        digits = re.sub(r"\D", "", phone)
        tail = digits[-10:] if len(digits) >= 10 else digits
        if len(tail) >= 7:
            cursor.execute(
                """
                SELECT id FROM users
                WHERE REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+57', ''), '+', '')
                      LIKE %s
                LIMIT 1
                """,
                (f"%{tail}",),
            )
            row = cursor.fetchone()
            if row:
                uid = int(row["id"])
                if uid not in ids:
                    ids.append(uid)
    return ids
