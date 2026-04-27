import bcrypt
# Workaround for passlib/bcrypt incompatibility in newer versions
if not hasattr(bcrypt, "__about__"):
    class BCryptAbout:
        __version__ = getattr(bcrypt, "__version__", "4.0.0")
    bcrypt.__about__ = BCryptAbout()

from passlib.context import CryptContext
from jose import jwt
from datetime import datetime, timedelta
from typing import Optional
from slowapi import Limiter
from slowapi.util import get_remote_address

# Configuración
limiter = Limiter(key_func=get_remote_address)
SECRET_KEY = "your-secret-key-change-it-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    """
    Hashea una contraseña truncándola a 72 bytes para evitar el error de bcrypt.
    Utiliza bcrypt directamente para mayor compatibilidad con versiones 4.0+.
    """
    if not password:
        password = "rapidito2024"
        
    # Asegurar que sea string
    if not isinstance(password, str):
        password = str(password)
        
    # Truncar a 72 bytes (límite físico de bcrypt)
    # Primero codificamos a bytes, truncamos y luego (opcionalmente) volvemos a string 
    # o pasamos bytes directamente a bcrypt.
    password_bytes = password.encode('utf-8')[:72]
    
    # Generar el salt y hashear
    # passlib usa rounds=12 por defecto, lo mantenemos igual
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password_bytes, salt)
    
    return hashed.decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt
