from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import uuid
from database import get_db
from security import get_current_user, get_optional_user
from utils import get_bogota_time, log_event
from .push import send_push_notification

router = APIRouter()

RIDE_STATUSES = {"published", "full", "driver_arriving", "in_progress", "completed", "cancelled"}
FINAL_RIDE_STATUSES = {"completed", "cancelled"}
RIDE_STATUS_TRANSITIONS = {
    "published": {"driver_arriving", "cancelled", "full"},
    "full": {"driver_arriving", "cancelled"},
    "driver_arriving": {"in_progress", "cancelled"},
    "in_progress": {"completed", "cancelled"},
    "completed": set(),
    "cancelled": set(),
}
BOOKING_STATUSES = {"confirmed", "cancelled", "completed"}
CAR_VEHICLE_KEYWORDS = ("carro", "auto", "car", "camioneta", "taxi", "vehículo", "vehiculo")


class RidePublish(BaseModel):
    pickup_address: str
    pickup_lat: Optional[float] = None
    pickup_lng: Optional[float] = None
    dropoff_address: str
    dropoff_lat: Optional[float] = None
    dropoff_lng: Optional[float] = None
    departure_at: Optional[str] = None
    seats_total: int = Field(ge=1, le=6)
    price_per_seat: float = Field(gt=0)
    payment_method: str = "cash"
    notes: Optional[str] = None


class RideBook(BaseModel):
    seats: int = Field(default=1, ge=1, le=6)
    payment_method: str = "cash"
    passenger_note: Optional[str] = None


class RideStatusUpdate(BaseModel):
    status: str
    cancellation_reason: Optional[str] = None


class RideRatingCreate(BaseModel):
    driver_rating: int = Field(ge=1, le=5)
    comment: Optional[str] = None


def normalize_ride_payment_method(method: str | None) -> str:
    normalized = (method or "cash").strip().lower()
    if normalized in {"transfer", "transferencia"}:
        return "transfer"
    return "cash"


def get_vehicle_type(vehicle: str | None) -> str:
    if not vehicle:
        return "other"
    value = vehicle.lower()
    if any(keyword in value for keyword in CAR_VEHICLE_KEYWORDS):
        return "car"
    if any(keyword in value for keyword in ("moto", "motorcycle", "scooter")):
        return "moto"
    if "bici" in value:
        return "bicycle"
    return "other"


def is_ride_eligible_driver(courier: dict | None) -> bool:
    if not courier:
        return False
    return get_vehicle_type(courier.get("vehicle")) == "car"


def validate_ride_status_transition(current_status: str | None, new_status: str | None):
    if not new_status or current_status == new_status:
        return
    if new_status not in RIDE_STATUSES:
        raise HTTPException(status_code=400, detail="Estado de viaje inválido")
    if current_status not in RIDE_STATUSES:
        raise HTTPException(status_code=400, detail=f"El estado actual '{current_status}' no es válido")
    if current_status in FINAL_RIDE_STATUSES:
        raise HTTPException(status_code=400, detail=f"No se puede cambiar un viaje en estado '{current_status}'")
    if new_status not in RIDE_STATUS_TRANSITIONS.get(current_status, set()):
        raise HTTPException(
            status_code=400,
            detail=f"Transición inválida: no puedes cambiar un viaje de '{current_status}' a '{new_status}'",
        )


def ensure_rides_schema(db):
    cursor = db.cursor()
    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS ride_requests (
                id VARCHAR(50) PRIMARY KEY,
                driver_id INT NULL,
                driver_user_id INT NULL,
                pickup_address VARCHAR(255) NOT NULL,
                pickup_lat DECIMAL(10,8) NULL,
                pickup_lng DECIMAL(11,8) NULL,
                dropoff_address VARCHAR(255) NOT NULL,
                dropoff_lat DECIMAL(10,8) NULL,
                dropoff_lng DECIMAL(11,8) NULL,
                departure_at DATETIME NULL,
                seats_total INT NOT NULL DEFAULT 4,
                seats_available INT NOT NULL DEFAULT 4,
                price_per_seat DECIMAL(12,2) NOT NULL DEFAULT 0,
                status VARCHAR(40) NOT NULL DEFAULT 'published',
                payment_method VARCHAR(40) NOT NULL DEFAULT 'cash',
                notes TEXT NULL,
                cancellation_reason TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_ride_driver (driver_id),
                INDEX idx_ride_status (status),
                INDEX idx_ride_departure (departure_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS ride_bookings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                ride_id VARCHAR(50) NOT NULL,
                user_id INT NOT NULL,
                seats INT NOT NULL DEFAULT 1,
                payment_method VARCHAR(40) NOT NULL DEFAULT 'cash',
                passenger_note TEXT NULL,
                status ENUM('confirmed','cancelled','completed') NOT NULL DEFAULT 'confirmed',
                is_rated BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_user_ride_booking (ride_id, user_id),
                INDEX idx_ride_bookings_ride (ride_id),
                INDEX idx_ride_bookings_user (user_id)
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
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS ride_ratings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                ride_id VARCHAR(50) NOT NULL,
                booking_id INT NOT NULL,
                user_id INT NOT NULL,
                driver_id INT NULL,
                driver_rating INT NOT NULL,
                comment TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_booking_rating (booking_id),
                INDEX idx_ride_ratings_driver (driver_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
        """)
        for column_name, column_def in [
            ("departure_at", "DATETIME NULL"),
            ("seats_total", "INT NOT NULL DEFAULT 4"),
            ("seats_available", "INT NOT NULL DEFAULT 4"),
            ("price_per_seat", "DECIMAL(12,2) NULL"),
            ("driver_user_id", "INT NULL"),
        ]:
            try:
                cursor.execute(f"ALTER TABLE ride_requests ADD COLUMN {column_name} {column_def}")
            except Exception as exc:
                if "Duplicate column name" not in str(exc) and "1060" not in str(exc):
                    raise
        db.commit()
    finally:
        cursor.close()


def get_driver_for_user(cursor, user_id: int):
    cursor.execute(
        "SELECT id, user_id, name, vehicle, rating, status, lat, lng, phone FROM couriers WHERE user_id = %s",
        (user_id,),
    )
    return cursor.fetchone()


def _serialize_ride(row: dict) -> dict:
    if not row:
        return row
    for key in ("price_per_seat", "pickup_lat", "pickup_lng", "dropoff_lat", "dropoff_lng"):
        if row.get(key) is not None:
            row[key] = float(row[key])
    if row.get("departure_at") and hasattr(row["departure_at"], "isoformat"):
        row["departure_at"] = row["departure_at"].isoformat()
    return row


def _attach_driver_info(cursor, ride: dict) -> dict:
    if not ride.get("driver_id"):
        return ride
    cursor.execute(
        "SELECT lat, lng, name, vehicle, phone, rating FROM couriers WHERE id = %s",
        (ride["driver_id"],),
    )
    driver = cursor.fetchone()
    if driver:
        ride["driver_lat"] = float(driver["lat"]) if driver.get("lat") is not None else None
        ride["driver_lng"] = float(driver["lng"]) if driver.get("lng") is not None else None
        ride["driver_name"] = driver.get("name")
        ride["driver_vehicle"] = driver.get("vehicle")
        ride["driver_phone"] = driver.get("phone")
        ride["driver_rating"] = float(driver["rating"]) if driver.get("rating") is not None else None
    return ride


def _attach_bookings(cursor, ride: dict) -> dict:
    cursor.execute("""
        SELECT b.*, u.username AS passenger_name
        FROM ride_bookings b
        LEFT JOIN users u ON u.id = b.user_id
        WHERE b.ride_id = %s AND b.status != 'cancelled'
        ORDER BY b.created_at ASC
    """, (ride["id"],))
    ride["bookings"] = cursor.fetchall()
    ride["seats_booked"] = sum(int(b.get("seats") or 0) for b in ride["bookings"])
    return ride


def _user_has_booking(cursor, ride_id: str, user_id: int) -> bool:
    cursor.execute(
        "SELECT id FROM ride_bookings WHERE ride_id = %s AND user_id = %s AND status = 'confirmed'",
        (ride_id, user_id),
    )
    return cursor.fetchone() is not None


def assert_ride_access(ride: dict, user: dict, cursor):
    if user["role"] == "admin":
        return
    if user["id"] == ride.get("driver_user_id"):
        return
    if _user_has_booking(cursor, ride["id"], user["id"]):
        return
    if ride.get("status") == "published" and user["role"] in {"customer", "admin"}:
        return
    raise HTTPException(status_code=403, detail="No tienes permiso para ver este viaje")


def _parse_departure_at(value: str | None):
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=400, detail="Fecha de salida inválida")


@router.post("", status_code=201)
def publish_ride(data: RidePublish, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in {"courier", "admin"}:
        raise HTTPException(status_code=403, detail="Solo conductores pueden publicar viajes")
    if not data.pickup_address.strip() or not data.dropoff_address.strip():
        raise HTTPException(status_code=400, detail="Origen y destino son obligatorios")

    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    ensure_rides_schema(db)
    cursor = db.cursor(dictionary=True)
    ride_id = f"RIDE-{uuid.uuid4().hex[:10].upper()}"
    try:
        driver = get_driver_for_user(cursor, current_user["id"])
        if not driver:
            raise HTTPException(status_code=404, detail="No tienes perfil de conductor")
        if not is_ride_eligible_driver(driver):
            raise HTTPException(
                status_code=403,
                detail="Solo conductores con vehículo tipo carro pueden publicar viajes.",
            )

        payment_method = normalize_ride_payment_method(data.payment_method)
        departure_at = _parse_departure_at(data.departure_at)

        cursor.execute("""
            INSERT INTO ride_requests (
                id, driver_id, driver_user_id,
                pickup_address, pickup_lat, pickup_lng,
                dropoff_address, dropoff_lat, dropoff_lng,
                departure_at, seats_total, seats_available,
                price_per_seat, payment_method, notes, status
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'published')
        """, (
            ride_id, driver["id"], current_user["id"],
            data.pickup_address.strip(), data.pickup_lat, data.pickup_lng,
            data.dropoff_address.strip(), data.dropoff_lat, data.dropoff_lng,
            departure_at, data.seats_total, data.seats_total,
            data.price_per_seat, payment_method, data.notes,
        ))
        cursor.execute(
            "INSERT INTO ride_status_logs (ride_id, status, changed_by_role, changed_by_user_id) VALUES (%s, 'published', %s, %s)",
            (ride_id, current_user["role"], current_user["id"]),
        )
        db.commit()
        log_event("ride_published", ride_id=ride_id, driver_id=driver["id"])
        return {"id": ride_id, "status": "published"}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()


@router.get("")
def list_published_rides(
    q: Optional[str] = None,
    current_user: dict | None = Depends(get_optional_user),
):
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    ensure_rides_schema(db)
    cursor = db.cursor(dictionary=True)
    try:
        query = """
            SELECT r.*, c.name AS driver_name, c.vehicle AS driver_vehicle, c.rating AS driver_rating, c.phone AS driver_phone
            FROM ride_requests r
            LEFT JOIN couriers c ON c.id = r.driver_id
            WHERE r.status IN ('published', 'full') AND r.seats_available > 0
        """
        params = []
        if q:
            query += " AND (r.pickup_address LIKE %s OR r.dropoff_address LIKE %s)"
            like = f"%{q.strip()}%"
            params.extend([like, like])
        query += " ORDER BY COALESCE(r.departure_at, r.created_at) ASC LIMIT 100"
        cursor.execute(query, params)
        rides = [_serialize_ride(row) for row in cursor.fetchall()]
        if current_user and current_user["role"] in {"customer", "admin"}:
            cursor.execute(
                "SELECT ride_id FROM ride_bookings WHERE user_id = %s AND status = 'confirmed'",
                (current_user["id"],),
            )
            booked_ids = {row["ride_id"] for row in cursor.fetchall()}
            for ride in rides:
                ride["user_has_booking"] = ride["id"] in booked_ids
        return rides
    finally:
        cursor.close()
        db.close()


@router.get("/driver-eligibility")
def driver_eligibility(current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in {"courier", "admin"}:
        raise HTTPException(status_code=403, detail="Solo conductores pueden consultar elegibilidad")
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    cursor = db.cursor(dictionary=True)
    try:
        driver = get_driver_for_user(cursor, current_user["id"])
        if not driver:
            return {"eligible": False, "vehicle_type": None, "message": "No tienes perfil de conductor"}
        vehicle_type = get_vehicle_type(driver.get("vehicle"))
        eligible = is_ride_eligible_driver(driver)
        return {
            "eligible": eligible,
            "vehicle_type": vehicle_type,
            "vehicle": driver.get("vehicle"),
            "message": "Puedes publicar viajes en carro" if eligible else "Solo conductores con vehículo tipo carro pueden publicar viajes",
        }
    finally:
        cursor.close()
        db.close()


@router.get("/my-bookings")
def my_bookings(current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in {"customer", "admin"}:
        raise HTTPException(status_code=403, detail="Solo pasajeros pueden ver reservas")
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    ensure_rides_schema(db)
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT b.*, r.pickup_address, r.dropoff_address, r.departure_at, r.status AS ride_status,
                   r.price_per_seat, r.driver_id, c.name AS driver_name, c.vehicle AS driver_vehicle
            FROM ride_bookings b
            JOIN ride_requests r ON r.id = b.ride_id
            LEFT JOIN couriers c ON c.id = r.driver_id
            WHERE b.user_id = %s AND b.status != 'cancelled'
            ORDER BY b.created_at DESC
            LIMIT 100
        """, (current_user["id"],))
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
            cursor.execute(
                "SELECT * FROM ride_requests WHERE driver_id = %s ORDER BY created_at DESC LIMIT 100",
                (driver["id"],),
            )
            rides = cursor.fetchall()
            for ride in rides:
                _attach_bookings(cursor, ride)
            return [_serialize_ride(r) for r in rides]
        if current_user["role"] == "admin":
            cursor.execute("SELECT * FROM ride_requests ORDER BY created_at DESC LIMIT 200")
            return [_serialize_ride(r) for r in cursor.fetchall()]
        raise HTTPException(status_code=403, detail="Usa /rides/my-bookings para ver tus reservas")
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
        cursor.execute("SELECT * FROM ride_requests WHERE id = %s", (ride_id,))
        ride = cursor.fetchone()
        if not ride:
            raise HTTPException(status_code=404, detail="Viaje no encontrado")
        assert_ride_access(ride, current_user, cursor)
        ride = _attach_driver_info(cursor, ride)
        ride = _attach_bookings(cursor, ride)
        if current_user["role"] in {"customer", "admin"}:
            cursor.execute(
                "SELECT * FROM ride_bookings WHERE ride_id = %s AND user_id = %s AND status != 'cancelled'",
                (ride_id, current_user["id"]),
            )
            ride["my_booking"] = cursor.fetchone()
        cursor.execute("SELECT * FROM ride_status_logs WHERE ride_id = %s ORDER BY created_at ASC", (ride_id,))
        ride["logs"] = cursor.fetchall()
        return _serialize_ride(ride)
    finally:
        cursor.close()
        db.close()


@router.post("/{ride_id}/book", status_code=201)
def book_ride(
    ride_id: str,
    data: RideBook,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
):
    if current_user["role"] not in {"customer", "admin"}:
        raise HTTPException(status_code=403, detail="Solo pasajeros pueden reservar cupos")
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    ensure_rides_schema(db)
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("START TRANSACTION")
        cursor.execute("SELECT * FROM ride_requests WHERE id = %s FOR UPDATE", (ride_id,))
        ride = cursor.fetchone()
        if not ride:
            raise HTTPException(status_code=404, detail="Viaje no encontrado")
        if ride["status"] not in {"published", "full"}:
            raise HTTPException(status_code=400, detail="Este viaje ya no acepta reservas")
        if ride.get("driver_user_id") == current_user["id"]:
            raise HTTPException(status_code=400, detail="No puedes reservar tu propio viaje")
        if int(ride.get("seats_available") or 0) < data.seats:
            raise HTTPException(status_code=400, detail="No hay suficientes cupos disponibles")

        cursor.execute(
            "SELECT id, status FROM ride_bookings WHERE ride_id = %s AND user_id = %s",
            (ride_id, current_user["id"]),
        )
        existing = cursor.fetchone()
        if existing and existing["status"] == "confirmed":
            raise HTTPException(status_code=400, detail="Ya tienes una reserva en este viaje")

        payment_method = normalize_ride_payment_method(data.payment_method)
        if existing:
            cursor.execute("""
                UPDATE ride_bookings
                SET seats = %s, payment_method = %s, passenger_note = %s, status = 'confirmed', updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
            """, (data.seats, payment_method, data.passenger_note, existing["id"]))
            booking_id = existing["id"]
        else:
            cursor.execute("""
                INSERT INTO ride_bookings (ride_id, user_id, seats, payment_method, passenger_note)
                VALUES (%s, %s, %s, %s, %s)
            """, (ride_id, current_user["id"], data.seats, payment_method, data.passenger_note))
            booking_id = cursor.lastrowid

        new_available = int(ride["seats_available"]) - data.seats
        new_status = "full" if new_available <= 0 else ride["status"]
        cursor.execute(
            "UPDATE ride_requests SET seats_available = %s, status = %s WHERE id = %s",
            (new_available, new_status, ride_id),
        )
        db.commit()

        if ride.get("driver_user_id"):
            background_tasks.add_task(send_push_notification, ride["driver_user_id"], {
                "title": "Nueva reserva",
                "body": f"Un pasajero reservó {data.seats} cupo(s) en tu viaje {ride['pickup_address']} → {ride['dropoff_address']}.",
                "url": f"/viajes/{ride_id}",
            })

        total = float(ride["price_per_seat"]) * data.seats
        return {"message": "Reserva confirmada", "booking_id": booking_id, "total": total}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()


@router.post("/{ride_id}/book/cancel")
def cancel_booking(ride_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    ensure_rides_schema(db)
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("START TRANSACTION")
        cursor.execute("SELECT * FROM ride_requests WHERE id = %s FOR UPDATE", (ride_id,))
        ride = cursor.fetchone()
        if not ride:
            raise HTTPException(status_code=404, detail="Viaje no encontrado")
        cursor.execute(
            "SELECT * FROM ride_bookings WHERE ride_id = %s AND user_id = %s AND status = 'confirmed'",
            (ride_id, current_user["id"]),
        )
        booking = cursor.fetchone()
        if not booking:
            raise HTTPException(status_code=404, detail="No tienes reserva activa en este viaje")
        if ride["status"] not in {"published", "full"}:
            raise HTTPException(status_code=400, detail="Ya no puedes cancelar esta reserva")

        cursor.execute("UPDATE ride_bookings SET status = 'cancelled' WHERE id = %s", (booking["id"],))
        new_available = int(ride.get("seats_available") or 0) + int(booking.get("seats") or 1)
        new_status = "published" if ride["status"] == "full" and new_available > 0 else ride["status"]
        if new_status == "full" and new_available > 0:
            new_status = "published"
        cursor.execute(
            "UPDATE ride_requests SET seats_available = %s, status = %s WHERE id = %s",
            (min(new_available, int(ride.get("seats_total") or new_available)), new_status, ride_id),
        )
        db.commit()
        return {"message": "Reserva cancelada"}
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
def update_ride_status(
    ride_id: str,
    data: RideStatusUpdate,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
):
    if data.status not in RIDE_STATUSES:
        raise HTTPException(status_code=400, detail="Estado de viaje inválido")
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    ensure_rides_schema(db)
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM ride_requests WHERE id = %s", (ride_id,))
        ride = cursor.fetchone()
        if not ride:
            raise HTTPException(status_code=404, detail="Viaje no encontrado")
        if current_user["role"] != "admin" and current_user["id"] != ride.get("driver_user_id"):
            raise HTTPException(status_code=403, detail="Solo el conductor puede actualizar este viaje")
        validate_ride_status_transition(ride.get("status"), data.status)
        cursor.execute(
            "UPDATE ride_requests SET status = %s, cancellation_reason = COALESCE(%s, cancellation_reason) WHERE id = %s",
            (data.status, data.cancellation_reason, ride_id),
        )
        cursor.execute(
            "INSERT INTO ride_status_logs (ride_id, status, changed_by_role, changed_by_user_id) VALUES (%s, %s, %s, %s)",
            (ride_id, data.status, current_user["role"], current_user["id"]),
        )
        if data.status == "completed":
            cursor.execute(
                "UPDATE ride_bookings SET status = 'completed' WHERE ride_id = %s AND status = 'confirmed'",
                (ride_id,),
            )
        if data.status == "cancelled":
            cursor.execute(
                "UPDATE ride_bookings SET status = 'cancelled' WHERE ride_id = %s AND status = 'confirmed'",
                (ride_id,),
            )
        db.commit()

        cursor.execute(
            "SELECT user_id FROM ride_bookings WHERE ride_id = %s AND status IN ('confirmed', 'completed')",
            (ride_id,),
        )
        status_messages = {
            "driver_arriving": ("Conductor en camino", "Tu conductor va hacia el punto de recogida."),
            "in_progress": ("Viaje iniciado", "El viaje ha comenzado."),
            "completed": ("Viaje completado", "El viaje finalizó. ¡Califica tu experiencia!"),
            "cancelled": ("Viaje cancelado", data.cancellation_reason or "El conductor canceló el viaje."),
        }
        if data.status in status_messages:
            title, body = status_messages[data.status]
            for row in cursor.fetchall():
                background_tasks.add_task(send_push_notification, row["user_id"], {
                    "title": title, "body": body, "url": f"/viajes/{ride_id}",
                })

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


@router.post("/{ride_id}/rate")
def rate_ride(ride_id: str, rating: RideRatingCreate, current_user: dict = Depends(get_current_user)):
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    ensure_rides_schema(db)
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT status, driver_id FROM ride_requests WHERE id = %s", (ride_id,))
        ride = cursor.fetchone()
        if not ride:
            raise HTTPException(status_code=404, detail="Viaje no encontrado")
        if ride["status"] != "completed":
            raise HTTPException(status_code=400, detail="Solo puedes calificar viajes completados")
        cursor.execute(
            "SELECT * FROM ride_bookings WHERE ride_id = %s AND user_id = %s AND status = 'completed'",
            (ride_id, current_user["id"]),
        )
        booking = cursor.fetchone()
        if not booking:
            raise HTTPException(status_code=403, detail="Solo pasajeros que completaron el viaje pueden calificar")
        if booking.get("is_rated"):
            raise HTTPException(status_code=400, detail="Ya calificaste este viaje")

        cursor.execute("""
            INSERT INTO ride_ratings (ride_id, booking_id, user_id, driver_id, driver_rating, comment)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (ride_id, booking["id"], current_user["id"], ride.get("driver_id"), rating.driver_rating, rating.comment))
        cursor.execute("UPDATE ride_bookings SET is_rated = TRUE WHERE id = %s", (booking["id"],))
        if ride.get("driver_id"):
            cursor.execute("""
                UPDATE couriers SET rating = (
                    SELECT AVG(driver_rating) FROM ride_ratings WHERE driver_id = %s
                ) WHERE id = %s
            """, (ride["driver_id"], ride["driver_id"]))
        db.commit()
        return {"message": "Calificación registrada"}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()
