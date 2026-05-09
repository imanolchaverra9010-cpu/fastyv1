# 🔧 FIXES ESPECÍFICOS - Copy/Paste Ready Code

## Error #1: Autenticación Ausente

### Step 1: Crear .env
```
# .env (CREAR EN ROOT DEL PROYECTO)
DATABASE_HOST=switchback.proxy.rlwy.net
DATABASE_USER=root
DATABASE_PASSWORD=tu-nueva-password-aqui
DATABASE_NAME=railway
DATABASE_PORT=46587

SECRET_KEY=tu-secret-key-super-seguro-aqui-generado-con-secrets

GOOGLE_CLIENT_ID=tu-google-client-id
WOMPI_PUBLIC_KEY=tu-public-key
WOMPI_PRIVATE_KEY=tu-private-key
WOMPI_EVENTS_KEY=tu-events-key

ENV=production
FRONTEND_URL=https://tudominio.com
```

### Step 2: Actualizar backend/utils.py

**REEMPLAZAR**:
```python
SECRET_KEY = "your-secret-key-change-it-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
```

**CON**:
```python
import os
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY or SECRET_KEY == "your-secret-key-change-it-in-production":
    raise ValueError("❌ SECRET_KEY no configurada o insegura. Configurar en .env")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
```

### Step 3: Agregar funciones de verificación en backend/utils.py

**AGREGAR AL FINAL DEL ARCHIVO**:
```python
# ============= AUTENTICACIÓN =============
from fastapi.security import HTTPBearer, HTTPAuthCredentials
from fastapi import Depends

security = HTTPBearer()

def verify_token(token: str):
    """Validar JWT token"""
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

async def get_current_user(credentials: HTTPAuthCredentials = Depends(security)):
    """Obtener usuario actual desde token"""
    token = credentials.credentials
    email = verify_token(token)
    
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT id, role, email, username FROM users WHERE email = %s", (email,))
        user = cursor.fetchone()
        if not user:
            raise HTTPException(status_code=401, detail="Usuario no encontrado")
        return user
    finally:
        cursor.close()
        db.close()
```

### Step 4: Actualizar backend/database.py

**REEMPLAZAR**:
```python
db_config = {
    "host": os.getenv("DATABASE_HOST", "switchback.proxy.rlwy.net"),
    "user": os.getenv("DATABASE_USER", "root"),
    "password": os.getenv("DATABASE_PASSWORD", "OyDRGvdWqQwOLiknRFLmFFdhPOVuwgws"),
    ...
}
```

**CON**:
```python
import os
from dotenv import load_dotenv

load_dotenv()

# Validar que variables de entorno existan
REQUIRED_ENV_VARS = ["DATABASE_HOST", "DATABASE_USER", "DATABASE_PASSWORD", "DATABASE_NAME"]
for var in REQUIRED_ENV_VARS:
    if not os.getenv(var):
        raise ValueError(f"❌ Variable de entorno {var} no configurada")

db_config = {
    "host": os.getenv("DATABASE_HOST"),
    "user": os.getenv("DATABASE_USER"),
    "password": os.getenv("DATABASE_PASSWORD"),
    "database": os.getenv("DATABASE_NAME"),
    "port": int(os.getenv("DATABASE_PORT", "3306")),
    "ssl_disabled": False,
    "ssl_verify_cert": False,
    "ssl_verify_identity": False,
    "connect_timeout": 5,
    "charset": "utf8mb4",
    "collation": "utf8mb4_general_ci",
    "use_unicode": True,
}
```

### Step 5: Actualizar endpoints protegidos

**EJEMPLO - backend/routers/orders.py**

**REEMPLAZAR**:
```python
@router.get("/{order_id}", response_model=OrderDetailResponse)
def get_order(order_id: str):
    db = get_db()
    ...
```

**CON**:
```python
from utils import get_current_user  # AGREGAR IMPORT

@router.get("/{order_id}", response_model=OrderDetailResponse)
async def get_order(order_id: str, current_user = Depends(get_current_user)):
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM orders WHERE id = %s", (order_id,))
        order = cursor.fetchone()
        
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        
        # ✅ AGREGAR VALIDACIÓN DE PERMISOS
        # Un usuario customer solo puede ver sus propias órdenes
        # Un courier solo puede ver órdenes asignadas a él
        # Admin puede ver todas
        if current_user['role'] == 'customer':
            if order['user_id'] != current_user['id']:
                raise HTTPException(status_code=403, detail="No tienes permiso")
        elif current_user['role'] == 'courier':
            if order['courier_id'] != current_user['id']:
                raise HTTPException(status_code=403, detail="No tienes permiso")
        
        # ... resto del código
```

---

## Error #2: Cupones Reutilizables

### Arreglo completo en backend/routers/orders.py

**AGREGAR FUNCIÓN**:
```python
async def validate_and_register_promo_code(cursor, db, promo_code: str, user_id: int):
    """
    Validar que promo_code es válido y puede usarse
    Retorna (codigo, descuento_porcentaje) o lanza HTTPException
    """
    
    if not promo_code:
        return None, 0
    
    promo_code = promo_code.strip().upper()
    
    # 1. Verificar que existe y está activo
    cursor.execute("""
        SELECT id, discount_percentage, max_uses, expiry_date
        FROM promotions
        WHERE code = %s AND status = 'active'
    """, (promo_code,))
    promo = cursor.fetchone()
    
    if not promo:
        raise HTTPException(status_code=400, detail="Código de promoción inválido o no activo")
    
    # 2. Verificar que no ha expirado
    from datetime import datetime
    if promo['expiry_date'] and promo['expiry_date'] < datetime.now().date():
        raise HTTPException(status_code=400, detail="Código de promoción expirado")
    
    # 3. Verificar que el usuario no lo ha usado antes (CRÍTICO)
    cursor.execute("""
        SELECT COUNT(*) as uses
        FROM used_coupons
        WHERE user_id = %s AND code = %s
    """, (user_id, promo_code))
    result = cursor.fetchone()
    if result['uses'] > 0:
        raise HTTPException(status_code=400, detail="Ya usaste este código de promoción")
    
    # 4. Verificar que no se ha alcanzado el límite de usos global
    if promo['max_uses']:
        cursor.execute("""
            SELECT COUNT(*) as total_uses
            FROM used_coupons
            WHERE code = %s
        """, (promo_code,))
        result = cursor.fetchone()
        if result['total_uses'] >= promo['max_uses']:
            raise HTTPException(status_code=400, detail="Código de promoción agotado")
    
    return promo_code, promo['discount_percentage']

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_order(order: OrderCreate, background_tasks: BackgroundTasks):
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = db.cursor(dictionary=True)
    
    try:
        # ✅ VALIDAR CUPÓN ANTES DE CREAR ORDEN
        promo_code, discount_pct = await validate_and_register_promo_code(
            cursor, db, order.promo_code, order.user_id or 0
        )
        
        # Calcular descuento
        discount_amount = int(order.total * discount_pct / 100) if discount_pct else 0
        final_total = max(0, order.total - discount_amount)
        
        # Crear orden
        order_id = str(uuid.uuid4())[:8]
        cursor.execute("""
            INSERT INTO orders (
                id, business_id, user_id, customer_name, customer_phone,
                delivery_address, payment_method, notes, total,
                latitude, longitude, status, promo_code, discount_amount,
                order_type, origin_name, origin_address, origin_latitude,
                origin_longitude, open_order_description, batch_id,
                delivery_fee, night_fee
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
        """, (
            order_id, order.business_id, order.user_id, order.customer_name,
            order.customer_phone, order.delivery_address, payment_method,
            order.notes, final_total, order.latitude, order.longitude,
            initial_status, promo_code, discount_amount,
            order.order_type, order.origin_name, order.origin_address,
            order.origin_latitude, order.origin_longitude,
            order.open_order_description, order.batch_id,
            order.delivery_fee, order.night_fee
        ))
        
        # Insertar items
        for item in order.items:
            cursor.execute("""
                INSERT INTO order_items (order_id, name, price, quantity, emoji)
                VALUES (%s, %s, %s, %s, %s)
            """, (order_id, item.name, item.price, item.quantity, item.emoji))
        
        # ✅ SOLO DESPUÉS de crear orden, registrar uso del cupón
        if promo_code and order.user_id:
            cursor.execute("""
                INSERT INTO used_coupons (user_id, code, created_at)
                VALUES (%s, %s, %s)
            """, (order.user_id, promo_code, get_bogota_time()))
        
        db.commit()
        return {"order_id": order_id, "total": final_total}
        
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()
```

---

## Error #3: Race Conditions en Accept Order

### Reemplazar en backend/routers/couriers.py

```python
@router.post("/{user_id}/accept-order/{order_id}")
async def accept_order(
    user_id: int,
    order_id: str,
    background_tasks: BackgroundTasks,
    current_user = Depends(get_current_user)  # ← AGREGAR
):
    db = get_db()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = db.cursor(dictionary=True)
    
    try:
        # ✅ INICIAR TRANSACCIÓN
        db.start_transaction()
        
        # ✅ USAR FOR UPDATE PARA LOCK EXCLUSIVO
        cursor.execute("""
            SELECT id, status, courier_id FROM orders WHERE id = %s FOR UPDATE
        """, (order_id,))
        order = cursor.fetchone()
        
        if not order:
            db.rollback()
            raise HTTPException(status_code=404, detail="Orden no encontrada")
        
        # ✅ VALIDAR QUE NO TENGA COURIER YA ASIGNADO
        if order['courier_id'] is not None:
            db.rollback()
            raise HTTPException(
                status_code=400,
                detail="Esta orden ya fue aceptada por otro domiciliario"
            )
        
        # ✅ VALIDAR QUE COURIER ESTÉ ONLINE
        cursor.execute("""
            SELECT id, status FROM couriers WHERE user_id = %s
        """, (user_id,))
        courier = cursor.fetchone()
        
        if not courier:
            db.rollback()
            raise HTTPException(status_code=404, detail="Courier no encontrado")
        
        if courier['status'] != 'online':
            db.rollback()
            raise HTTPException(
                status_code=400,
                detail="Debes estar online para aceptar órdenes"
            )
        
        # ✅ VALIDAR QUE NO ESTÉ EN EL ESTADO EQUIVOCADO
        if order['status'] not in ['pending', 'preparing', 'ready']:
            db.rollback()
            raise HTTPException(
                status_code=400,
                detail=f"No puedes aceptar una orden en estado {order['status']}"
            )
        
        # ✅ ACTUALIZAR CON LOCK MANTENIDO
        now = get_bogota_time()
        cursor.execute("""
            UPDATE orders
            SET courier_id = %s, status = %s, updated_at = %s
            WHERE id = %s
        """, (user_id, 'shipped', now, order_id))
        
        # ✅ REGISTRAR EN LOGS
        cursor.execute("""
            INSERT INTO order_status_logs (order_id, status, created_at)
            VALUES (%s, %s, %s)
        """, (order_id, 'shipped', now))
        
        # ✅ COMMIT LIBERA EL LOCK
        db.commit()
        
        # Notificar fuera de transacción
        background_tasks.add_task(notify_courier_assigned, order_id, user_id)
        background_tasks.add_task(notify_business_courier_assigned, order_id)
        
        return {
            "message": "Orden aceptada exitosamente",
            "order_id": order_id,
            "status": "shipped"
        }
        
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

## Error #4: Pagos sin Validación

### Actualizar backend/routers/payments.py

```python
@router.post("/webhook")
async def wompi_webhook(request: Request, background_tasks: BackgroundTasks):
    """Procesar webhook de Wompi - ÚNICA FUENTE DE VERDAD"""
    try:
        body = await request.body()
        payload = body.decode('utf-8')
        
        # ✅ VALIDAR FIRMA DEL WEBHOOK
        signature = request.headers.get('X-Wompi-Signature')
        if signature and not verify_wompi_signature(payload, signature):
            raise HTTPException(status_code=401, detail="Invalid signature")
        
        webhook_data = json.loads(payload)
        event = webhook_data.get('event')
        transaction_data = webhook_data.get('data', {})
        
        db = get_db()
        if not db:
            raise HTTPException(status_code=500, detail="Database connection failed")
        
        cursor = db.cursor(dictionary=True)
        
        try:
            db.start_transaction()
            
            # ✅ PROCESAR SOLO transaction.updated
            if event == 'transaction.updated':
                transaction_id = transaction_data.get('id')
                status = transaction_data.get('status')  # APPROVED, DECLINED, PENDING
                reference = transaction_data.get('reference')
                
                # Obtener pago
                cursor.execute("""
                    SELECT order_id FROM payments WHERE reference = %s
                """, (reference,))
                payment_record = cursor.fetchone()
                
                if payment_record:
                    order_id = payment_record['order_id']
                    
                    # ✅ VALIDAR QUE ORDEN ESTÁ EN ESTADO CORRECTO
                    cursor.execute("""
                        SELECT status FROM orders WHERE id = %s FOR UPDATE
                    """, (order_id,))
                    order = cursor.fetchone()
                    
                    if status == 'APPROVED':
                        # ✅ ACTUALIZAR PAGO
                        cursor.execute("""
                            UPDATE payments
                            SET status = 'APPROVED', transaction_id = %s, updated_at = %s
                            WHERE reference = %s
                        """, (transaction_id, get_bogota_time(), reference))
                        
                        # ✅ CAMBIAR ORDEN A CONFIRMADA (SOLO SI VINO DE WEBHOOK)
                        if order and order['status'] == 'pending_payment':
                            cursor.execute("""
                                UPDATE orders
                                SET status = 'confirmed', updated_at = %s
                                WHERE id = %s
                            """, (get_bogota_time(), order_id))
                            
                            # Log
                            cursor.execute("""
                                INSERT INTO order_status_logs (order_id, status, created_at)
                                VALUES (%s, %s, %s)
                            """, (order_id, 'confirmed', get_bogota_time()))
                            
                            # Notificar
                            background_tasks.add_task(notify_order_confirmed, order_id)
                            background_tasks.add_task(notify_business_new_order, order_id)
                    
                    elif status == 'DECLINED':
                        # ✅ RECHAZADO
                        cursor.execute("""
                            UPDATE payments
                            SET status = 'DECLINED', transaction_id = %s
                            WHERE reference = %s
                        """, (transaction_id, reference))
                        
                        # Notificar al usuario
                        background_tasks.add_task(notify_payment_failed, order_id)
            
            db.commit()
        
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=str(e))
        finally:
            cursor.close()
            db.close()
        
        return {"status": "ok"}
        
    except HTTPException:
        raise
    except Exception as e:
        return {"error": str(e)}, 400
```

Y PROHIBIR cambios manuales de orden:
```python
@router.patch("/{order_id}/status")
async def update_order_status(
    order_id: str,
    status_update: StatusUpdate,
    current_user = Depends(get_current_user),
    background_tasks: BackgroundTasks
):
    """❌ NO PERMITIR CAMBIO MANUAL A 'confirmed' SI NO VIENE DE PAGO"""
    db = get_db()
    if not db:
        raise HTTPException(status_code=500)
    
    cursor = db.cursor(dictionary=True)
    
    try:
        db.start_transaction()
        
        cursor.execute("""
            SELECT status, business_id FROM orders WHERE id = %s FOR UPDATE
        """, (order_id,))
        order = cursor.fetchone()
        
        if not order:
            db.rollback()
            raise HTTPException(status_code=404)
        
        # ✅ PROHIBIR CAMBIO A 'confirmed' (SOLO WEBHOOK)
        if status_update.status == 'confirmed':
            db.rollback()
            raise HTTPException(
                status_code=400,
                detail="El estado 'confirmed' solo se puede establecer mediante pago"
            )
        
        # Actualizar
        cursor.execute("""
            UPDATE orders SET status = %s WHERE id = %s
        """, (status_update.status, order_id))
        
        db.commit()
        return {"message": "Estado actualizado"}
        
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

## Error #5: Validación de Ratings

### Actualizar backend/schemas.py

```python
from pydantic import Field, validator

class OrderRatingCreate(BaseModel):
    business_rating: int = Field(..., ge=1, le=5, description="Calificación 1-5")
    courier_rating: Optional[int] = Field(None, ge=1, le=5, description="Calificación 1-5")
    comment: Optional[str] = Field(None, max_length=500, description="Comentario opcional")
    
    @validator('business_rating', 'courier_rating')
    def validate_rating(cls, v):
        if v is not None and (v < 1 or v > 5):
            raise ValueError('Calificación debe ser entre 1 y 5')
        return v
```

---

## Error #6: Validación de Fees

### Actualizar backend/schemas.py

```python
from pydantic import validator

class OrderCreate(BaseModel):
    business_id: Optional[str] = None
    user_id: Optional[int] = None
    customer_name: str
    total: int = Field(..., gt=0, description="Total debe ser > 0")
    delivery_fee: int = Field(default=0, ge=0, description="Domicilio >= 0")
    night_fee: int = Field(default=0, ge=0, description="Cuota nocturna >= 0")
    
    @validator('total')
    def validate_total(cls, v):
        if v <= 0:
            raise ValueError('Total debe ser positivo')
        return v
    
    @validator('delivery_fee', 'night_fee')
    def validate_fees(cls, v):
        if v < 0:
            raise ValueError('Fees no pueden ser negativos')
        return v
```

---

## .gitignore - AGREGAR

```
# .gitignore
.env
.env.local
.env.*.local
__pycache__/
*.py[cod]
*$py.class
.vscode/
.idea/
node_modules/
dist/
build/
*.egg-info/
.pytest_cache/
```

---

## requirements.txt - AGREGAR

Asegurar que tienes:
```
fastapi>=0.100
uvicorn>=0.23
python-jose[cryptography]>=3.3.0
passlib[bcrypt]>=1.7.4
bcrypt>=4.0.0
python-dotenv>=1.0.0
mysql-connector-python>=8.0.33
slowapi>=0.1.8
```

```bash
pip install -r requirements.txt
```

---

## 🚀 RESUMEN DE CAMBIOS

1. ✅ Crear `.env` con variables seguras
2. ✅ Actualizar `utils.py` con autenticación
3. ✅ Actualizar `database.py` para usar `.env`
4. ✅ Agregar `Depends(get_current_user)` a endpoints protegidos
5. ✅ Validar cupones antes de crear orden
6. ✅ Usar `FOR UPDATE` en race conditions
7. ✅ Validar pagos SOLO desde webhook
8. ✅ Validar ratings 1-5
9. ✅ Validar fees >= 0

**Total**: ~4-6 horas para implementar todos los fixes
