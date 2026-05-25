from typing import Optional
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from database import get_db
from utils import SECRET_KEY, ALGORITHM

security = HTTPBearer()
optional_security = HTTPBearer(auto_error=False)


def verify_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Token inválido")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido")


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = verify_token(token)
    email = payload.get("sub")

    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Error de conexión con la base de datos")
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT id, email, role, username FROM users WHERE email = %s", (email,))
        user = cursor.fetchone()
        if not user:
            raise HTTPException(status_code=401, detail="Usuario no encontrado")
        return user
    finally:
        cursor.close()
        db.close()


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_security),
):
    if not credentials:
        return None
    token = credentials.credentials
    try:
        payload = verify_token(token)
    except HTTPException:
        return None
    email = payload.get("sub")
    db = get_db()
    if not db:
        return None
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT id, email, role, username FROM users WHERE email = %s", (email,))
        return cursor.fetchone()
    finally:
        cursor.close()
        db.close()


def require_admin(current_user: dict):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="No tienes permisos de administrador")


def require_roles(current_user: dict, *roles: str):
    if current_user["role"] not in roles:
        raise HTTPException(status_code=403, detail="No tienes permiso para esta acción")


def require_roles_dependency(*roles: str):
    async def _dependency(current_user: dict = Depends(get_current_user)):
        require_roles(current_user, *roles)
        return current_user
    return _dependency


def assert_business_owner(cursor, business_id: str, user: dict):
    if user["role"] == "admin":
        return
    if user["role"] != "business":
        raise HTTPException(status_code=403, detail="No tienes permiso para gestionar este negocio")
    cursor.execute("SELECT owner_id FROM businesses WHERE id = %s", (business_id,))
    row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Negocio no encontrado")
    if row["owner_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="No tienes permiso para gestionar este negocio")


def assert_order_access(cursor, order: dict, user: dict):
    if user["role"] == "admin":
        return
    if user["role"] == "customer" and order.get("user_id") == user["id"]:
        return
    if user["role"] == "business" and order.get("business_owner_id") == user["id"]:
        return
    if user["role"] == "courier" and order.get("courier_user_id") == user["id"]:
        return
    raise HTTPException(status_code=403, detail="No tienes permiso para ver este pedido")
