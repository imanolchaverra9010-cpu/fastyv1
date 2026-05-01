"""
Punto de entrada para Vercel Serverless Functions
Este archivo sirve como handler para todas las solicitudes a /api
"""

import sys
import os
from pathlib import Path
from datetime import datetime

# Agregar el directorio backend al path
backend_path = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_path))

import traceback
from fastapi import FastAPI, Request, HTTPException, APIRouter
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from utils import limiter
from slowapi.errors import RateLimitExceeded

def spanish_rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Has realizado demasiados intentos. Por favor, espera un minuto antes de intentar de nuevo."}
    )

# Importar los routers del backend
try:
    # Asegurarnos de que el path es absoluto
    sys.path.insert(0, str(backend_path.absolute()))
    
    # Debug: imprimir el path para los logs de Vercel
    print(f"Backend path: {backend_path.absolute()}")
    print(f"Contenido de backend: {os.listdir(backend_path) if backend_path.exists() else 'NO EXISTE'}")
    
    import routers
    router_names = ["auth", "orders", "businesses", "menu_items", "admin", "couriers", "business_requests", "promotions", "users", "push", "ai"]
    
    # Importar routers dinámicamente para que si uno falla no mate a los demás
    import importlib
    for name in router_names:
        try:
            globals()[name] = importlib.import_module(f"routers.{name}")
            print(f"Módulo routers.{name} importado")
        except Exception as e:
            print(f"Error importando routers.{name}: {e}")
            class Dummy: 
                def __init__(self):
                    self.router = APIRouter()
            globals()[name] = Dummy()
except Exception as e:
    print(f"Error crítico cargando routers: {e}")
    # No podemos lanzar una excepción aquí porque mataría la app de Vercel
    # pero al menos lo veremos en los logs.
    raise

# Crear la aplicación FastAPI (SIN root_path)
app = FastAPI(
    title="Fasty API",
    description="API para la plataforma de domicilios Fasty"
)

# Configurar Rate Limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, spanish_rate_limit_exceeded_handler)

# Exception handler para debug
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"ERROR GLOBAL: {exc}")
    print(traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={
            "error": str(exc),
            "type": type(exc).__name__,
            "traceback": traceback.format_exc()
        }
    )

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex="https?://.*", # Permitir cualquier origen de forma segura para desarrollo/producción
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Prefijo base para Vercel
API_PREFIX = "/api"

# Incluir Routers con prefijo correcto
# Lista de routers a cargar
routers_to_load = [
    ("auth", auth.router, f"{API_PREFIX}", ["Authentication"]),
    ("ai", ai.router, f"{API_PREFIX}/ai", ["AI Features"]),
    ("orders", orders.router, f"{API_PREFIX}/orders", ["Orders"]),
    ("users", users.router, f"{API_PREFIX}/users", ["Users"]),
    ("menu_items", menu_items.router, f"{API_PREFIX}/businesses", ["Menu Items"]),
    ("business_requests", business_requests.router, f"{API_PREFIX}/businesses", ["Business Requests"]),
    ("businesses", businesses.router, f"{API_PREFIX}/businesses", ["Businesses"]),
    ("promotions", promotions.router, f"{API_PREFIX}/promotions", ["Promotions"]),
    ("admin", admin.router, f"{API_PREFIX}/admin", ["Admin Dashboard"]),
    ("couriers", couriers.router, f"{API_PREFIX}/couriers", ["Couriers Panel"]),
    ("push", push.router, f"{API_PREFIX}/push", ["Push Notifications"]),
]

for name, router_obj, prefix, tags in routers_to_load:
    try:
        app.include_router(router_obj, prefix=prefix, tags=tags)
        print(f"Router '{name}' cargado exitosamente")
    except Exception as e:
        print(f"Error cargando router '{name}': {e}")
        # Opcional: podrías decidir si fallar o continuar

# Ruta raíz
@app.get(f"{API_PREFIX}/")
def read_root():
    db_status = "Unknown"
    db_error = None
    try:
        from database import get_db
        conn = get_db()
        if conn:
            db_status = "Connected"
            conn.close()
        else:
            db_status = "Failed"
            db_error = "Could not connect to database (check credentials/whitelist)"
    except Exception as e:
        db_status = "Error"
        db_error = str(e)

    return {
        "status": "Fasty API is running",
        "version": "1.0.0",
        "environment": "production",
        "database": {
            "status": db_status,
            "error": db_error
        }
    }

# Health check
@app.get(f"{API_PREFIX}/health")
def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat()
    }

# Cache para modo mantenimiento para reducir carga en DB
maint_cache = {"value": False, "last_check": None}

# Maintenance mode check
@app.get(f"{API_PREFIX}/maintenance")
@app.get("/maintenance") # Fallback en caso de que el prefijo sea removido por el proxy
def check_maintenance():
    global maint_cache
    now = datetime.now()
    
    # Reutilizar cache si tiene menos de 10 segundos
    if maint_cache["last_check"] and (now - maint_cache["last_check"]).total_seconds() < 10:
        return {"maintenance_mode": maint_cache["value"]}
        
    try:
        from database import get_db
        db = get_db()
        if not db: return {"maintenance_mode": maint_cache["value"]}
        cursor = db.cursor(dictionary=True)
        try:
            cursor.execute("SELECT config_value FROM system_config WHERE config_key = 'maintenance_mode'")
            result = cursor.fetchone()
            maint_cache["value"] = result['config_value'] == 'true' if result else False
            maint_cache["last_check"] = now
            return {"maintenance_mode": maint_cache["value"]}
        finally:
            db.close()
    except Exception as e:
        print(f"Error checking maintenance in api/index: {e}")
        return {"maintenance_mode": maint_cache["value"]}

# Diagnóstico de base de datos
@app.get(f"{API_PREFIX}/debug-db")
def debug_db():
    try:
        from database import db_config, get_db
        # Ocultar password por seguridad
        safe_config = {k: v for k, v in db_config.items() if k != "password"}
        
        conn = get_db()
        if conn:
            conn.close()
            return {"status": "success", "config": safe_config}
        else:
            return {"status": "failed", "config": safe_config, "message": "Connection returned None"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# Ruta personalizada para servir archivos estáticos (incluyendo /tmp en Vercel)
@app.get(f"{API_PREFIX}/static/{{path:path}}")
async def get_static_file(path: str):
    # 1. Buscar en el directorio backend/static
    local_static_path = backend_path / "static" / path
    if local_static_path.exists() and local_static_path.is_file():
        return FileResponse(str(local_static_path))
    
    # 2. Buscar en /tmp (para archivos subidos en Vercel)
    tmp_path = Path("/tmp") / path
    if tmp_path.exists() and tmp_path.is_file():
        return FileResponse(str(tmp_path))
        
    # 3. Caso especial para business_images en /tmp
    if "business_images" in path:
        filename = path.split("/")[-1]
        tmp_business_path = Path("/tmp/business_images") / filename
        if tmp_business_path.exists() and tmp_business_path.is_file():
            return FileResponse(str(tmp_business_path))
            
    raise HTTPException(status_code=404, detail=f"File not found: {path}")
