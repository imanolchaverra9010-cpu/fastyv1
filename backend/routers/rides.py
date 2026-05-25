from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import uuid
import random
import secrets
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


class RideStartPin(BaseModel):
    pin: str = Field(min_length=4, max_length=4)


class RideSosCreate(BaseModel):
    lat: Optional[float] = None
    lng: Optional[float] = None
    message: Optional[str] = None


class RideReportCreate(BaseModel):
    category: str
    description: str = Field(min_length=10, max_length=2000)
    target: str = "driver"


RIDE_REPORT_CATEGORIES = {
    "unsafe_driving", "wrong_vehicle", "harassment", "no_show",
    "overcharge", "route_issue", "other",
}

PENALTY_BLOCK_THRESHOLD = 50
PENALTY_WARNING_THRESHOLD = 30
PENALTY_LOOKBACK_DAYS = 90

PENALTY_POINTS = {
    "ride_cancelled_with_bookings": 15,
    "ride_cancelled_late": 25,
    "low_rating": 10,
    "report_unsafe_driving": 20,
    "report_harassment": 25,
    "report_wrong_vehicle": 15,
    "report_no_show": 20,
    "report_overcharge": 10,
    "report_route_issue": 5,
    "report_other": 5,
    "sos_on_ride": 15,
    "admin_manual": 0,
}


class RidePenaltyCreate(BaseModel):
    driver_id: int
    points: int = Field(ge=1, le=100)
    reason: str
    ride_id: Optional[str] = None
    notes: Optional[str] = None


class DriverRegisterCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: str
    phone: str = Field(min_length=7, max_length=20)
    password: str = Field(min_length=6, max_length=128)
    vehicle: str
    vehicle_plate: str = Field(min_length=5, max_length=20)
    vehicle_color: str = Field(min_length=2, max_length=40)
    vehicle_model: str = Field(min_length=2, max_length=80)
    id_number: Optional[str] = None
    license_number: Optional[str] = None
    notes: Optional[str] = None


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
            ("start_pin", "VARCHAR(4) NULL"),
        ]:
            try:
                cursor.execute(f"ALTER TABLE ride_requests ADD COLUMN {column_name} {column_def}")
            except Exception as exc:
                if "Duplicate column name" not in str(exc) and "1060" not in str(exc):
                    raise
        for column_name, column_def in [
            ("share_token", "VARCHAR(64) NULL"),
        ]:
            try:
                cursor.execute(f"ALTER TABLE ride_bookings ADD COLUMN {column_name} {column_def}")
            except Exception as exc:
                if "Duplicate column name" not in str(exc) and "1060" not in str(exc):
                    raise
        for column_name, column_def in [
            ("vehicle_plate", "VARCHAR(20) NULL"),
            ("vehicle_color", "VARCHAR(40) NULL"),
            ("vehicle_model", "VARCHAR(80) NULL"),
            ("ride_verified", "BOOLEAN NOT NULL DEFAULT FALSE"),
            ("ride_verified_at", "DATETIME NULL"),
        ]:
            try:
                cursor.execute(f"ALTER TABLE couriers ADD COLUMN {column_name} {column_def}")
            except Exception as exc:
                if "Duplicate column name" not in str(exc) and "1060" not in str(exc):
                    raise
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS ride_sos_events (
                id INT AUTO_INCREMENT PRIMARY KEY,
                ride_id VARCHAR(50) NOT NULL,
                user_id INT NOT NULL,
                lat DECIMAL(10,8) NULL,
                lng DECIMAL(11,8) NULL,
                message TEXT NULL,
                status ENUM('active','resolved') NOT NULL DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                resolved_at TIMESTAMP NULL,
                INDEX idx_ride_sos_ride (ride_id),
                INDEX idx_ride_sos_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS ride_reports (
                id INT AUTO_INCREMENT PRIMARY KEY,
                ride_id VARCHAR(50) NOT NULL,
                reporter_user_id INT NOT NULL,
                target VARCHAR(30) NOT NULL DEFAULT 'driver',
                category VARCHAR(40) NOT NULL,
                description TEXT NOT NULL,
                status ENUM('pending','reviewed','resolved') NOT NULL DEFAULT 'pending',
                admin_notes TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_ride_reports_ride (ride_id),
                INDEX idx_ride_reports_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS ride_penalties (
                id INT AUTO_INCREMENT PRIMARY KEY,
                driver_id INT NOT NULL,
                ride_id VARCHAR(50) NULL,
                reason VARCHAR(60) NOT NULL,
                points INT NOT NULL DEFAULT 0,
                source ENUM('auto','admin','report') NOT NULL DEFAULT 'auto',
                notes TEXT NULL,
                waived BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_ride_penalties_driver (driver_id),
                INDEX idx_ride_penalties_ride (ride_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS driver_requests (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(255) NOT NULL,
                phone VARCHAR(20) NOT NULL,
                password VARCHAR(255) NOT NULL,
                vehicle VARCHAR(50) NOT NULL,
                vehicle_plate VARCHAR(20) NOT NULL,
                vehicle_color VARCHAR(40) NOT NULL,
                vehicle_model VARCHAR(80) NOT NULL,
                id_number VARCHAR(30) NULL,
                license_number VARCHAR(40) NULL,
                notes TEXT NULL,
                status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_driver_requests_email (email),
                INDEX idx_driver_requests_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
        """)
        for column_name, column_def in [
            ("ride_penalty_points", "INT NOT NULL DEFAULT 0"),
            ("ride_publish_blocked", "BOOLEAN NOT NULL DEFAULT FALSE"),
        ]:
            try:
                cursor.execute(f"ALTER TABLE couriers ADD COLUMN {column_name} {column_def}")
            except Exception as exc:
                if "Duplicate column name" not in str(exc) and "1060" not in str(exc):
                    raise
        db.commit()
    finally:
        cursor.close()


def get_driver_for_user(cursor, user_id: int):
    cursor.execute(
        """SELECT id, user_id, name, vehicle, vehicle_plate, vehicle_color, vehicle_model,
                  ride_verified, ride_penalty_points, ride_publish_blocked,
                  rating, status, lat, lng, phone
           FROM couriers WHERE user_id = %s""",
        (user_id,),
    )
    return cursor.fetchone()


def get_driver_penalty_points(cursor, driver_id: int) -> int:
    cursor.execute("""
        SELECT COALESCE(SUM(points), 0) AS total
        FROM ride_penalties
        WHERE driver_id = %s AND waived = FALSE
          AND created_at >= DATE_SUB(NOW(), INTERVAL %s DAY)
    """, (driver_id, PENALTY_LOOKBACK_DAYS))
    row = cursor.fetchone()
    return int(row["total"] if row and row.get("total") is not None else 0)


def sync_driver_penalty_points(cursor, driver_id: int) -> int:
    total = get_driver_penalty_points(cursor, driver_id)
    cursor.execute("UPDATE couriers SET ride_penalty_points = %s WHERE id = %s", (total, driver_id))
    return total


def apply_driver_penalty(
    cursor,
    driver_id: int,
    reason: str,
    points: int,
    ride_id: str | None = None,
    source: str = "auto",
    notes: str | None = None,
) -> int:
    if points <= 0:
        return get_driver_penalty_points(cursor, driver_id)
    cursor.execute("""
        INSERT INTO ride_penalties (driver_id, ride_id, reason, points, source, notes)
        VALUES (%s, %s, %s, %s, %s, %s)
    """, (driver_id, ride_id, reason, points, source, notes))
    return sync_driver_penalty_points(cursor, driver_id)


def get_driver_ride_stats(cursor, driver_id: int) -> dict:
    cursor.execute("""
        SELECT COUNT(*) AS completed_rides
        FROM ride_requests
        WHERE driver_id = %s AND status = 'completed'
    """, (driver_id,))
    completed = int((cursor.fetchone() or {}).get("completed_rides") or 0)
    cursor.execute("""
        SELECT COUNT(DISTINCT b.user_id) AS total_passengers
        FROM ride_bookings b
        JOIN ride_requests r ON r.id = b.ride_id
        WHERE r.driver_id = %s AND b.status = 'completed'
    """, (driver_id,))
    passengers = int((cursor.fetchone() or {}).get("total_passengers") or 0)
    cursor.execute("""
        SELECT AVG(driver_rating) AS avg_rating, COUNT(*) AS rating_count
        FROM ride_ratings WHERE driver_id = %s
    """, (driver_id,))
    rating_row = cursor.fetchone() or {}
    avg_rating = float(rating_row["avg_rating"]) if rating_row.get("avg_rating") is not None else None
    penalty_points = get_driver_penalty_points(cursor, driver_id)
    score = compute_driver_rank_score(completed, avg_rating, penalty_points)
    return {
        "completed_rides": completed,
        "total_passengers": passengers,
        "avg_rating": round(avg_rating, 2) if avg_rating is not None else None,
        "rating_count": int(rating_row.get("rating_count") or 0),
        "penalty_points": penalty_points,
        "rank_score": score,
    }


def compute_driver_rank_score(completed_rides: int, avg_rating: float | None, penalty_points: int) -> float:
    rating_part = (avg_rating or 4.0) * 20
    trips_part = min(completed_rides, 200) * 2
    penalty_part = penalty_points * 3
    return round(max(0, rating_part + trips_part - penalty_part), 2)


def assert_driver_can_publish(driver: dict, cursor):
    if driver.get("ride_publish_blocked"):
        raise HTTPException(
            status_code=403,
            detail="Tu cuenta tiene publicación de viajes suspendida por acumulación de penalizaciones. Contacta al administrador.",
        )
    points = get_driver_penalty_points(cursor, driver["id"])
    if points >= PENALTY_BLOCK_THRESHOLD:
        raise HTTPException(
            status_code=403,
            detail=f"Tienes {points} puntos de penalización (máximo {PENALTY_BLOCK_THRESHOLD}). No puedes publicar viajes hasta que bajen o un admin revise tu cuenta.",
        )


def _generate_start_pin() -> str:
    return f"{random.randint(0, 9999):04d}"


def _generate_share_token() -> str:
    return secrets.token_urlsafe(24)


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
        """SELECT lat, lng, name, vehicle, vehicle_plate, vehicle_color, vehicle_model,
                  ride_verified, phone, rating FROM couriers WHERE id = %s""",
        (ride["driver_id"],),
    )
    driver = cursor.fetchone()
    if driver:
        ride["driver_lat"] = float(driver["lat"]) if driver.get("lat") is not None else None
        ride["driver_lng"] = float(driver["lng"]) if driver.get("lng") is not None else None
        ride["driver_name"] = driver.get("name")
        ride["driver_vehicle"] = driver.get("vehicle")
        ride["driver_vehicle_plate"] = driver.get("vehicle_plate")
        ride["driver_vehicle_color"] = driver.get("vehicle_color")
        ride["driver_vehicle_model"] = driver.get("vehicle_model")
        ride["driver_verified"] = bool(driver.get("ride_verified"))
        ride["driver_phone"] = driver.get("phone")
        ride["driver_rating"] = float(driver["rating"]) if driver.get("rating") is not None else None
    return ride


def _sanitize_ride_for_viewer(ride: dict, user: dict | None) -> dict:
    if not ride:
        return ride
    is_driver = user and user.get("id") == ride.get("driver_user_id")
    is_admin = user and user.get("role") == "admin"
    if not is_driver and not is_admin:
        ride.pop("start_pin", None)
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
        if current_user["role"] != "admin" and not driver.get("ride_verified"):
            raise HTTPException(
                status_code=403,
                detail="Tu cuenta de conductor aún no está verificada para publicar viajes. Contacta al administrador.",
            )
        if current_user["role"] != "admin" and (not driver.get("vehicle_plate") or not driver.get("vehicle_model")):
            raise HTTPException(
                status_code=400,
                detail="Completa los datos de tu vehículo (placa y modelo) antes de publicar viajes.",
            )
        if current_user["role"] != "admin":
            assert_driver_can_publish(driver, cursor)

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
            SELECT r.*, c.name AS driver_name, c.vehicle AS driver_vehicle,
                   c.vehicle_plate AS driver_vehicle_plate, c.vehicle_color AS driver_vehicle_color,
                   c.vehicle_model AS driver_vehicle_model, c.ride_verified AS driver_verified,
                   c.rating AS driver_rating, c.phone AS driver_phone
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
        penalty_points = get_driver_penalty_points(cursor, driver["id"])
        stats = get_driver_ride_stats(cursor, driver["id"])
        can_publish = (
            eligible
            and bool(driver.get("ride_verified"))
            and not driver.get("ride_publish_blocked")
            and penalty_points < PENALTY_BLOCK_THRESHOLD
        )
        return {
            "eligible": eligible,
            "can_publish": can_publish,
            "vehicle_type": vehicle_type,
            "vehicle": driver.get("vehicle"),
            "vehicle_plate": driver.get("vehicle_plate"),
            "vehicle_color": driver.get("vehicle_color"),
            "vehicle_model": driver.get("vehicle_model"),
            "ride_verified": bool(driver.get("ride_verified")),
            "penalty_points": penalty_points,
            "penalty_warning": penalty_points >= PENALTY_WARNING_THRESHOLD,
            "penalty_block_threshold": PENALTY_BLOCK_THRESHOLD,
            "ride_stats": stats,
            "message": "Puedes publicar viajes en carro" if can_publish else (
                f"Tienes {penalty_points} pts de penalización. Máximo permitido: {PENALTY_BLOCK_THRESHOLD}."
                if penalty_points >= PENALTY_BLOCK_THRESHOLD
                else "Tu cuenta debe ser verificada por un administrador para publicar viajes"
                if eligible and not driver.get("ride_verified")
                else "Solo conductores con vehículo tipo carro pueden publicar viajes"
            ),
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


@router.post("/driver-register", status_code=201)
def register_driver(data: DriverRegisterCreate):
    if not is_ride_eligible_driver({"vehicle": data.vehicle}):
        raise HTTPException(
            status_code=400,
            detail="Solo se aceptan conductores con vehículo tipo carro (auto, carro o camioneta).",
        )
    email = data.email.strip().lower()
    if "@" not in email:
        raise HTTPException(status_code=400, detail="Email inválido")

    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    ensure_rides_schema(db)
    cursor = db.cursor(dictionary=True)
    try:
        errors = {}
        cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
        if cursor.fetchone():
            errors["email"] = "Este email ya está registrado en la plataforma."
        cursor.execute(
            "SELECT id FROM driver_requests WHERE email = %s AND status = 'pending'",
            (email,),
        )
        if cursor.fetchone():
            errors["email"] = "Ya tienes una solicitud pendiente con este email."
        cursor.execute(
            "SELECT id FROM couriers c JOIN users u ON u.id = c.user_id WHERE u.email = %s",
            (email,),
        )
        if cursor.fetchone():
            errors["email"] = "Ya existe un conductor registrado con este email."

        if errors:
            raise HTTPException(status_code=400, detail={"message": "Revisa los datos.", "fields": errors})

        cursor.execute("""
            INSERT INTO driver_requests (
                name, email, phone, password, vehicle,
                vehicle_plate, vehicle_color, vehicle_model,
                id_number, license_number, notes
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            data.name.strip(), email, data.phone.strip(), data.password,
            data.vehicle.strip(), data.vehicle_plate.strip().upper(),
            data.vehicle_color.strip(), data.vehicle_model.strip(),
            data.id_number, data.license_number, data.notes,
        ))
        db.commit()
        log_event("driver_register_request", email=email)
        return {"message": "Solicitud enviada. Te contactaremos cuando sea aprobada."}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()


@router.get("/drivers/ranking")
def drivers_ranking(limit: int = 30):
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    ensure_rides_schema(db)
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT c.id, c.name, c.vehicle, c.vehicle_model, c.vehicle_plate,
                   c.rating, c.ride_verified,
                   (SELECT COUNT(*) FROM ride_requests r WHERE r.driver_id = c.id AND r.status = 'completed') AS completed_rides,
                   (SELECT COALESCE(SUM(p.points), 0) FROM ride_penalties p
                    WHERE p.driver_id = c.id AND p.waived = FALSE
                      AND p.created_at >= DATE_SUB(NOW(), INTERVAL %s DAY)) AS penalty_points
            FROM couriers c
            WHERE c.ride_verified = TRUE
            HAVING completed_rides > 0
            ORDER BY completed_rides DESC
            LIMIT 200
        """, (PENALTY_LOOKBACK_DAYS,))
        rows = cursor.fetchall()
        ranking = []
        for row in rows:
            avg_rating = float(row["rating"]) if row.get("rating") is not None else 4.0
            penalty_points = int(row.get("penalty_points") or 0)
            score = compute_driver_rank_score(int(row.get("completed_rides") or 0), avg_rating, penalty_points)
            ranking.append({
                "driver_id": row["id"],
                "name": row["name"],
                "vehicle": row.get("vehicle"),
                "vehicle_model": row.get("vehicle_model"),
                "verified": bool(row.get("ride_verified")),
                "avg_rating": round(avg_rating, 2),
                "completed_rides": int(row.get("completed_rides") or 0),
                "penalty_points": penalty_points,
                "rank_score": score,
            })
        ranking.sort(key=lambda x: (-x["rank_score"], -x["completed_rides"], -x["avg_rating"]))
        for idx, item in enumerate(ranking[: min(limit, 100)], start=1):
            item["rank"] = idx
        return ranking[: min(limit, 100)]
    finally:
        cursor.close()
        db.close()


@router.get("/drivers/me/stats")
def my_driver_stats(current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in {"courier", "admin"}:
        raise HTTPException(status_code=403, detail="Solo conductores pueden ver estas estadísticas")
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    ensure_rides_schema(db)
    cursor = db.cursor(dictionary=True)
    try:
        driver = get_driver_for_user(cursor, current_user["id"])
        if not driver:
            raise HTTPException(status_code=404, detail="No tienes perfil de conductor")
        stats = get_driver_ride_stats(cursor, driver["id"])
        cursor.execute("""
            SELECT id, ride_id, reason, points, source, notes, waived, created_at
            FROM ride_penalties WHERE driver_id = %s
            ORDER BY created_at DESC LIMIT 20
        """, (driver["id"],))
        penalties = cursor.fetchall()
        for p in penalties:
            if p.get("created_at") and hasattr(p["created_at"], "isoformat"):
                p["created_at"] = p["created_at"].isoformat()
        cursor.execute("""
            SELECT c.id,
                   (SELECT COUNT(*) FROM ride_requests r WHERE r.driver_id = c.id AND r.status = 'completed') AS completed_rides,
                   c.rating,
                   (SELECT COALESCE(SUM(p.points), 0) FROM ride_penalties p
                    WHERE p.driver_id = c.id AND p.waived = FALSE
                      AND p.created_at >= DATE_SUB(NOW(), INTERVAL %s DAY)) AS penalty_points
            FROM couriers c WHERE c.ride_verified = TRUE
            HAVING completed_rides > 0
        """, (PENALTY_LOOKBACK_DAYS,))
        all_drivers = cursor.fetchall()
        scored = []
        for row in all_drivers:
            avg_rating = float(row["rating"]) if row.get("rating") is not None else 4.0
            pp = int(row.get("penalty_points") or 0)
            scored.append((row["id"], compute_driver_rank_score(int(row.get("completed_rides") or 0), avg_rating, pp)))
        scored.sort(key=lambda x: -x[1])
        rank_position = next((i + 1 for i, (did, _) in enumerate(scored) if did == driver["id"]), None)
        return {
            **stats,
            "rank_position": rank_position,
            "total_ranked_drivers": len(scored),
            "penalty_warning": stats["penalty_points"] >= PENALTY_WARNING_THRESHOLD,
            "can_publish": (
                is_ride_eligible_driver(driver)
                and bool(driver.get("ride_verified"))
                and not driver.get("ride_publish_blocked")
                and stats["penalty_points"] < PENALTY_BLOCK_THRESHOLD
            ),
            "recent_penalties": penalties,
        }
    finally:
        cursor.close()
        db.close()


@router.get("/history")
def ride_history(current_user: dict = Depends(get_current_user)):
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    ensure_rides_schema(db)
    cursor = db.cursor(dictionary=True)
    try:
        if current_user["role"] == "courier":
            driver = get_driver_for_user(cursor, current_user["id"])
            if not driver:
                return {"as_driver": [], "as_passenger": []}
            cursor.execute("""
                SELECT r.*, c.name AS driver_name, c.vehicle AS driver_vehicle,
                       c.vehicle_plate AS driver_vehicle_plate
                FROM ride_requests r
                LEFT JOIN couriers c ON c.id = r.driver_id
                WHERE r.driver_id = %s
                ORDER BY COALESCE(r.departure_at, r.created_at) DESC
                LIMIT 200
            """, (driver["id"],))
            as_driver = [_serialize_ride(row) for row in cursor.fetchall()]
            return {"as_driver": as_driver, "as_passenger": []}

        cursor.execute("""
            SELECT b.*, r.pickup_address, r.dropoff_address, r.departure_at, r.status AS ride_status,
                   r.price_per_seat, r.driver_id, c.name AS driver_name, c.vehicle AS driver_vehicle,
                   c.vehicle_plate AS driver_vehicle_plate, c.vehicle_model AS driver_vehicle_model
            FROM ride_bookings b
            JOIN ride_requests r ON r.id = b.ride_id
            LEFT JOIN couriers c ON c.id = r.driver_id
            WHERE b.user_id = %s
            ORDER BY b.created_at DESC
            LIMIT 200
        """, (current_user["id"],))
        as_passenger = cursor.fetchall()
        return {"as_driver": [], "as_passenger": as_passenger}
    finally:
        cursor.close()
        db.close()


@router.get("/track/{share_token}")
def track_shared_ride(share_token: str):
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    ensure_rides_schema(db)
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute(
            "SELECT * FROM ride_bookings WHERE share_token = %s AND status != 'cancelled'",
            (share_token,),
        )
        booking = cursor.fetchone()
        if not booking:
            raise HTTPException(status_code=404, detail="Enlace de seguimiento no válido")
        cursor.execute("SELECT * FROM ride_requests WHERE id = %s", (booking["ride_id"],))
        ride = cursor.fetchone()
        if not ride:
            raise HTTPException(status_code=404, detail="Viaje no encontrado")
        ride = _attach_driver_info(cursor, ride)
        driver_first = (ride.get("driver_name") or "Conductor").split()[0]
        return {
            "ride_id": ride["id"],
            "status": ride["status"],
            "pickup_address": ride["pickup_address"],
            "dropoff_address": ride["dropoff_address"],
            "departure_at": ride.get("departure_at").isoformat() if hasattr(ride.get("departure_at"), "isoformat") else ride.get("departure_at"),
            "pickup_lat": float(ride["pickup_lat"]) if ride.get("pickup_lat") is not None else None,
            "pickup_lng": float(ride["pickup_lng"]) if ride.get("pickup_lng") is not None else None,
            "dropoff_lat": float(ride["dropoff_lat"]) if ride.get("dropoff_lat") is not None else None,
            "dropoff_lng": float(ride["dropoff_lng"]) if ride.get("dropoff_lng") is not None else None,
            "driver_lat": ride.get("driver_lat"),
            "driver_lng": ride.get("driver_lng"),
            "driver_first_name": driver_first,
            "driver_vehicle_model": ride.get("driver_vehicle_model"),
            "driver_vehicle_color": ride.get("driver_vehicle_color"),
            "driver_verified": ride.get("driver_verified", False),
            "seats": booking.get("seats"),
        }
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
            if ride["my_booking"] and ride.get("status") in {"driver_arriving", "in_progress"}:
                ride["passenger_pin"] = ride.get("start_pin")
        cursor.execute("SELECT * FROM ride_status_logs WHERE ride_id = %s ORDER BY created_at ASC", (ride_id,))
        ride["logs"] = cursor.fetchall()
        cursor.execute(
            "SELECT id, status, created_at FROM ride_sos_events WHERE ride_id = %s ORDER BY created_at DESC LIMIT 5",
            (ride_id,),
        )
        ride["sos_events"] = cursor.fetchall()
        return _sanitize_ride_for_viewer(_serialize_ride(ride), current_user)
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
            "SELECT id, status, share_token FROM ride_bookings WHERE ride_id = %s AND user_id = %s",
            (ride_id, current_user["id"]),
        )
        existing = cursor.fetchone()
        if existing and existing["status"] == "confirmed":
            raise HTTPException(status_code=400, detail="Ya tienes una reserva en este viaje")

        payment_method = normalize_ride_payment_method(data.payment_method)
        if existing:
            share_token = existing.get("share_token") or _generate_share_token()
            cursor.execute("""
                UPDATE ride_bookings
                SET seats = %s, payment_method = %s, passenger_note = %s, status = 'confirmed',
                    share_token = %s, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
            """, (data.seats, payment_method, data.passenger_note, share_token, existing["id"]))
            booking_id = existing["id"]
        else:
            share_token = _generate_share_token()
            cursor.execute("""
                INSERT INTO ride_bookings (ride_id, user_id, seats, payment_method, passenger_note, share_token)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (ride_id, current_user["id"], data.seats, payment_method, data.passenger_note, share_token))
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
        return {"message": "Reserva confirmada", "booking_id": booking_id, "total": total, "share_token": share_token}
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
        if data.status == "in_progress":
            raise HTTPException(
                status_code=400,
                detail="Para iniciar el viaje el pasajero debe darte el PIN de seguridad. Usa /rides/{id}/start-with-pin",
            )
        start_pin = ride.get("start_pin")
        if data.status == "driver_arriving" and not start_pin:
            start_pin = _generate_start_pin()
            cursor.execute(
                "UPDATE ride_requests SET status = %s, start_pin = %s, cancellation_reason = COALESCE(%s, cancellation_reason) WHERE id = %s",
                (data.status, start_pin, data.cancellation_reason, ride_id),
            )
        else:
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
                "SELECT COUNT(*) AS cnt FROM ride_bookings WHERE ride_id = %s AND status = 'confirmed'",
                (ride_id,),
            )
            confirmed_bookings = int((cursor.fetchone() or {}).get("cnt") or 0)
            cursor.execute(
                "UPDATE ride_bookings SET status = 'cancelled' WHERE ride_id = %s AND status = 'confirmed'",
                (ride_id,),
            )
            if ride.get("driver_id") and current_user["id"] == ride.get("driver_user_id") and confirmed_bookings > 0:
                prev_status = ride.get("status")
                if prev_status in {"driver_arriving", "in_progress", "full"}:
                    apply_driver_penalty(
                        cursor, ride["driver_id"], "ride_cancelled_late",
                        PENALTY_POINTS["ride_cancelled_late"], ride_id,
                        notes=data.cancellation_reason,
                    )
                else:
                    apply_driver_penalty(
                        cursor, ride["driver_id"], "ride_cancelled_with_bookings",
                        PENALTY_POINTS["ride_cancelled_with_bookings"], ride_id,
                        notes=data.cancellation_reason,
                    )
        db.commit()

        cursor.execute(
            "SELECT user_id FROM ride_bookings WHERE ride_id = %s AND status IN ('confirmed', 'completed')",
            (ride_id,),
        )
        status_messages = {
            "driver_arriving": ("Conductor en camino", "Tu conductor va hacia el punto de recogida. Revisa tu PIN de seguridad."),
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

        return {"message": "Estado de viaje actualizado", "start_pin": start_pin if data.status == "driver_arriving" else None}
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
        if ride.get("driver_id") and rating.driver_rating <= 2:
            cursor.execute(
                "SELECT id FROM ride_penalties WHERE driver_id = %s AND ride_id = %s AND reason = 'low_rating'",
                (ride["driver_id"], ride_id),
            )
            if not cursor.fetchone():
                apply_driver_penalty(
                    cursor, ride["driver_id"], "low_rating",
                    PENALTY_POINTS["low_rating"], ride_id,
                    notes=f"Calificación {rating.driver_rating}/5",
                )
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


@router.post("/{ride_id}/start-with-pin")
def start_ride_with_pin(
    ride_id: str,
    data: RideStartPin,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
):
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
            raise HTTPException(status_code=403, detail="Solo el conductor puede iniciar el viaje")
        if ride.get("status") != "driver_arriving":
            raise HTTPException(status_code=400, detail="El viaje debe estar en estado 'conductor en camino'")
        if not ride.get("start_pin") or data.pin.strip() != str(ride["start_pin"]):
            raise HTTPException(status_code=400, detail="PIN incorrecto. Pide al pasajero su código de seguridad.")
        validate_ride_status_transition(ride.get("status"), "in_progress")
        cursor.execute("UPDATE ride_requests SET status = 'in_progress' WHERE id = %s", (ride_id,))
        cursor.execute(
            "INSERT INTO ride_status_logs (ride_id, status, changed_by_role, changed_by_user_id) VALUES (%s, 'in_progress', %s, %s)",
            (ride_id, current_user["role"], current_user["id"]),
        )
        db.commit()
        cursor.execute(
            "SELECT user_id FROM ride_bookings WHERE ride_id = %s AND status = 'confirmed'",
            (ride_id,),
        )
        for row in cursor.fetchall():
            background_tasks.add_task(send_push_notification, row["user_id"], {
                "title": "Viaje iniciado",
                "body": "El viaje ha comenzado. ¡Buen camino!",
                "url": f"/viajes/{ride_id}",
            })
        return {"message": "Viaje iniciado correctamente"}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()


@router.post("/{ride_id}/sos")
def trigger_sos(
    ride_id: str,
    data: RideSosCreate,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
):
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
        if ride.get("status") not in {"driver_arriving", "in_progress"}:
            raise HTTPException(status_code=400, detail="SOS solo disponible durante un viaje activo")
        cursor.execute(
            "SELECT id FROM ride_sos_events WHERE ride_id = %s AND user_id = %s AND status = 'active'",
            (ride_id, current_user["id"]),
        )
        if cursor.fetchone():
            return {"message": "Alerta SOS ya activa. El equipo fue notificado."}
        cursor.execute("""
            INSERT INTO ride_sos_events (ride_id, user_id, lat, lng, message)
            VALUES (%s, %s, %s, %s, %s)
        """, (ride_id, current_user["id"], data.lat, data.lng, data.message))
        db.commit()
        log_event("ride_sos", ride_id=ride_id, user_id=current_user["id"])
        cursor.execute("SELECT id FROM users WHERE role = 'admin'")
        for admin in cursor.fetchall():
            background_tasks.add_task(send_push_notification, admin["id"], {
                "title": "🚨 Alerta SOS en viaje",
                "body": f"Viaje {ride_id}: {ride['pickup_address']} → {ride['dropoff_address']}",
                "url": f"/admin/viajes?ride={ride_id}",
            })
        if ride.get("driver_user_id") and current_user["id"] != ride["driver_user_id"]:
            background_tasks.add_task(send_push_notification, ride["driver_user_id"], {
                "title": "Alerta de seguridad",
                "body": "Un pasajero activó SOS en tu viaje.",
                "url": f"/viajes/{ride_id}",
            })
        return {"message": "Alerta SOS enviada. El equipo de Fasty fue notificado."}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()


@router.post("/{ride_id}/reports")
def create_ride_report(
    ride_id: str,
    data: RideReportCreate,
    current_user: dict = Depends(get_current_user),
):
    if data.category not in RIDE_REPORT_CATEGORIES:
        raise HTTPException(status_code=400, detail="Categoría de reporte inválida")
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
        cursor.execute("""
            INSERT INTO ride_reports (ride_id, reporter_user_id, target, category, description)
            VALUES (%s, %s, %s, %s, %s)
        """, (ride_id, current_user["id"], data.target, data.category, data.description.strip()))
        db.commit()
        return {"message": "Reporte enviado. Lo revisaremos pronto."}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()
