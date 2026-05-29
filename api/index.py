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
from starlette.middleware.base import BaseHTTPMiddleware
from utils import limiter, log_event
from slowapi.errors import RateLimitExceeded

class ApiPathFixMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if path.startswith("/api/index.py"):
            # Vercel sometimes rewrites to the entrypoint path.
            request.scope["path"] = "/api" + path[len("/api/index.py") :]
        elif not path.startswith("/api"):
            known_api_paths = (
                "/auth",
                "/ai",
                "/orders",
                "/users",
                "/businesses",
                "/promotions",
                "/banners",
                "/admin",
                "/couriers",
                "/push",
                "/payments",
                "/support",
                "/finance",
                "/rides",
                "/maintenance",
                "/debug-db",
                "/static",
            )
            if any(path == prefix or path.startswith(prefix + "/") for prefix in known_api_paths):
                request.scope["path"] = "/api" + request.scope["path"]
        return await call_next(request)


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
    router_names = ["auth", "orders", "businesses", "menu_items", "admin", "couriers", "business_requests", "promotions", "users", "push", "ai", "payments", "banners", "support", "finance", "rides"]
    
    # Importar routers dinámicamente y continuar si alguno falla.
    import importlib
    loaded_routers = {}
    for name in router_names:
        try:
            loaded_routers[name] = importlib.import_module(f"routers.{name}")
            print(f"Módulo routers.{name} importado")
        except Exception as router_exc:
            print(f"Error importando routers.{name}: {router_exc}")
            traceback.print_exc()
    if not loaded_routers:
        raise RuntimeError("No se pudo cargar ningún router de backend")
except Exception as e:
    print(f"Error crítico cargando routers: {e}")
    traceback.print_exc()
    raise

# Crear la aplicación FastAPI (SIN root_path)
app = FastAPI(
    title="Fasty API",
    description="API para la plataforma de domicilios Fasty"
)

# Soporte para posibles reescrituras de ruta en Vercel
app.add_middleware(ApiPathFixMiddleware)

# Configurar Rate Limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, spanish_rate_limit_exceeded_handler)

# Exception handler para debug
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    log_event("serverless_unhandled_exception", "error", method=request.method, path=request.url.path, error=str(exc), type=type(exc).__name__)
    if os.getenv("ENV") == "development":
        return JSONResponse(status_code=500, content={"error": str(exc), "type": type(exc).__name__, "traceback": traceback.format_exc()})
    return JSONResponse(status_code=500, content={"detail": "Error interno del servidor"})

# Configurar CORS
allowed_origins = [origin.strip() for origin in os.getenv("ALLOWED_ORIGINS", "").split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins or ["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Prefijo base para Vercel
API_PREFIX = "/api"

# Incluir Routers con prefijo correcto
# Lista de routers a cargar
routers_to_load = [
    ("auth", f"{API_PREFIX}", ["Authentication"]),
    ("ai", f"{API_PREFIX}/ai", ["AI Features"]),
    ("orders", f"{API_PREFIX}/orders", ["Orders"]),
    ("users", f"{API_PREFIX}/users", ["Users"]),
    ("menu_items", f"{API_PREFIX}/businesses", ["Menu Items"]),
    ("business_requests", f"{API_PREFIX}/businesses", ["Business Requests"]),
    ("businesses", f"{API_PREFIX}/businesses", ["Businesses"]),
    ("promotions", f"{API_PREFIX}/promotions", ["Promotions"]),
    ("admin", f"{API_PREFIX}/admin", ["Admin Dashboard"]),
    ("push", f"{API_PREFIX}/push", ["Push Notifications"]),
    ("payments", f"{API_PREFIX}/payments", ["Payments"]),
    ("banners", f"{API_PREFIX}/banners", ["Banners"]),
    ("support", f"{API_PREFIX}/support", ["Support"]),
    ("finance", f"{API_PREFIX}/finance", ["Finance"]),
    ("rides", f"{API_PREFIX}/rides", ["Rides"]),
    ("couriers", f"{API_PREFIX}/couriers", ["Couriers Panel"]),
]

for name, prefix, tags in routers_to_load:
    if name not in loaded_routers:
        print(f"Omitiendo router '{name}' porque no se importó correctamente")
        continue
    try:
        router_obj = loaded_routers[name].router
        app.include_router(router_obj, prefix=prefix, tags=tags)
        print(f"Router '{name}' cargado exitosamente en {prefix}")

        if prefix.startswith("/api"):
            alt_prefix = prefix[4:]
            # Incluir rutas sin /api también, para soportar posibles reescrituras de Vercel
            app.include_router(router_obj, prefix=alt_prefix, tags=tags, include_in_schema=False)
            print(f"Router '{name}' cargado exitosamente también en {alt_prefix}")
    except Exception as e:
        print(f"Error cargando router '{name}': {e}")
        traceback.print_exc()
        raise

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

# Maintenance mode check
@app.get("/api/maintenance")
@app.get("/maintenance")
def check_maintenance():
    from utils import get_public_maintenance_mode
    return {"maintenance_mode": get_public_maintenance_mode()}

@app.get("/api/theme-color")
@app.get("/theme-color")
def get_theme_color_public():
    try:
        from database import get_db
        db = get_db()
        if not db:
            return {"theme_color": "#f97316"}
        cursor = db.cursor(dictionary=True)
        try:
            cursor.execute("SELECT config_value FROM system_config WHERE config_key = 'theme_color'")
            result = cursor.fetchone()
            return {"theme_color": result['config_value'] if result else "#f97316"}
        except Exception:
            return {"theme_color": "#f97316"}
        finally:
            db.close()
    except Exception:
        return {"theme_color": "#f97316"}

# Diagnóstico de base de datos (solo admin)
@app.get(f"{API_PREFIX}/debug-db")
def debug_db():
    if os.getenv("ENV") == "production":
        raise HTTPException(status_code=404, detail="Not found")
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
