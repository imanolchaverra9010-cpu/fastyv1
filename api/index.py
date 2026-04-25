"""
Punto de entrada para Vercel Serverless Functions
Este archivo sirve como handler para todas las solicitudes a /api
"""

import sys
import os
from pathlib import Path

# Agregar el directorio backend al path
backend_path = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_path))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Importar los routers del backend
try:
    from routers import auth, orders, businesses, menu_items, admin, couriers, business_requests, promotions, users
except ImportError as e:
    print(f"Error importando routers: {e}")
    raise

# Crear la aplicación FastAPI (SIN root_path)
app = FastAPI(
    title="Fasty API",
    description="API para la plataforma de domicilios Fasty"
)

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Prefijo base para Vercel
API_PREFIX = "/api"

# Incluir Routers con prefijo correcto
try:
    app.include_router(auth.router, prefix=f"{API_PREFIX}", tags=["Authentication"])
    app.include_router(orders.router, prefix=f"{API_PREFIX}/orders", tags=["Orders"])
    app.include_router(users.router, prefix=f"{API_PREFIX}/users", tags=["Users"])
    app.include_router(businesses.router, prefix=f"{API_PREFIX}/businesses", tags=["Businesses"])
    app.include_router(menu_items.router, prefix=f"{API_PREFIX}/businesses", tags=["Menu Items"])
    app.include_router(promotions.router, prefix=f"{API_PREFIX}/promotions", tags=["Promotions"])
    app.include_router(admin.router, prefix=f"{API_PREFIX}/admin", tags=["Admin Dashboard"])
    app.include_router(couriers.router, prefix=f"{API_PREFIX}/couriers", tags=["Couriers Panel"])
    app.include_router(business_requests.router, prefix=f"{API_PREFIX}/businesses", tags=["Business Requests"])
except Exception as e:
    print(f"Error incluyendo routers: {e}")
    raise

# Ruta raíz
@app.get(f"{API_PREFIX}/")
def read_root():
    return {
        "status": "Fasty API is running",
        "version": "1.0.0",
        "environment": "production"
    }

# Health check
@app.get(f"{API_PREFIX}/health")
def health_check():
    return {"status": "healthy"}
