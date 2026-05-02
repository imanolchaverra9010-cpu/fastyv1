from fastapi import APIRouter, HTTPException, status, Request
from datetime import timedelta
import os
import requests
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from database import get_db
from schemas import UserCreate, UserLogin, Token, SocialAuth
from utils import pwd_context, create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES, hash_password, limiter
import bcrypt

router = APIRouter()

@router.post("/register", status_code=status.HTTP_201_CREATED)
@limiter.limit("3/minute")
def register(request: Request, user: UserCreate):
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Error de conexión con la base de datos")
    
    cursor = db.cursor(dictionary=True)
    try:
        # Verificar si ya existe
        cursor.execute("SELECT id FROM users WHERE email = %s OR username = %s", (user.email, user.username))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="El usuario ya existe")
        
        # Hashear password
        hashed_password = hash_password(user.password)
        
        # Insertar
        cursor.execute(
            "INSERT INTO users (username, email, password_hash, role) VALUES (%s, %s, %s, %s)",
            (user.username, user.email, hashed_password, user.role)
        )
        db.commit()
        return {"message": "Usuario creado exitosamente"}
    finally:
        cursor.close()
        db.close()

@router.post("/login", response_model=Token)
@limiter.limit("5/minute")
def login(request: Request, user_login: UserLogin):
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Error de conexión con la base de datos")
    
    try:
        cursor = db.cursor(dictionary=True)
        cursor.execute("SELECT * FROM users WHERE email = %s", (user_login.email,))
        user = cursor.fetchone()
    finally:
        cursor.close()
        db.close()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contraseña incorrectos",
        )

    stored_hash = user.get("password_hash")
    
    if not stored_hash or stored_hash == "None":
        provider = user.get("provider")
        if provider:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Esta cuenta está vinculada a {provider.capitalize()}. Por favor, usa el botón de 'Continuar con {provider.capitalize()}' para iniciar sesión."
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Correo o contraseña incorrectos",
            )

    try:
        if isinstance(stored_hash, bytes):
            stored_hash = stored_hash.decode('utf-8')
        stored_hash = str(stored_hash).strip()
        
        # Truco de compatibilidad: algunos sistemas viejos prefieren $2a$ en lugar de $2b$
        check_hash = stored_hash
        if check_hash.startswith('$2b$'):
            check_hash = '$2a$' + check_hash[4:]
        
        # Truncar la contraseña de entrada para que coincida con el hash truncado
        password_bytes = user_login.password.encode('utf-8')[:72]
        
        # Intentar con el hash original primero
        try:
            is_valid = bcrypt.checkpw(password_bytes, stored_hash.encode('utf-8'))
        except ValueError:
            # Si falla, intentar con el truco del prefijo $2a$
            is_valid = bcrypt.checkpw(password_bytes, check_hash.encode('utf-8'))
            
    except Exception as e:
        h_len = len(str(user.get("password_hash", "")))
        h_pre = str(user.get("password_hash", ""))[:10]
        raise HTTPException(
            status_code=500,
            detail=f"Error diagnóstico: Hash en DB tiene {h_len} caracteres y empieza por '{h_pre}'. Error: {type(e).__name__}"
        )

    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["email"], "role": user["role"]}, 
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token, 
        "token_type": "bearer", 
        "id": user["id"],
        "role": user["role"],
        "username": user["username"],
        "email": user["email"],
        "avatar_url": user.get("avatar_url")
    }

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "tu-client-id-aqui")

@router.post("/social-login", response_model=Token)
@limiter.limit("5/minute")
def social_login(request: Request, social_user: SocialAuth):
    provider = social_user.provider
    token = social_user.token
    email = None
    username = None
    provider_id = None
    avatar_url = None

    if provider == "google":
        try:
            # Primero intentar como id_token
            try:
                idinfo = id_token.verify_oauth2_token(token, google_requests.Request(), GOOGLE_CLIENT_ID)
                email = idinfo.get("email")
                username = idinfo.get("name")
                provider_id = idinfo.get("sub")
                avatar_url = idinfo.get("picture")
            except ValueError:
                # Si falla, intentar como access_token consultando a Google UserInfo API
                google_url = f"https://www.googleapis.com/oauth2/v3/userinfo?access_token={token}"
                response = requests.get(google_url)
                if response.status_code != 200:
                    raise HTTPException(status_code=400, detail="Token de Google inválido")
                data = response.json()
                email = data.get("email")
                username = data.get("name")
                provider_id = data.get("sub")
                avatar_url = data.get("picture")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Token de Google inválido: {str(e)}")
    elif provider == "facebook":
        try:
            # Verifica el access_token usando la Graph API de Facebook
            fb_url = f"https://graph.facebook.com/me?fields=id,name,email,picture&access_token={token}"
            response = requests.get(fb_url)
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail="Token de Facebook inválido")
            data = response.json()
            email = data.get("email")
            username = data.get("name")
            provider_id = data.get("id")
            
            if "picture" in data and "data" in data["picture"] and "url" in data["picture"]["data"]:
                avatar_url = data["picture"]["data"]["url"]
            
            # Algunos usuarios de FB no comparten su email
            if not email:
                email = f"{provider_id}@facebook.dummy"
                
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error validando el token de Facebook: {str(e)}")
    else:
        raise HTTPException(status_code=400, detail="Proveedor no soportado")

    if not provider_id or not email:
        raise HTTPException(status_code=400, detail="No se pudo obtener la información necesaria del proveedor")

    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Error de conexión con la base de datos")
    
    cursor = db.cursor(dictionary=True)
    try:
        # 1. Intentar encontrar por provider + provider_id (más específico)
        cursor.execute(
            "SELECT * FROM users WHERE provider = %s AND provider_id = %s", 
            (provider, provider_id)
        )
        user = cursor.fetchone()
        
        if not user:
            # 2. Si no, intentar encontrar por email (vincular cuenta existente)
            cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
            user = cursor.fetchone()
            
            if user:
                # Actualizar usuario existente con datos sociales
                cursor.execute(
                    "UPDATE users SET provider = %s, provider_id = %s, avatar_url = %s WHERE id = %s",
                    (provider, provider_id, avatar_url, user["id"])
                )
            else:
                # 3. Si no existe, crearlo completamente nuevo
                cursor.execute(
                    """INSERT INTO users (username, email, provider, provider_id, avatar_url, role) 
                       VALUES (%s, %s, %s, %s, %s, %s)""",
                    (username, email, provider, provider_id, avatar_url, social_user.role)
                )
                # Obtener el ID del usuario recién creado
                user_id = cursor.lastrowid
                cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
                user = cursor.fetchone()
        else:
            # Si ya existía por provider_id, actualizar avatar por si cambió
            cursor.execute(
                "UPDATE users SET avatar_url = %s WHERE id = %s",
                (avatar_url, user["id"])
            )
        
        db.commit()
        db.close()
        
        if not user:
            raise HTTPException(status_code=500, detail="No se pudo recuperar el usuario después del inicio de sesión/creación")

        # Generar token
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user["email"], "role": user["role"]}, 
            expires_delta=access_token_expires
        )
        
        return {
            "access_token": access_token, 
            "token_type": "bearer", 
            "id": user["id"],
            "role": user["role"],
            "username": user["username"],
            "email": user["email"],
            "avatar_url": user.get("avatar_url")
        }
    except Exception as e:
        if db:
            db.rollback()
            db.close()
        print(f"Error en social_login: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
