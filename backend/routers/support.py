from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from database import get_db
from security import get_current_user
from utils import get_bogota_time, log_event

router = APIRouter()

class SupportTicketCreate(BaseModel):
    name: str
    phone: str
    order_id: Optional[str] = None
    message: str

class SupportTicketUpdate(BaseModel):
    status: Optional[str] = None
    admin_notes: Optional[str] = None


def ensure_support_schema(db):
    cursor = db.cursor()
    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS support_tickets (
                id INT AUTO_INCREMENT PRIMARY KEY,
                public_id VARCHAR(40) NOT NULL UNIQUE,
                name VARCHAR(120) NOT NULL,
                phone VARCHAR(40) NOT NULL,
                order_id VARCHAR(50) NULL,
                message TEXT NOT NULL,
                status ENUM('open', 'in_progress', 'resolved', 'closed') NOT NULL DEFAULT 'open',
                admin_notes TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_support_public_id (public_id),
                INDEX idx_support_status (status),
                INDEX idx_support_order_id (order_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
        """)
        db.commit()
    finally:
        cursor.close()


@router.post("", status_code=201)
def create_support_ticket(ticket: SupportTicketCreate):
    name = ticket.name.strip()
    phone = ticket.phone.strip()
    message = ticket.message.strip()
    order_id = ticket.order_id.strip() if ticket.order_id else None

    if not name or not phone or not message:
        raise HTTPException(status_code=400, detail="Nombre, teléfono y mensaje son obligatorios")
    if len(message) < 10:
        raise HTTPException(status_code=400, detail="Describe tu solicitud con al menos 10 caracteres")

    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")

    ensure_support_schema(db)
    cursor = db.cursor(dictionary=True)
    try:
        public_id = f"SUP-{int(get_bogota_time().timestamp())}"
        cursor.execute(
            """
            INSERT INTO support_tickets (public_id, name, phone, order_id, message)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (public_id, name, phone, order_id, message)
        )
        db.commit()
        log_event("support_ticket_created", public_id=public_id, order_id=order_id)
        return {"id": public_id, "status": "open", "message": "Solicitud de soporte registrada"}
    except Exception as e:
        db.rollback()
        log_event("support_ticket_create_failed", "error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()


@router.get("", response_model=List[dict])
def list_support_tickets(status_filter: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="No tienes permisos de administrador")

    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")

    ensure_support_schema(db)
    cursor = db.cursor(dictionary=True)
    try:
        params = []
        query = "SELECT * FROM support_tickets"
        if status_filter:
            query += " WHERE status = %s"
            params.append(status_filter)
        query += " ORDER BY created_at DESC LIMIT 200"
        cursor.execute(query, params)
        return cursor.fetchall()
    finally:
        cursor.close()
        db.close()


@router.patch("/{public_id}")
def update_support_ticket(public_id: str, data: SupportTicketUpdate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="No tienes permisos de administrador")
    if data.status and data.status not in {"open", "in_progress", "resolved", "closed"}:
        raise HTTPException(status_code=400, detail="Estado de soporte inválido")

    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")

    ensure_support_schema(db)
    cursor = db.cursor(dictionary=True)
    try:
        updates = []
        params = []
        if data.status:
            updates.append("status = %s")
            params.append(data.status)
        if data.admin_notes is not None:
            updates.append("admin_notes = %s")
            params.append(data.admin_notes)
        if not updates:
            raise HTTPException(status_code=400, detail="No hay cambios para aplicar")
        params.append(public_id)
        cursor.execute(f"UPDATE support_tickets SET {', '.join(updates)} WHERE public_id = %s", params)
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Ticket no encontrado")
        db.commit()
        log_event("support_ticket_updated", public_id=public_id, admin_id=current_user["id"], status=data.status)
        return {"message": "Ticket actualizado"}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        log_event("support_ticket_update_failed", "error", public_id=public_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()
