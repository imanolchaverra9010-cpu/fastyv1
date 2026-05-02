import bcrypt
# Workaround for passlib/bcrypt incompatibility in newer versions
if not hasattr(bcrypt, "__about__"):
    class BCryptAbout:
        __version__ = getattr(bcrypt, "__version__", "4.0.0")
    bcrypt.__about__ = BCryptAbout()

from passlib.context import CryptContext
from jose import jwt
from datetime import datetime, timedelta, timezone
from typing import Optional
from slowapi import Limiter
from slowapi.util import get_remote_address
import math

# Zona horaria de Bogotá (UTC-5)
BOGOTA_TZ = timezone(timedelta(hours=-5))

def get_bogota_time() -> datetime:
    """Retorna la fecha y hora actual en Bogotá."""
    return datetime.now(BOGOTA_TZ)

def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calcula la distancia en kilómetros entre dos puntos geográficos usando la fórmula de Haversine.
    """
    R = 6371.0 # Radio de la Tierra en km
    
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)
    
    dlon = lon2_rad - lon1_rad
    dlat = lat2_rad - lat1_rad
    
    a = math.sin(dlat / 2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    distance = R * c
    return distance

# Configuración
limiter = Limiter(key_func=get_remote_address)
SECRET_KEY = "your-secret-key-change-it-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    """
    Hashea una contraseña truncándola a 72 bytes para evitar el error de bcrypt.
    """
    if not password:
        password = "rapidito2024"
    password_bytes = password.encode('utf-8')[:72]
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')

def check_password(password: str, hashed_password: str) -> bool:
    """
    Verifica una contraseña contra un hash de bcrypt.
    """
    try:
        if not password or not hashed_password:
            return False
            
        password_bytes = password.encode('utf-8')[:72]
        hashed_bytes = hashed_password.encode('utf-8')
        
        # Truco de compatibilidad para hashes $2y$ o $2a$
        if hashed_bytes.startswith(b'$2b$'):
            hashed_bytes = b'$2a$' + hashed_bytes[4:]
            
        return bcrypt.checkpw(password_bytes, hashed_bytes)
    except Exception:
        return False

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    now = get_bogota_time()
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt
