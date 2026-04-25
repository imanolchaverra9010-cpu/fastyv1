# Implementación: Creación de Usuarios para Domiciliarios (Versión 2)

## Resumen
Se ha implementado la funcionalidad de creación de usuarios para domiciliarios donde el **administrador asigna manualmente** el nombre de usuario y la contraseña al momento del registro. Esto permite que el admin tenga control total sobre las credenciales de acceso.

## Cambios Realizados

### 1. Modificación del Endpoint `POST /admin/couriers`
**Archivo:** `backend/routers/admin.py`

#### Estructura de la Solicitud

El endpoint ahora recibe los siguientes campos:

```json
{
  "name": "Juan Perez",
  "phone": "3105555555",
  "vehicle": "Moto",
  "username": "juan_perez",
  "password": "MiContraseña123"
}
```

#### Validaciones

El sistema realiza las siguientes validaciones:

1. **Username:**
   - No puede estar vacío
   - Debe ser único en el sistema
   - Se verifica antes de crear el usuario

2. **Contraseña:**
   - No puede estar vacía
   - Debe tener mínimo 6 caracteres
   - Se hashea con bcrypt antes de guardarse

3. **Nombre del Domiciliario:**
   - Se valida que no esté vacío
   - Se guarda exactamente como lo proporciona el admin

### 2. Flujo de Creación

```
1. Admin envía POST /admin/couriers con datos completos
   ├── name: "Juan Perez"
   ├── phone: "3105555555"
   ├── vehicle: "Moto"
   ├── username: "juan_perez"
   └── password: "MiContraseña123"

2. El sistema valida los datos
   ├── ✓ Username no está vacío
   ├── ✓ Username no existe en la BD
   ├── ✓ Contraseña no está vacía
   ├── ✓ Contraseña tiene al menos 6 caracteres
   └── ✓ Todos los campos requeridos están presentes

3. Se crea usuario en tabla 'users'
   ├── username: "juan_perez"
   ├── email: "juan_perez@rapidito-courier.local"
   ├── password_hash: (bcrypt hash de la contraseña)
   └── role: "courier"

4. Se crea domiciliario en tabla 'couriers'
   ├── user_id: (ID del usuario recién creado)
   ├── name: "Juan Perez"
   ├── phone: "3105555555"
   ├── vehicle: "Moto"
   ├── status: "online"
   ├── rating: 5.0
   ├── earnings: 0
   └── deliveries: 0

5. Se devuelve respuesta de éxito
```

### 3. Respuesta del API

**Código HTTP:** 200 OK

**Estructura de respuesta exitosa:**
```json
{
  "message": "Domiciliario y usuario creados exitosamente",
  "courier_id": 3,
  "user_id": 4,
  "data": {
    "username": "juan_perez",
    "email": "juan_perez@rapidito-courier.local",
    "name": "Juan Perez",
    "phone": "3105555555",
    "vehicle": "Moto"
  }
}
```

### 4. Manejo de Errores

El API devuelve errores descriptivos:

| Error | Código HTTP | Descripción |
|-------|-------------|-------------|
| Username vacío | 400 | "El nombre de usuario no puede estar vacío" |
| Username en uso | 400 | "El nombre de usuario 'juan_perez' ya está en uso" |
| Contraseña vacía | 400 | "La contraseña no puede estar vacía" |
| Contraseña muy corta | 400 | "La contraseña debe tener al menos 6 caracteres" |
| Error en BD | 500 | "Error al crear el domiciliario: [detalles]" |

## Cambios en el Código

### Importaciones Añadidas

```python
from pydantic import BaseModel  # Para validación de datos
```

### Schema de Validación

```python
class CourierCreateRequest(BaseModel):
    name: str
    phone: str
    vehicle: str
    username: str
    password: str
```

## Ventajas de esta Implementación

1. **Control del Admin:** El administrador decide qué credenciales asignar a cada domiciliario
2. **Facilidad de Recordar:** El admin puede crear credenciales fáciles de recordar
3. **Consistencia:** Las credenciales pueden seguir un patrón definido por la empresa
4. **Seguridad:** Las contraseñas se hashean con bcrypt, nunca se guardan en texto plano
5. **Validación:** Se validan todos los campos antes de crear el usuario
6. **Trazabilidad:** Mantiene la relación entre usuarios y domiciliarios

## Ejemplo de Uso

### Con cURL

```bash
curl -X POST http://localhost:8000/admin/couriers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Carlos Mendez",
    "phone": "3105555555",
    "vehicle": "Moto",
    "username": "carlos_mendez",
    "password": "Segura123"
  }'
```

### Con Python

```python
import requests

url = "http://localhost:8000/admin/couriers"
data = {
    "name": "Carlos Mendez",
    "phone": "3105555555",
    "vehicle": "Moto",
    "username": "carlos_mendez",
    "password": "Segura123"
}

response = requests.post(url, json=data)
print(response.json())
```

### Con JavaScript/TypeScript

```typescript
const data = {
  name: "Carlos Mendez",
  phone: "3105555555",
  vehicle: "Moto",
  username: "carlos_mendez",
  password: "Segura123"
};

const response = await fetch('http://localhost:8000/admin/couriers', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
});

const result = await response.json();
console.log(result);
```

## Consideraciones de Seguridad

1. **Hashing de Contraseñas:** Las contraseñas se hashean con bcrypt (algoritmo seguro)
2. **Validación de Entrada:** Se validan todos los campos antes de procesarlos
3. **Unicidad de Username:** Se verifica que no existan usernames duplicados
4. **Email Interno:** Los emails son internos para evitar conflictos
5. **HTTPS en Producción:** Se recomienda usar HTTPS para proteger las credenciales en tránsito

## Flujo de Acceso del Domiciliario

1. El admin crea el domiciliario con username y contraseña
2. El admin comparte las credenciales con el domiciliario
3. El domiciliario accede con su username y contraseña
4. El domiciliario puede cambiar su contraseña en su perfil

## Cambios en la Base de Datos

No se requieren cambios en el esquema de la base de datos. Se utilizan las tablas existentes:
- `users` - Para almacenar las credenciales
- `couriers` - Para almacenar los datos del domiciliario

## Próximos Pasos Recomendados

1. **Cambio de Contraseña:** Implementar endpoint para que el domiciliario cambie su contraseña
2. **Recuperación de Contraseña:** Implementar flujo de recuperación de contraseña olvidada
3. **Auditoría:** Registrar quién creó cada domiciliario y cuándo
4. **Notificación:** Enviar email o SMS con las credenciales
5. **2FA:** Implementar autenticación de dos factores para mayor seguridad

## Archivos Modificados

- `backend/routers/admin.py` - Endpoint de creación de domiciliarios actualizado

## Testing

Para probar la funcionalidad:

```bash
# 1. Iniciar el servidor backend
cd backend
uvicorn main:app --reload

# 2. En otra terminal, ejecutar el test
python test_courier_creation_v2.py
```

## Diferencias con la Versión 1

| Aspecto | Versión 1 | Versión 2 |
|--------|-----------|-----------|
| Generación de credenciales | Automática | Manual (Admin) |
| Username | Generado del nombre | Proporcionado por Admin |
| Contraseña | Generada aleatoria | Proporcionada por Admin |
| Email | Generado automático | Generado automático |
| Control | Sistema | Administrador |
| Flexibilidad | Baja | Alta |

