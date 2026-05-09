import os
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from database import get_db
from utils import SECRET_KEY, ALGORITHM

security = HTTPBearer()


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
