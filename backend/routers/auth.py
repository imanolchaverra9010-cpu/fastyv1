from fastapi import APIRouter, HTTPException, status
from datetime import timedelta
import os
import requests
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from database import get_db
from schemas import UserCreate, UserLogin, Token, SocialAuth
from utils import pwd_context, create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES

router = APIRouter()

@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(user: UserCreate):
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = db.cursor(dictionary=True)
    
    # Verificar si ya existe
    cursor.execute("SELECT id FROM users WHERE email = %s OR username = %s", (user.email, user.username))
    if cursor.fetchone():
        db.close()
        raise HTTPException(status_code=400, detail="User already exists")
    
    # Hashear password
    hashed_password = pwd_context.hash(user.password)
    
    # Insertar
    try:
        cursor.execute(
            "INSERT INTO users (username, email, password_hash, role) VALUES (%s, %s, %s, %s)",
            (user.username, user.email, hashed_password, user.role)
        )
        db.commit()
        db.close()
        return {"message": "User created successfully"}
    except Exception as e:
        db.rollback()
        db.close()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/login", response_model=Token)
def login(user_login: UserLogin):
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT * FROM users WHERE email = %s", (user_login.email,))
    user = cursor.fetchone()
    db.close()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    try:
        is_valid = pwd_context.verify(user_login.password, user["password_hash"])
    except ValueError as e:
        print(f"Error crítico: El hash en la BD para {user_login.email} está mal formado.")
        print(f"Hash detectado: {user['password_hash']}")
        raise HTTPException(
            status_code=500,
            detail="Error interno del servidor: Hash de contraseña inválido en la base de datos."
        )

    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
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
def social_login(social_user: SocialAuth):
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
                    raise HTTPException(status_code=400, detail="Invalid Google token")
                data = response.json()
                email = data.get("email")
                username = data.get("name")
                provider_id = data.get("sub")
                avatar_url = data.get("picture")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid Google token: {str(e)}")
    elif provider == "facebook":
        try:
            # Verifica el access_token usando la Graph API de Facebook
            fb_url = f"https://graph.facebook.com/me?fields=id,name,email,picture&access_token={token}"
            response = requests.get(fb_url)
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail="Invalid Facebook token")
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
            raise HTTPException(status_code=400, detail=f"Error validating Facebook token: {str(e)}")
    else:
        raise HTTPException(status_code=400, detail="Unsupported provider")

    if not provider_id or not email:
        raise HTTPException(status_code=400, detail="Failed to retrieve necessary user info from provider")

    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
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
            raise HTTPException(status_code=500, detail="Failed to retrieve user after login/creation")

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
            "avatar_url": user.get("avatar_url")
        }
    except Exception as e:
        if db:
            db.rollback()
            db.close()
        print(f"Error en social_login: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
