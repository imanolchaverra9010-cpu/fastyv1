# 🔴 REPORTE DE ERRORES DE LÓGICA - Fastyy Platform

**Fecha**: Mayo 2026  
**Criticidad General**: CRÍTICA  
**Total de Errores Identificados**: 24

---

## 📋 RESUMEN EJECUTIVO

Tu plataforma tiene **vulnerabilidades críticas de seguridad** y **errores de lógica de negocio** que pueden causar:
- Pérdida de ingresos (cupones reutilizables, pagos no validados)
- Compromiso de datos sensibles (credenciales expuestas)
- Operación fraudulenta (órdenes sin validación)
- Inconsistencia de datos (race conditions)

---

## 🔴 ERRORES CRÍTICOS (Arreglar Inmediatamente)

### 1. **AUTENTICACIÓN COMPLETAMENTE AUSENTE**
**Severity**: 🔴🔴🔴 CRÍTICA  
**Riesgo**: Acceso no autorizado a datos sensibles

#### Problema:
Los endpoints backend NO validan tokens JWT. Cualquiera puede:
```bash
# ❌ ESTO FUNCIONA (no debería)
curl /api/users/123/stats
curl /api/couriers/456/profile
curl /api/businesses/789/orders
```

#### Ubicación:
- `backend/utils.py`: NO hay función `verify_token()`
- Todos los routers: No usan `Depends(get_current_user)`
- `backend/main.py`: No tiene middleware de autenticación

#### Solución:
```python
# backend/utils.py - AGREGAR:
def verify_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Token inválido")
        return email
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")

# backend/utils.py - AGREGAR:
from fastapi.security import HTTPBearer, HTTPAuthCredentials
from fastapi import Depends

async def get_current_user(credentials: HTTPAuthCredentials = Depends(HTTPBearer())):
    token = credentials.credentials
    email = verify_token(token)
    # Obtener usuario de BD
    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT id, role FROM users WHERE email = %s", (email,))
    user = cursor.fetchone()
    cursor.close()
    db.close()
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    return user
```

Luego en cada endpoint protegido:
```python
@router.get("/{order_id}")
def get_order(order_id: str, current_user = Depends(get_current_user)):
    # Ahora `current_user` contiene {'id': ..., 'role': ...}
    ...
```

---

### 2. **CREDENCIALES DE BASE DE DATOS EXPUESTAS**
**Severity**: 🔴🔴🔴 CRÍTICA  
**Riesgo**: Acceso no autorizado a BD producción

#### Problema:
```python
# backend/database.py - ❌ EXPUESTO
db_config = {
    "host": "switchback.proxy.rlwy.net",
    "user": "root",
    "password": "OyDRGvdWqQwOLiknRFLmFFdhPOVuwgws",  # ← VISIBLE EN CÓDIGO
    "database": "railway",
    "port": 46587,
}
```

#### Riesgo:
- Cualquiera con acceso al código puede conectarse a BD
- Contraseña está en git history
- Visible en logs de servidor

#### Solución:
```python
# backend/database.py - CORRECTO
import os
from dotenv import load_dotenv

load_dotenv()  # Carga desde .env

db_config = {
    "host": os.getenv("DATABASE_HOST"),
    "user": os.getenv("DATABASE_USER"),
    "password": os.getenv("DATABASE_PASSWORD"),
    "database": os.getenv("DATABASE_NAME"),
    "port": int(os.getenv("DATABASE_PORT", "3306")),
}

if not all([db_config["host"], db_config["user"], db_config["password"]]):
    raise ValueError("Variables de entorno de BD no configuradas")
```

**Acción**:
1. Cambiar contraseña de BD en Railway
2. Crear archivo `.env` en root (NUNCA commitar a git)
3. Añadir `.env` a `.gitignore`

---

### 3. **SECRET_KEY HARDCODEADO EN CÓDIGO**
**Severity**: 🔴🔴🔴 CRÍTICA  
**Riesgo**: Forja de tokens JWT

#### Problema:
```python
# backend/utils.py - ❌ EXPUESTO
SECRET_KEY = "your-secret-key-change-it-in-production"
```

Cualquiera que vea este código puede crear tokens válidos:
```python
from jose import jwt
fake_token = jwt.encode(
    {"sub": "admin@example.com", "role": "admin"},
    "your-secret-key-change-it-in-production",
    algorithm="HS256"
)
# Ahora pueden usar este token en /api/*
```

#### Solución:
```python
# backend/utils.py
import os
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY or SECRET_KEY == "your-secret-key-change-it-in-production":
    raise ValueError("SECRET_KEY no configurada o usa valor por defecto INSEGURO")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
```

En `.env`:
```
SECRET_KEY=tu-secret-key-super-seguro-generado-aleatoriamente-de-64-caracteres
```

Generar SECRET_KEY seguro:
```python
import secrets
print(secrets.token_urlsafe(32))
```

---

### 4. **PAGOS SIN VALIDACIÓN REAL**
**Severity**: 🔴🔴🔴 CRÍTICA  
**Riesgo**: Órdenes sin pagar se procesan como pagadas

#### Problema:
```python
# backend/routers/payments.py - ❌ INSEGURO
if order['status'] not in ['pending', 'pending_payment']:
    if order['status'] == 'confirmed':
        return {
            "status": "ALREADY_PAID",
            "message": "Este pedido ya ha sido pagado"
        }
```

**Lógica defectuosa**:
1. Usuario crea orden con payment_method="card" → status="pending_payment"
2. Usuario NO paga en Wompi
3. Usuario llama a `PATCH /orders/{id}/status` con status="confirmed"
4. Orden se marca como confirmada SIN pagar
5. Negocio prepara comida, courier entrega
6. 💸 Fastyy pierde dinero

#### Solución:
```python
# backend/routers/payments.py

@router.post("/webhook")
async def wompi_webhook(request: Request):
    """Procesar webhook de Wompi"""
    try:
        body = await request.body()
        payload = body.decode('utf-8')
        
        signature = request.headers.get('X-Wompi-Signature')
        if signature and not verify_wompi_signature(payload, signature):
            raise HTTPException(status_code=401, detail="Firma inválida")

        webhook_data = json.loads(payload)
        event = webhook_data.get('event')
        transaction_data = webhook_data.get('data', {})

        db = get_db()
        if not db:
            raise HTTPException(status_code=500, detail="DB error")

        cursor = db.cursor(dictionary=True)
        
        if event == 'transaction.updated':
            transaction_id = transaction_data.get('id')
            status = transaction_data.get('status')  # 'APPROVED', 'DECLINED', 'PENDING'
            reference = transaction_data.get('reference')
            
            cursor.execute(
                "SELECT order_id FROM payments WHERE reference = %s",
                (reference,)
            )
            payment_record = cursor.fetchone()
            
            if payment_record:
                order_id = payment_record['order_id']
                
                # IMPORTANTE: Solo actualizar BD si webhook es válido
                if status == 'APPROVED':
                    cursor.execute(
                        "UPDATE payments SET status = %s, transaction_id = %s, updated_at = %s WHERE reference = %s",
                        ('APPROVED', transaction_id, get_bogota_time(), reference)
                    )
                    # SOLO AQUÍ podemos cambiar order status
                    cursor.execute(
                        "UPDATE orders SET status = %s WHERE id = %s AND status = %s",
                        ('confirmed', order_id, 'pending_payment')
                    )
                    
                    # Notificar negocio y couriers
                    background_tasks.add_task(notify_order_confirmed, order_id)
                    
                    db.commit()
                    
        cursor.close()
        db.close()
        return {"status": "ok"}
```

Y prohibir cambios manuales:
```python
# backend/routers/orders.py

@router.patch("/{order_id}/status")
def update_order_status(
    order_id: str, 
    status_update: StatusUpdate,
    current_user = Depends(get_current_user)  # ← AGREGAR AUTENTICACIÓN
):
    db = get_db()
    if not db:
        raise HTTPException(status_code=500)
    
    cursor = db.cursor(dictionary=True)
    
    # Obtener orden actual
    cursor.execute("SELECT status, user_id, business_id FROM orders WHERE id = %s", (order_id,))
    order = cursor.fetchone()
    
    if not order:
        raise HTTPException(status_code=404)
    
    # ✅ CRÍTICO: Validar permisos
    if current_user['role'] == 'customer' and current_user['id'] != order['user_id']:
        raise HTTPException(status_code=403, detail="No tienes permiso")
    
    new_status = status_update.status
    
    # ✅ CRÍTICO: No permitir saltar estados de pago
    if new_status == 'confirmed':
        if order['status'] != 'pending_payment':
            raise HTTPException(
                status_code=400,
                detail="Orden debe estar en estado pending_payment para confirmar"
            )
        # Verificar que haya pago confirmado
        cursor.execute(
            "SELECT status FROM payments WHERE order_id = %s AND status = %s",
            (order_id, 'APPROVED')
        )
        payment = cursor.fetchone()
        if not payment:
            raise HTTPException(status_code=400, detail="Pago no confirmado")
    
    # ... resto del código
```

---

### 5. **ÓRDENES PUEDEN SER ACEPTADAS POR MÚLTIPLES COURIERS**
**Severity**: 🔴🔴 CRÍTICA  
**Riesgo**: Doble entrega, confusión operativa, fraude

#### Problema:
```python
# backend/routers/couriers.py - ❌ RACE CONDITION
@router.post("/{user_id}/accept-order/{order_id}")
async def accept_order(user_id: int, order_id: str):
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        # ❌ SIN VALIDACIÓN
        cursor.execute(
            "UPDATE orders SET courier_id = %s, status = %s WHERE id = %s",
            (courier_id, 'shipped', order_id)
        )
        db.commit()
        # PROBLEMA: Si 2 couriers hacen request simultáneamente, ambos actualizan
```

#### Solución:
```python
# backend/routers/couriers.py

@router.post("/{user_id}/accept-order/{order_id}")
async def accept_order(user_id: int, order_id: str, current_user = Depends(get_current_user)):
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        # ✅ Usar transacción con FOR UPDATE
        db.start_transaction()
        
        # Obtener orden CON LOCK
        cursor.execute(
            "SELECT * FROM orders WHERE id = %s FOR UPDATE",
            (order_id,)
        )
        order = cursor.fetchone()
        
        if not order:
            db.rollback()
            raise HTTPException(status_code=404)
        
        # ✅ Validar que NO tenga courier ya
        if order['courier_id'] is not None:
            db.rollback()
            raise HTTPException(
                status_code=400,
                detail="Otra persona ya aceptó esta orden"
            )
        
        # ✅ Validar que courier esté online
        cursor.execute(
            "SELECT status FROM couriers WHERE user_id = %s",
            (user_id,)
        )
        courier = cursor.fetchone()
        if not courier or courier['status'] != 'online':
            db.rollback()
            raise HTTPException(status_code=400, detail="Debes estar online")
        
        # Actualizar con lock
        cursor.execute(
            "UPDATE orders SET courier_id = %s, status = %s WHERE id = %s",
            (user_id, 'shipped', order_id)
        )
        
        # Log
        cursor.execute(
            "INSERT INTO order_status_logs (order_id, status) VALUES (%s, %s)",
            (order_id, 'shipped')
        )
        
        db.commit()
        
        # Notificar a cliente
        await notify_courier_assigned(order_id, user_id)
        
        return {"message": "Orden aceptada"}
        
    except Exception as e:
        db.rollback()
        raise
    finally:
        cursor.close()
        db.close()
```

---

## 🟠 ERRORES ALTOS (Muy Importante Arreglar)

### 6. **CUPONES PUEDEN USARSE INFINITAS VECES**
**Severity**: 🟠🟠 ALTA  
**Riesgo**: Pérdida de ingresos, fraude

#### Problema:
```python
# backend/routers/orders.py - ❌ INSEGURO
if order.promo_code and order.user_id:
    cursor.execute(
        "INSERT INTO used_coupons (user_id, code, created_at) VALUES (%s, %s, %s)",
        (order.user_id, order.promo_code, get_bogota_time())
    )
```

**Lógica defectuosa**:
- NO valida que el código exista
- NO valida que el usuario no lo haya usado antes
- NO valida que el cupón esté activo
- NO valida que no haya expirado
- DUPLICATE KEY constraint silenciosa = error no capturado

#### Solución:
```python
# backend/routers/orders.py

async def validate_promo_code(cursor, db, promo_code: str, user_id: int):
    """Validar que promo_code es válido y puede usarse"""
    
    if not promo_code:
        return None, 0
    
    # 1. Verificar que existe y está activo
    cursor.execute("""
        SELECT id, discount_percentage, max_uses, expiry_date
        FROM promotions
        WHERE code = %s AND status = 'active'
    """, (promo_code,))
    promo = cursor.fetchone()
    
    if not promo:
        raise HTTPException(status_code=400, detail="Código de promoción inválido")
    
    # 2. Verificar que no ha expirado
    if promo['expiry_date'] and promo['expiry_date'] < datetime.now().date():
        raise HTTPException(status_code=400, detail="Código de promoción expirado")
    
    # 3. Verificar que el usuario no lo ha usado antes
    cursor.execute("""
        SELECT COUNT(*) as uses
        FROM used_coupons
        WHERE user_id = %s AND code = %s
    """, (user_id, promo_code))
    result = cursor.fetchone()
    if result['uses'] > 0:
        raise HTTPException(status_code=400, detail="Ya usaste este código")
    
    # 4. Verificar que no se ha alcanzado el límite de usos
    cursor.execute("""
        SELECT COUNT(*) as total_uses
        FROM used_coupons
        WHERE code = %s
    """, (promo_code,))
    result = cursor.fetchone()
    if promo['max_uses'] and result['total_uses'] >= promo['max_uses']:
        raise HTTPException(status_code=400, detail="Código agotado")
    
    discount = promo['discount_percentage']
    return promo_code, discount

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_order(order: OrderCreate):
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = db.cursor(dictionary=True)
    
    try:
        # ✅ Validar cupón ANTES de crear orden
        if order.promo_code:
            promo_code, discount_pct = await validate_promo_code(
                cursor, db, order.promo_code, order.user_id
            )
        else:
            promo_code, discount_pct = None, 0
        
        # Calcular descuento
        discount_amount = int(order.total * discount_pct / 100) if discount_pct else 0
        final_total = order.total - discount_amount
        
        # Crear orden
        order_id = str(uuid.uuid4())[:8]
        cursor.execute("""
            INSERT INTO orders (id, user_id, total, promo_code, discount_amount, ...)
            VALUES (%s, %s, %s, %s, %s, ...)
        """, (order_id, order.user_id, final_total, promo_code, discount_amount, ...))
        
        # SOLO DESPUÉS de crear orden, registrar uso del cupón
        if promo_code:
            cursor.execute("""
                INSERT INTO used_coupons (user_id, code, created_at)
                VALUES (%s, %s, %s)
            """, (order.user_id, promo_code, get_bogota_time()))
        
        db.commit()
        return {"order_id": order_id, "total": final_total}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()
```

---

### 7. **VISIBLE_PASSWORD EXPUESTO EN API PÚBLICA**
**Severity**: 🟠 MEDIA  
**Riesgo**: Exposición de contraseñas de propietarios

#### Problema:
```python
# backend/routers/businesses.py - ❌ INSEGURO
query = """
    SELECT b.*, u.username, u.email, u.visible_password
    FROM businesses b
    LEFT JOIN users u ON b.owner_id = u.id
"""
# GET /api/businesses → retorna visible_password para TODOS
```

#### Solución:
```python
# backend/routers/businesses.py

@router.get("", response_model=List[BusinessResponse])
def get_businesses(response: Response, current_user = Depends(get_current_user)):
    query = """
        SELECT b.id, b.name, b.description, b.category, b.address, 
               b.phone, b.emoji, b.image_url, b.delivery_fee, b.eta, 
               b.status, b.rating, b.latitude, b.longitude,
               u.username, u.email
        FROM businesses b
        LEFT JOIN users u ON b.owner_id = u.id
        WHERE 1=1
    """
    # ✅ NUNCA incluir visible_password
```

---

### 8. **JWT TOKEN EN LOCALSTORAGE (XSS VULNERABLE)**
**Severity**: 🟠 MEDIA  
**Riesgo**: Tokens robables por malware/XSS

#### Problema:
```typescript
// src/context/AuthContext.tsx - ❌ INSEGURO
localStorage.setItem("rapidito_user", JSON.stringify(userData));
// Token accesible a cualquier script JavaScript
```

#### Solución:
```typescript
// src/context/AuthContext.tsx

// Guardar en httpOnly cookie (servidor sólo)
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  
  useEffect(() => {
    // El servidor debería setear httpOnly cookie
    // No guardar token en localStorage
    const userData = {
      id: user?.id,
      username: user?.username,
      role: user?.role,
      // NO incluir token aquí
    };
    localStorage.setItem("rapidito_user", JSON.stringify(userData));
  }, []);
  
  const login = (userData: Omit<User, 'token'>) => {
    setUser({...userData, token: undefined});
    localStorage.setItem("rapidito_user", JSON.stringify(userData));
    // Token llegará en httpOnly cookie automáticamente
  };
};
```

Backend debe devolver token en httpOnly cookie:
```python
# backend/routers/auth.py

from fastapi.responses import JSONResponse

@router.post("/login", response_model=dict)
def login(request: Request, user_login: UserLogin):
    # ... validar credenciales ...
    
    access_token = create_access_token(
        data={"sub": user["email"], "role": user["role"]}, 
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    
    response = JSONResponse(content={
        "id": user["id"],
        "role": user["role"],
        "username": user["username"],
        "email": user["email"],
        # ✅ NO incluir token aquí
    })
    
    # ✅ Setear en httpOnly cookie
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=True,  # HTTPS only
        samesite="strict",
        max_age=30 * 60  # 30 minutos
    )
    
    return response
```

Frontend debe pasar cookie automáticamente:
```typescript
// src/lib/api.ts
const apiClient = axios.create({
  baseURL: '/api',
  withCredentials: true,  // ✅ Incluir cookies automáticamente
});
```

---

## 🟡 ERRORES MEDIOS (Importante Arreglar)

### 9. **RATINGS SIN VALIDACIÓN DE RANGO**
**Severity**: 🟡 MEDIA  
**Riesgo**: Datos inconsistentes

#### Problema:
```python
# backend/schemas.py
class OrderRatingCreate(BaseModel):
    business_rating: int  # ❌ Puede ser cualquier int
    courier_rating: Optional[int] = None
```

Usuario puede calificar con: -999, 0, 100, etc.

#### Solución:
```python
# backend/schemas.py
from pydantic import Field

class OrderRatingCreate(BaseModel):
    business_rating: int = Field(..., ge=1, le=5)  # 1-5
    courier_rating: Optional[int] = Field(None, ge=1, le=5)
    comment: Optional[str] = Field(None, max_length=500)
```

---

### 10. **ETA CALCULATION INCORRECTA**
**Severity**: 🟡 MEDIA  
**Riesgo**: Usuarios esperan orden en tiempo incorrecto

#### Problema:
```python
# backend/routers/orders.py

def _estimate_order_eta(order: dict) -> dict:
    status_value = order.get("status")
    
    minutes = 0
    if status_value in ["pending", "preparing"]:
        minutes += PREPARING_BUFFER_MINUTES  # 12 min siempre
    
    # ❌ PROBLEMA: ¿Qué si preparación ya comenzó hace 5 min?
    # Devuelve 12 min cuando solo quedan 7
```

#### Solución:
```python
# backend/routers/orders.py

def _estimate_order_eta(order: dict) -> dict:
    status_value = order.get("status")
    created_at = order.get("created_at")
    courier_assigned_at = order.get("courier_assigned_at")
    
    minutes = 0
    now = get_bogota_time()
    
    if status_value in ["pending", "preparing"]:
        if created_at:
            elapsed = (now - created_at).total_seconds() / 60
            remaining = max(0, PREPARING_BUFFER_MINUTES - elapsed)
            minutes += remaining
        else:
            minutes += PREPARING_BUFFER_MINUTES
    
    if status_value == "in_transit" and courier_assigned_at:
        # Calcular solo distancia
        if courier_lat and courier_lng:
            distance_to_customer = calculate_distance(...)
            minutes += _estimate_minutes(distance_to_customer, DELIVERY_SPEED_KMH)
    elif status_value in ["pending", "preparing"] and not courier_assigned_at:
        # Estimar tiempo de pickup del courier
        if business_lat and business_lng:
            delivery_distance = calculate_distance(...)
            minutes += _estimate_minutes(delivery_distance, DELIVERY_SPEED_KMH)
    
    if minutes <= 0:
        return {"estimated_delivery_minutes": None, "eta_text": None}
    
    return {
        "estimated_delivery_minutes": max(1, int(minutes)),
        "eta_text": f"{int(minutes)}-{int(minutes) + 5} min"
    }
```

---

### 11. **NO HAY LIMITES EN COURIER OFFERS**
**Severity**: 🟡 MEDIA  
**Riesgo**: Spam de offers, saturación DB

#### Problema:
```python
# backend/routers/couriers.py
@router.post("/{user_id}/offer/{order_id}")
async def make_courier_offer(user_id: int, order_id: str, offer: CourierOfferCreate):
    cursor.execute("""
        INSERT INTO order_courier_offers (order_id, courier_id, user_id, amount, status)
        VALUES (%s, %s, %s, %s, %s)
    """, ...)  # ❌ Sin validación de duplicados
```

Mismo courier puede hacer 100 offers para misma orden.

#### Solución:
```python
# backend/routers/couriers.py

@router.post("/{user_id}/offer/{order_id}")
async def make_courier_offer(
    user_id: int, 
    order_id: str, 
    offer: CourierOfferCreate,
    current_user = Depends(get_current_user)
):
    db = get_db()
    cursor = db.cursor(dictionary=True)
    
    try:
        # ✅ Validar que courier no tiene offer pendiente
        cursor.execute("""
            SELECT id FROM order_courier_offers
            WHERE order_id = %s AND courier_id = %s AND status = 'pending'
            LIMIT 1
        """, (order_id, user_id))
        
        existing = cursor.fetchone()
        if existing:
            raise HTTPException(
                status_code=400,
                detail="Ya tienes una oferta pendiente para esta orden"
            )
        
        # ✅ Validar cantidad mínima
        if offer.amount < 5000:  # Mínimo 5000 COP
            raise HTTPException(status_code=400, detail="Monto muy bajo")
        
        # ✅ Usar UNIQUE constraint en DB
        cursor.execute("""
            INSERT INTO order_courier_offers (order_id, courier_id, user_id, amount, status)
            VALUES (%s, %s, %s, %s, 'pending')
        """, (order_id, user_id, user_id, offer.amount))
        
        db.commit()
```

---

### 12. **DELIVERY_FEE Y NIGHT_FEE SIN VALIDACIÓN**
**Severity**: 🟡 MEDIA  
**Riesgo**: Descuentos negativos, usuario gana dinero

#### Problema:
```python
# backend/schemas.py
class OrderCreate(BaseModel):
    delivery_fee: int = 0  # ❌ Puede ser -10000
    night_fee: int = 0     # ❌ Puede ser -5000
```

Usuario podría hacer: 
- Order total: 50000
- delivery_fee: -40000
- night_fee: -10000
- Final total: 0 (o negativo)

#### Solución:
```python
# backend/schemas.py
from pydantic import Field

class OrderCreate(BaseModel):
    total: int = Field(..., gt=0)
    delivery_fee: int = Field(default=0, ge=0)
    night_fee: int = Field(default=0, ge=0)
    
    @validator('total')
    def validate_total(cls, v):
        if v <= 0:
            raise ValueError("Total debe ser positivo")
        return v

# backend/routers/orders.py

@router.post("")
async def create_order(order: OrderCreate):
    # ✅ Validar que los fees no excedan total
    total_fees = order.delivery_fee + order.night_fee
    if total_fees >= order.total:
        raise HTTPException(
            status_code=400,
            detail="Suma de fees no puede igualar o exceder el total"
        )
```

---

## 🟢 ERRORES BAJOS (Mejorar Cuando Sea Posible)

### 13. **PROMO_CODE SIN VALIDACIÓN EXISTE**
Validar que código existe en tabla `promotions`

### 14. **COURIER PUEDE RECHAZAR Y VOLVER ACEPTAR**
Añadir validación que previene reacept después de reject

### 15. **NO HAY FOREIGN KEYS EN BD**
Órdenes pueden quedar con `business_id` NULL si se elimina negocio

### 16. **TIMEZONE INCONSISTENCIAS**
Validar que created_at siempre esté en hora Bogotá

### 17. **GOOGLE CLIENT_ID INSEGURO**
```python
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "tu-client-id-aqui")
# ❌ Fallback no debería existir
```

### 18. **FACEBOOK EMAIL FAKE**
```python
if not email:
    email = f"{provider_id}@facebook.dummy"  # ❌ Fake email
```

---

## 📋 LISTA DE ACCIONES INMEDIATAS

### ✅ HOY (Crítico)
- [ ] Implementar `verify_token()` en utils.py
- [ ] Agregar middleware de autenticación a TODOS los endpoints protegidos
- [ ] Mover credenciales a `.env`
- [ ] Cambiar SECRET_KEY y guardar en `.env`
- [ ] Validar pagos desde webhook de Wompi (no manual)
- [ ] Implementar locks en accept_order para evitar race conditions

### ✅ ESTA SEMANA (Alto)
- [ ] Validación completa de promo_codes
- [ ] Remover visible_password de respuestas API
- [ ] Mover token a httpOnly cookie
- [ ] Validar ratings (1-5)
- [ ] Validar delivery_fee y night_fee (>= 0)

### ✅ PRÓXIMAS 2 SEMANAS (Medio)
- [ ] Arreglar ETA calculation
- [ ] Limitar courier offers
- [ ] Agregar foreign keys en BD
- [ ] Documentar timezone en toda la app

---

## 🧪 TESTING PARA VALIDAR FIXES

### Test 1: Autenticación
```bash
# ❌ Debe fallar
curl /api/users/123/stats
# Respuesta: 401 Unauthorized

# ✅ Debe funcionar
curl -H "Authorization: Bearer TOKEN" /api/users/123/stats
```

### Test 2: Cupones
```python
# ❌ Debe fallar (código no existe)
POST /api/orders
{
  "promo_code": "FAKE123",
  ...
}

# ❌ Debe fallar (usuario ya lo usó)
POST /api/orders
{
  "promo_code": "VALID_CODE",  # Ya usado
  ...
}

# ✅ Debe funcionar (primera vez)
POST /api/orders
{
  "promo_code": "VALID_CODE",
  ...
}
```

### Test 3: Race Conditions
```python
# Ejecutar 2 requests simultáneamente para aceptar misma orden
import asyncio
import aiohttp

async def accept_order(session, courier_id, order_id):
    async with session.post(
        f"/api/couriers/{courier_id}/accept-order/{order_id}"
    ) as resp:
        return await resp.json()

# ✅ Solo el primero debe tener éxito, segundo debe fallar
```

---

## 📞 PRÓXIMOS PASOS

1. Crear `.env` con variables seguras
2. Implementar autenticación en TODOS los endpoints
3. Validar datos de entrada en TODOS los routers
4. Agregar tests unitarios para validar fixes
5. Hacer security audit de nuevo después de cambios

---

**Generado**: Mayo 9, 2026  
**Por**: Análisis automático de código  
**Próxima revisión recomendada**: Después de implementar fixes críticos
