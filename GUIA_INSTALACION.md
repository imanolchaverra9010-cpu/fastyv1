# Guía de Instalación y Configuración

## Requisitos Previos

- Python 3.8+
- MySQL 5.7+ o MariaDB
- Node.js 14+ (para el frontend)
- pip (gestor de paquetes de Python)

## Paso 1: Configurar el Backend

### 1.1 Instalar dependencias

```bash
cd backend
pip install -r requirements.txt
```

**Dependencias principales:**
- `fastapi` - Framework web
- `uvicorn` - Servidor ASGI
- `mysql-connector-python` - Conector MySQL
- `passlib` - Hashing de contraseñas
- `python-jose` - JWT tokens
- `pydantic` - Validación de datos

### 1.2 Configurar la base de datos

1. Crear la base de datos:
```bash
mysql -u root -p < schema.sql
```

2. Verificar que las tablas se crearon correctamente:
```bash
mysql -u root -p
USE rapidito;
SHOW TABLES;
DESC users;
DESC couriers;
```

### 1.3 Configurar variables de entorno

Crear un archivo `.env` en la carpeta `backend`:

```env
# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=rapidito

# JWT
SECRET_KEY=your-secret-key-change-it-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Server
SERVER_HOST=0.0.0.0
SERVER_PORT=8000
```

### 1.4 Iniciar el servidor backend

```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

El servidor estará disponible en: `/api`

**Documentación interactiva:** `/api/docs`

## Paso 2: Configurar el Frontend

### 2.1 Instalar dependencias

```bash
cd ..
npm install
# o
pnpm install
```

### 2.2 Configurar variables de entorno

Crear un archivo `.env.local` en la raíz del proyecto:

```env
VITE_API_URL=/api
VITE_APP_NAME=Rapidito
```

### 2.3 Iniciar el servidor frontend

```bash
npm run dev
# o
pnpm dev
```

El frontend estará disponible en: `http://localhost:5173`

## Paso 3: Probar la Funcionalidad

### 3.1 Acceder al sistema

1. Abre `http://localhost:5173` en tu navegador
2. Inicia sesión con las credenciales de admin:
   - **Email:** admin@rapidito.com
   - **Contraseña:** (la que esté en la BD)

### 3.2 Crear un domiciliario

1. Ve al panel de administración
2. Haz clic en "Crear Domiciliario"
3. Completa el formulario:
   - Nombre: "Juan Perez"
   - Teléfono: "3105555555"
   - Vehículo: "Moto"
4. Haz clic en "Crear"
5. Recibirás las credenciales automáticas

### 3.3 Probar con cURL

```bash
curl -X POST /api/admin/couriers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Carlos Mendez",
    "phone": "3105555555",
    "vehicle": "Moto"
  }'
```

**Respuesta esperada:**
```json
{
  "message": "Courier and user created successfully",
  "courier_id": 3,
  "user_id": 4,
  "credentials": {
    "username": "carlos_mendez",
    "email": "carlos_mendez@rapidito-courier.local",
    "temporary_password": "aB3xK9mL2pQ5",
    "note": "El domiciliario debe cambiar esta contraseña en su primer acceso"
  }
}
```

### 3.4 Ejecutar pruebas

```bash
cd backend
python test_courier_creation.py
```

## Paso 4: Verificar la Base de Datos

Después de crear un domiciliario, verifica que se crearon los registros:

```bash
mysql -u root -p
USE rapidito;

# Ver usuarios creados
SELECT * FROM users WHERE role = 'courier';

# Ver domiciliarios creados
SELECT * FROM couriers;

# Ver la relación entre usuarios y domiciliarios
SELECT u.id, u.username, u.email, c.name, c.phone 
FROM users u 
JOIN couriers c ON u.id = c.user_id 
WHERE u.role = 'courier';
```

## Solución de Problemas

### Error: "Database connection failed"

**Solución:**
1. Verifica que MySQL está ejecutándose
2. Comprueba las credenciales en `database.py`
3. Asegúrate de que la base de datos existe

```bash
mysql -u root -p -e "USE rapidito; SELECT 1;"
```

### Error: "Module not found: passlib"

**Solución:**
```bash
pip install passlib python-jose
```

### Error: "CORS error" en el frontend

**Solución:**
Asegúrate de que el backend tiene CORS habilitado en `main.py`:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En producción, especificar dominios
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Error: "Contraseña hash inválida"

**Solución:**
1. Verifica que las contraseñas en la BD están correctamente hasheadas
2. Ejecuta el script de reparación:
```bash
python repair_db.py
```

## Estructura de Carpetas

```
rapidito/
├── backend/
│   ├── routers/
│   │   ├── admin.py          # ✅ MODIFICADO - Creación de domiciliarios
│   │   ├── auth.py
│   │   ├── businesses.py
│   │   ├── couriers.py
│   │   ├── menu_items.py
│   │   └── orders.py
│   ├── database.py
│   ├── main.py
│   ├── schemas.py
│   ├── utils.py
│   ├── requirements.txt
│   ├── schema.sql
│   ├── test_courier_creation.py  # ✅ NUEVO - Script de prueba
│   └── ...
├── src/
│   ├── components/
│   ├── pages/
│   ├── services/
│   └── ...
├── IMPLEMENTACION_USUARIOS_DOMICILIARIOS.md  # ✅ NUEVO
├── EJEMPLO_INTEGRACION_FRONTEND.md           # ✅ NUEVO
├── GUIA_INSTALACION.md                       # ✅ NUEVO (Este archivo)
└── ...
```

## Próximos Pasos

1. **Implementar cambio de contraseña obligatorio** en el primer acceso
2. **Enviar credenciales por email** automáticamente
3. **Agregar auditoría** de quién creó cada domiciliario
4. **Implementar recuperación de contraseña**
5. **Agregar 2FA** para mayor seguridad

## Contacto y Soporte

Para reportar problemas o sugerencias, contacta al equipo de desarrollo.

---

**Última actualización:** Abril 2026
**Versión:** 1.0
