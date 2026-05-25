from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
import uuid
from database import get_db
from security import get_current_user
from utils import get_bogota_time, log_event

router = APIRouter()

RIDE_STATUSES = {"requested", "offering", "accepted", "driver_arriving", "in_progress", "completed", "cancelled"}

class RideCreate(BaseModel):
    pickup_address: str
    pickup_lat: Optional[float] = None
    pickup_lng: Optional[float] = None
    dropoff_address: str
    dropoff_lat: Optional[float] = None
    dropoff_lng: Optional[float] = None
    passengers: int = 1
    requested_price: Optional[float] = None
    payment_method: str = "cash"
    notes: Optional[str] = None

class RideOfferCreate(BaseModel):
    amount: float
    eta_minutes: Optional[int] = None
    message: Optional[str] = None

class RideStatusUpdate(BaseModel):
    status: str
    cancellation_reason: Optional[str] = None


def ensure_rides_schema(db):
    cursor = db.cursor()
    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS ride_requests (
                id VARCHAR(50) PRIMARY KEY,
                user_id INT NOT NULL,
                pickup_address VARCHAR(255) NOT NULL,
                pickup_lat DECIMAL(10,8) NULL,
                pickup_lng DECIMAL(11,8) NULL,
                dropoff_address VARCHAR(255) NOT NULL,
                dropoff_lat DECIMAL(10,8) NULL,
                dropoff_lng DECIMAL(11,8) NULL,
                passengers INT NOT NULL DEFAULT 1,
                requested_price DECIMAL(12,2) NULL,
                accepted_price DECIMAL(12,2) NULL,
                driver_id INT NULL,
                driver_user_id INT NULL,
                status ENUM('requested','offering','accepted','driver_arriving','in_progress','completed','cancelled') NOT NULL DEFAULT 'requested',
                payment_method VARCHAR(40) NOT NULL DEFAULT 'cash',
                notes TEXT NULL,
                cancellation_reason TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_ride_user (user_id),
                INDEX idx_ride_driver (driver_id),
                INDEX idx_ride_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS ride_offers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                ride_id VARCHAR(50) NOT NULL,
                driver_id INT NOT NULL,
                driver_user_id INT NOT NULL,
                amount DECIMAL(12,2) NOT NULL,
                eta_minutes INT NULL,
                message TEXT NULL,
                status ENUM('pending','accepted','rejected','expired') NOT NULL DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_ride_driver_offer (ride_id, driver_id),
                INDEX idx_ride_offers_ride (ride_id),
                INDEX idx_ride_offers_driver (driver_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS ride_status_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                ride_id VARCHAR(50) NOT NULL,
                status VARCHAR(40) NOT NULL,
                changed_by_role VARCHAR(30) NULL,
                changed_by_user_id INT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_ride_status_logs_ride (ride_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
        """)
        db.commit()
    finally:
        cursor.close()


def get_driver_for_user(cursor, user_id: int):
    cursor.execute("SELECT id, user_id, name, vehicle, rating, status, lat, lng FROM couriers WHERE user_id = %s", (user_id,))
    return cursor.fetchone()


@router.post("", status_code=201)
def create_ride(data: RideCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in {"customer", "admin"}:
        raise HTTPException(status_code=403, detail="Solo clientes pueden solicitar viajes")
    if not data.pickup_address.strip() or not data.dropoff_address.strip():
        raise HTTPException(status_code=400, detail="Origen y destino son obligatorios")
    if data.passengers < 1 or data.passengers > 6:
        raise HTTPException(status_code=400, detail="Número de pasajeros inválido")

    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    ensure_rides_schema(db)
    cursor = db.cursor(dictionary=True)
    ride_id = f"RIDE-{uuid.uuid4().hex[:10].upper()}"
    try:
        cursor.execute("""
            INSERT INTO ride_requests (id, user_id, pickup_address, pickup_lat, pickup_lng, dropoff_address, dropoff_lat, dropoff_lng, passengers, requested_price, payment_method, notes)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (ride_id, current_user["id"], data.pickup_address, data.pickup_lat, data.pickup_lng, data.dropoff_address, data.dropoff_lat, data.dropoff_lng, data.passengers, data.requested_price, data.payment_method, data.notes))
        cursor.execute("INSERT INTO ride_status_logs (ride_id, status, changed_by_role, changed_by_user_id) VALUES (%s, 'requested', %s, %s)", (ride_id, current_user["role"], current_user["id"]))
        db.commit()
        log_event("ride_created", ride_id=ride_id, user_id=current_user["id"])
        return {"id": ride_id, "status": "requested"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()


@router.get("/available")
def available_rides(current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in {"courier", "admin"}:
        raise HTTPException(status_code=403, detail="Solo conductores pueden ver viajes disponibles")
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    ensure_rides_schema(db)
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT r.*, u.username AS customer_name
            FROM ride_requests r
            LEFT JOIN users u ON u.id = r.user_id
            WHERE r.status IN ('requested', 'offering')
            ORDER BY r.created_at DESC
            LIMIT 100
        """)
        return cursor.fetchall()
    finally:
        cursor.close()
        db.close()


@router.get("/me")
def my_rides(current_user: dict = Depends(get_current_user)):
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    ensure_rides_schema(db)
    cursor = db.cursor(dictionary=True)
    try:
        if current_user["role"] == "courier":
            driver = get_driver_for_user(cursor, current_user["id"])
            if not driver:
                return []
            cursor.execute("SELECT * FROM ride_requests WHERE driver_id = %s ORDER BY created_at DESC LIMIT 100", (driver["id"],))
        elif current_user["role"] == "admin":
            cursor.execute("SELECT * FROM ride_requests ORDER BY created_at DESC LIMIT 200")
        else:
            cursor.execute("SELECT * FROM ride_requests WHERE user_id = %s ORDER BY created_at DESC LIMIT 100", (current_user["id"],))
        return cursor.fetchall()
    finally:
        cursor.close()
        db.close()


@router.get("/{ride_id}")
def get_ride(ride_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    ensure_rides_schema(db)
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT r.*, u.username AS customer_name FROM ride_requests r LEFT JOIN users u ON u.id = r.user_id WHERE r.id = %s", (ride_id,))
        ride = cursor.fetchone()
        if not ride:
            raise HTTPException(status_code=404, detail="Viaje no encontrado")
        cursor.execute("""
            SELECT ro.*, c.name AS driver_name, c.vehicle, c.rating, c.phone
            FROM ride_offers ro
            LEFT JOIN couriers c ON c.id = ro.driver_id
            WHERE ro.ride_id = %s
            ORDER BY CASE ro.status WHEN 'accepted' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END, ro.amount ASC
        """, (ride_id,))
        ride["offers"] = cursor.fetchall()
        cursor.execute("SELECT * FROM ride_status_logs WHERE ride_id = %s ORDER BY created_at ASC", (ride_id,))
        ride["logs"] = cursor.fetchall()
        return ride
    finally:
        cursor.close()
        db.close()


@router.post("/{ride_id}/offers", status_code=201)
def create_offer(ride_id: str, data: RideOfferCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in {"courier", "admin"}:
        raise HTTPException(status_code=403, detail="Solo conductores pueden ofertar")
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="La oferta debe ser mayor a cero")
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    ensure_rides_schema(db)
    cursor = db.cursor(dictionary=True)
    try:
        driver = get_driver_for_user(cursor, current_user["id"])
        if not driver:
            raise HTTPException(status_code=404, detail="No tienes perfil de conductor/domiciliario")
        cursor.execute("SELECT id, status FROM ride_requests WHERE id = %s", (ride_id,))
        ride = cursor.fetchone()
        if not ride:
            raise HTTPException(status_code=404, detail="Viaje no encontrado")
        if ride["status"] not in {"requested", "offering"}:
            raise HTTPException(status_code=400, detail="Este viaje ya no acepta ofertas")
        cursor.execute("""
            INSERT INTO ride_offers (ride_id, driver_id, driver_user_id, amount, eta_minutes, message)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE amount = VALUES(amount), eta_minutes = VALUES(eta_minutes), message = VALUES(message), status = 'pending'
        """, (ride_id, driver["id"], current_user["id"], data.amount, data.eta_minutes, data.message))
        cursor.execute("UPDATE ride_requests SET status = 'offering' WHERE id = %s AND status = 'requested'", (ride_id,))
        cursor.execute("INSERT INTO ride_status_logs (ride_id, status, changed_by_role, changed_by_user_id) VALUES (%s, 'offering', %s, %s)", (ride_id, current_user["role"], current_user["id"]))
        db.commit()
        return {"message": "Oferta enviada"}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()


@router.post("/{ride_id}/offers/{offer_id}/accept")
def accept_offer(ride_id: str, offer_id: int, current_user: dict = Depends(get_current_user)):
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    ensure_rides_schema(db)
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT r.user_id, r.status, ro.driver_id, ro.driver_user_id, ro.amount
            FROM ride_requests r
            JOIN ride_offers ro ON ro.ride_id = r.id
            WHERE r.id = %s AND ro.id = %s
        """, (ride_id, offer_id))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Oferta no encontrada")
        if current_user["role"] != "admin" and row["user_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="No puedes aceptar ofertas de otro viaje")
        if row["status"] not in {"requested", "offering"}:
            raise HTTPException(status_code=400, detail="Este viaje ya no acepta ofertas")
        cursor.execute("""
            UPDATE ride_requests
            SET status = 'accepted', driver_id = %s, driver_user_id = %s, accepted_price = %s
            WHERE id = %s AND driver_id IS NULL
        """, (row["driver_id"], row["driver_user_id"], row["amount"], ride_id))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=409, detail="El viaje ya fue asignado")
        cursor.execute("UPDATE ride_offers SET status = 'accepted' WHERE id = %s", (offer_id,))
        cursor.execute("UPDATE ride_offers SET status = 'rejected' WHERE ride_id = %s AND id != %s AND status = 'pending'", (ride_id, offer_id))
        cursor.execute("INSERT INTO ride_status_logs (ride_id, status, changed_by_role, changed_by_user_id) VALUES (%s, 'accepted', %s, %s)", (ride_id, current_user["role"], current_user["id"]))
        db.commit()
        return {"message": "Oferta aceptada"}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()


@router.patch("/{ride_id}/status")
def update_ride_status(ride_id: str, data: RideStatusUpdate, current_user: dict = Depends(get_current_user)):
    if data.status not in RIDE_STATUSES:
        raise HTTPException(status_code=400, detail="Estado de viaje inválido")
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    ensure_rides_schema(db)
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT user_id, driver_user_id, status FROM ride_requests WHERE id = %s", (ride_id,))
        ride = cursor.fetchone()
        if not ride:
            raise HTTPException(status_code=404, detail="Viaje no encontrado")
        allowed = current_user["role"] == "admin" or current_user["id"] in {ride.get("user_id"), ride.get("driver_user_id")}
        if not allowed:
            raise HTTPException(status_code=403, detail="No puedes actualizar este viaje")
        cursor.execute("UPDATE ride_requests SET status = %s, cancellation_reason = COALESCE(%s, cancellation_reason) WHERE id = %s", (data.status, data.cancellation_reason, ride_id))
        cursor.execute("INSERT INTO ride_status_logs (ride_id, status, changed_by_role, changed_by_user_id) VALUES (%s, %s, %s, %s)", (ride_id, data.status, current_user["role"], current_user["id"]))
        db.commit()
        return {"message": "Estado de viaje actualizado"}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()
