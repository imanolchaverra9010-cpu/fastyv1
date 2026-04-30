from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import sys
import os
import json
from typing import Dict

# Añadir el directorio actual al path para importar los módulos locales
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from routers import auth, orders, businesses, menu_items, admin, couriers, business_requests, promotions, users, ai
from utils import limiter
from slowapi.errors import RateLimitExceeded
from fastapi.responses import JSONResponse

def spanish_rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Has realizado demasiados intentos. Por favor, espera un minuto antes de intentar de nuevo."}
    )

app = FastAPI(title="Rapidito API")

# Configurar Rate Limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, spanish_rate_limit_exceeded_handler)

# Directorio estático para fotos de perfil
try:
    if not os.path.exists("static"):
        os.makedirs("static")
    if not os.path.exists("static/profiles"):
        os.makedirs("static/profiles")
    if not os.path.exists("static/business_images"):
        os.makedirs("static/business_images")
except OSError:
    print("Warning: Could not create static directories (read-only file system)")

app.mount("/static", StaticFiles(directory="static"), name="static")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Permitir todos para desarrollo
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Incluir Routers
app.include_router(auth.router, tags=["Authentication"])
app.include_router(orders.router, prefix="/orders", tags=["Orders"])
app.include_router(users.router, prefix="/users", tags=["Users"])
app.include_router(businesses.router, prefix="/businesses", tags=["Businesses"])
app.include_router(menu_items.router, prefix="/businesses", tags=["Menu Items"])
app.include_router(promotions.router, prefix="/promotions", tags=["Promotions"])
app.include_router(admin.router, prefix="/admin", tags=["Admin Dashboard"])
app.include_router(couriers.router, prefix="/couriers", tags=["Couriers Panel"])
app.include_router(business_requests.router, prefix="/businesses", tags=["Business Requests"])
app.include_router(ai.router, prefix="/ai", tags=["AI Features"])

@app.get("/")
def read_root():
    return {"status": "Rapidito API is running modularly"}

# WebSocket Manager
class ConnectionManager:
    def __init__(self):
        # courier_id -> WebSocket
        self.courier_connections: Dict[int, WebSocket] = {}
        # business_id -> WebSocket
        self.business_connections: Dict[str, WebSocket] = {}
        # user_id -> WebSocket
        self.user_connections: Dict[int, WebSocket] = {}

    async def connect_courier(self, courier_id: int, websocket: WebSocket):
        await websocket.accept()
        self.courier_connections[courier_id] = websocket

    def disconnect_courier(self, courier_id: int):
        if courier_id in self.courier_connections:
            del self.courier_connections[courier_id]

    async def connect_business(self, business_id: str, websocket: WebSocket):
        await websocket.accept()
        self.business_connections[business_id] = websocket

    def disconnect_business(self, business_id: str):
        if business_id in self.business_connections:
            del self.business_connections[business_id]

    async def connect_user(self, user_id: int, websocket: WebSocket):
        await websocket.accept()
        self.user_connections[user_id] = websocket

    def disconnect_user(self, user_id: int):
        if user_id in self.user_connections:
            del self.user_connections[user_id]

    async def notify_couriers(self, message: dict):
        for connection in self.courier_connections.values():
            try:
                await connection.send_json(message)
            except:
                pass

    async def notify_business(self, business_id: str, message: dict):
        if business_id in self.business_connections:
            try:
                await self.business_connections[business_id].send_json(message)
            except:
                pass

    async def notify_user(self, user_id: int, message: dict):
        if user_id in self.user_connections:
            try:
                await self.user_connections[user_id].send_json(message)
            except:
                pass

manager = ConnectionManager()

@app.websocket("/ws/courier/{courier_id}")
async def courier_websocket_endpoint(websocket: WebSocket, courier_id: int):
    await manager.connect_courier(courier_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect_courier(courier_id)

@app.websocket("/ws/business/{business_id}")
async def business_websocket_endpoint(websocket: WebSocket, business_id: str):
    await manager.connect_business(business_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect_business(business_id)

@app.websocket("/ws/user/{user_id}")
async def user_websocket_endpoint(websocket: WebSocket, user_id: int):
    await manager.connect_user(user_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect_user(user_id)

# Pasar el manager a los routers que lo necesiten
orders.set_websocket_manager(manager)
businesses.set_websocket_manager(manager)
couriers.set_websocket_manager(manager)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
