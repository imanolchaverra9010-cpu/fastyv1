"""
Apply all Fasty database migrations in order.
Usage: python backend/run_all_migrations.py
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

load_dotenv(ROOT.parent / ".env")
load_dotenv(ROOT / ".env")

from database import get_db


def section(title: str) -> None:
    print(f"\n=== {title} ===")


def fresh_db():
    import time

    last_error = None
    for attempt in range(5):
        db = get_db()
        if not db:
            time.sleep(1)
            continue
        try:
            db.ping(reconnect=True, attempts=3, delay=1)
            return db
        except Exception as exc:
            last_error = exc
            try:
                db.close()
            except Exception:
                pass
            time.sleep(1.5)
    raise RuntimeError(f"No database connection: {last_error}")


def add_column_safe(cursor, db, table: str, column: str, definition: str) -> None:
    try:
        cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")
        db.commit()
        print(f"  + {table}.{column}")
    except Exception as exc:
        db.rollback()
        if "Duplicate column name" in str(exc) or "1060" in str(exc):
            print(f"  = {table}.{column} (ya existe)")
        else:
            raise


def run_legacy_scripts() -> None:
    legacy = [
        ("fix_db_schema", "fix_schema"),
        ("migrate_requests", "migrate"),
        ("migrate_businesses", "migrate"),
        ("migrate_open_orders", "migrate_open_orders"),
        ("update_hours_schema", "update_schema"),
        ("migrate_ratings", "create_ratings_table"),
        ("migrate_promotions_code", "migrate_promotions_code"),
        ("update_users_oauth", "update_users_table"),
        ("update_couriers", "update_couriers_table"),
        ("update_db", "update_schema"),
        ("migrate_couriers", "migrate"),
        ("fix_order_status_enum", "fix_enum"),
    ]
    for module_name, fn_name in legacy:
        section(module_name)
        try:
            module = __import__(module_name)
            getattr(module, fn_name)()
        except Exception as exc:
            print(f"  WARN: {exc}")


def run_migrations_package() -> None:
    from migrations.add_fee_columns import run as run_fee_columns
    from migrations.add_open_order_origin_coordinates import run as run_open_coords
    from migrations.add_payments_table import run as run_payments
    from migrations.create_order_rejections import run as run_rejections

    for label, runner in [
        ("add_fee_columns", run_fee_columns),
        ("add_open_order_origin_coordinates", run_open_coords),
        ("add_payments_table", run_payments),
        ("create_order_rejections", run_rejections),
    ]:
        section(label)
        try:
            runner()
        except Exception as exc:
            print(f"  WARN: {exc}")


def run_router_schemas() -> None:
    from routers.orders import ensure_open_order_support_schema, ensure_order_tracking_schema
    from routers.businesses import ensure_business_schema, ensure_business_favorites_schema
    from async_jobs import ensure_jobs_schema
    from admin_push import ensure_admin_push_schema

    section("orders.ensure_open_order_support_schema")
    db = fresh_db()
    try:
        ensure_open_order_support_schema(db)
        ensure_order_tracking_schema(db)
    finally:
        db.close()

    section("businesses.ensure_business_schema")
    db = fresh_db()
    try:
        ensure_business_schema(db)
        ensure_business_favorites_schema(db)
    finally:
        db.close()

    section("async_jobs.ensure_jobs_schema")
    ensure_jobs_schema()

    section("admin_push.ensure_admin_push_schema")
    db = fresh_db()
    try:
        ensure_admin_push_schema(db)
    finally:
        db.close()

    db = fresh_db()
    try:
        cursor = db.cursor()
        try:
            section("extra columns and tables")
            add_column_safe(cursor, db, "orders", "order_type", "ENUM('regular','open','business_requested') DEFAULT 'regular'")
            add_column_safe(cursor, db, "orders", "tracking_token", "VARCHAR(64) NULL")
            add_column_safe(cursor, db, "orders", "promo_code", "VARCHAR(50) NULL")
            add_column_safe(cursor, db, "orders", "cancellation_reason", "TEXT NULL")
            add_column_safe(cursor, db, "orders", "estimated_delivery_time", "DATETIME NULL")
            add_column_safe(cursor, db, "businesses", "free_delivery", "TINYINT(1) NOT NULL DEFAULT 0")
            add_column_safe(cursor, db, "business_requests", "image_url", "VARCHAR(500) NULL")
            add_column_safe(cursor, db, "business_requests", "password", "VARCHAR(255) NULL")
            add_column_safe(cursor, db, "users", "visible_password", "VARCHAR(255) NULL")

            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS system_config (
                    config_key VARCHAR(100) PRIMARY KEY,
                    config_value TEXT NOT NULL,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
                """
            )
            db.commit()
            print("  + system_config")

            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS home_banners (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    title VARCHAR(120) NOT NULL,
                    subtitle VARCHAR(255) DEFAULT NULL,
                    image_url VARCHAR(500) NOT NULL,
                    link_url VARCHAR(500) DEFAULT NULL,
                    sort_order INT NOT NULL DEFAULT 0,
                    is_active TINYINT(1) NOT NULL DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
                """
            )
            db.commit()
            print("  + home_banners")

            try:
                cursor.execute("ALTER TABLE orders ADD INDEX idx_orders_batch_id (batch_id)")
                db.commit()
                print("  + idx_orders_batch_id")
            except Exception as exc:
                db.rollback()
                if "1061" in str(exc) or "Duplicate key name" in str(exc):
                    print("  = idx_orders_batch_id (ya existe)")
                else:
                    print(f"  WARN batch index: {exc}")
        finally:
            cursor.close()
    finally:
        db.close()


def print_summary() -> None:
    db = fresh_db()
    cursor = db.cursor(dictionary=True)
    try:
        section("Resumen")
        for table in [
            "users",
            "businesses",
            "menu_items",
            "orders",
            "couriers",
            "promotions",
            "payments",
            "async_jobs",
            "system_config",
        ]:
            try:
                cursor.execute(f"SELECT COUNT(*) AS n FROM `{table}`")
                print(f"  {table}: {cursor.fetchone()['n']}")
            except Exception as exc:
                print(f"  {table}: (no disponible) {exc}")

        cursor.execute("SHOW COLUMNS FROM businesses LIKE 'free_delivery'")
        print(f"  businesses.free_delivery: {'OK' if cursor.fetchone() else 'FALTA'}")
    finally:
        cursor.close()
        db.close()


def main() -> None:
    router_only = "--router-only" in sys.argv

    db = fresh_db()
    db.close()
    print("Conexion a Hostinger OK")

    if not router_only:
        run_legacy_scripts()
        run_migrations_package()

    run_router_schemas()
    print_summary()
    print("\nMigraciones completadas.")


if __name__ == "__main__":
    main()
