from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from database import get_db
from security import get_current_user, require_admin
from utils import get_bogota_time, log_event

router = APIRouter()

class SettlementGenerateRequest(BaseModel):
    target_type: str
    target_id: str
    period_start: Optional[str] = None
    period_end: Optional[str] = None
    commission_rate: float = 0.08

class SettlementMarkPaidRequest(BaseModel):
    payment_reference: Optional[str] = None
    notes: Optional[str] = None


def ensure_finance_schema(db):
    cursor = db.cursor()
    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS settlements (
                id INT AUTO_INCREMENT PRIMARY KEY,
                target_type ENUM('business', 'courier') NOT NULL,
                target_id VARCHAR(50) NOT NULL,
                period_start DATE NULL,
                period_end DATE NULL,
                gross_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
                commission_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
                net_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
                status ENUM('pending', 'paid', 'cancelled') NOT NULL DEFAULT 'pending',
                payment_reference VARCHAR(120) NULL,
                notes TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                paid_at TIMESTAMP NULL,
                INDEX idx_settlements_target (target_type, target_id),
                INDEX idx_settlements_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
        """)
        db.commit()
    finally:
        cursor.close()


@router.get("/settlements")
def list_settlements(target_type: Optional[str] = None, status_filter: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    require_admin(current_user)
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    ensure_finance_schema(db)
    cursor = db.cursor(dictionary=True)
    try:
        query = "SELECT * FROM settlements WHERE 1=1"
        params = []
        if target_type:
            query += " AND target_type = %s"
            params.append(target_type)
        if status_filter:
            query += " AND status = %s"
            params.append(status_filter)
        query += " ORDER BY created_at DESC LIMIT 300"
        cursor.execute(query, params)
        return cursor.fetchall()
    finally:
        cursor.close()
        db.close()


@router.post("/settlements/generate")
def generate_settlement(data: SettlementGenerateRequest, current_user: dict = Depends(get_current_user)):
    require_admin(current_user)
    if data.target_type not in {"business", "courier"}:
        raise HTTPException(status_code=400, detail="Tipo de liquidación inválido")

    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    ensure_finance_schema(db)
    cursor = db.cursor(dictionary=True)
    try:
        date_filter = ""
        params = []
        if data.period_start:
            date_filter += " AND DATE(o.created_at) >= %s"
            params.append(data.period_start)
        if data.period_end:
            date_filter += " AND DATE(o.created_at) <= %s"
            params.append(data.period_end)

        if data.target_type == "business":
            cursor.execute(f"""
                SELECT COALESCE(SUM(o.total), 0) AS gross_amount
                FROM orders o
                WHERE o.business_id = %s AND o.status = 'delivered' {date_filter}
            """, [data.target_id, *params])
            row = cursor.fetchone() or {}
            gross = float(row.get("gross_amount") or 0)
            commission = round(gross * data.commission_rate, 2)
            net = round(gross - commission, 2)
        else:
            cursor.execute(f"""
                SELECT COALESCE(SUM(COALESCE(o.delivery_fee, 0) + COALESCE(o.night_fee, 0)), 0) AS gross_amount
                FROM orders o
                WHERE o.courier_id = %s AND o.status = 'delivered' {date_filter}
            """, [data.target_id, *params])
            row = cursor.fetchone() or {}
            gross = float(row.get("gross_amount") or 0)
            commission = 0
            net = gross

        cursor.execute("""
            INSERT INTO settlements (target_type, target_id, period_start, period_end, gross_amount, commission_amount, net_amount)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (data.target_type, data.target_id, data.period_start, data.period_end, gross, commission, net))
        settlement_id = cursor.lastrowid
        db.commit()
        log_event("settlement_generated", settlement_id=settlement_id, target_type=data.target_type, target_id=data.target_id, admin_id=current_user["id"])
        return {"id": settlement_id, "gross_amount": gross, "commission_amount": commission, "net_amount": net, "status": "pending"}
    except Exception as e:
        db.rollback()
        log_event("settlement_generate_failed", "error", error=str(e), admin_id=current_user["id"])
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()


@router.patch("/settlements/{settlement_id}/paid")
def mark_settlement_paid(settlement_id: int, data: SettlementMarkPaidRequest, current_user: dict = Depends(get_current_user)):
    require_admin(current_user)
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    ensure_finance_schema(db)
    cursor = db.cursor()
    try:
        cursor.execute("""
            UPDATE settlements
            SET status = 'paid', payment_reference = %s, notes = %s, paid_at = %s
            WHERE id = %s AND status = 'pending'
        """, (data.payment_reference, data.notes, get_bogota_time(), settlement_id))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Liquidación pendiente no encontrada")
        db.commit()
        log_event("settlement_marked_paid", settlement_id=settlement_id, admin_id=current_user["id"])
        return {"message": "Liquidación marcada como pagada"}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()


@router.get("/payment-reconciliation")
def payment_reconciliation(current_user: dict = Depends(get_current_user)):
    require_admin(current_user)
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT
                o.id AS order_id,
                o.status AS order_status,
                o.total AS order_total,
                o.payment_method,
                p.id AS payment_id,
                p.status AS payment_status,
                p.amount AS payment_amount,
                p.reference,
                p.wompi_transaction_id,
                CASE
                    WHEN o.payment_method IN ('card', 'wallet', 'Transferencia', 'transfer') AND p.id IS NULL THEN 'missing_payment'
                    WHEN p.status = 'APPROVED' AND o.status NOT IN ('confirmed', 'preparing', 'shipped', 'in_transit', 'delivered') THEN 'payment_approved_order_not_confirmed'
                    WHEN p.id IS NOT NULL AND ROUND(COALESCE(p.amount, 0), 0) != ROUND(COALESCE(o.total, 0), 0) THEN 'amount_mismatch'
                    WHEN p.status IN ('DECLINED', 'VOIDED', 'ERROR') AND o.status NOT IN ('cancelled', 'pending_payment') THEN 'failed_payment_active_order'
                    ELSE 'ok'
                END AS reconciliation_status
            FROM orders o
            LEFT JOIN payments p ON p.order_id = o.id
            ORDER BY o.created_at DESC
            LIMIT 500
        """)
        rows = cursor.fetchall()
        return {
            "items": rows,
            "summary": {
                "total": len(rows),
                "issues": sum(1 for row in rows if row.get("reconciliation_status") != "ok")
            }
        }
    finally:
        cursor.close()
        db.close()
