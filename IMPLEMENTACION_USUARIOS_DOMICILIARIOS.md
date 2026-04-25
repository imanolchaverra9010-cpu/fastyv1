# Implementación: Creación Automática de Usuarios para Domiciliarios

## Resumen
Se ha implementado la funcionalidad de creación automática de usuarios cuando el administrador registra un nuevo domiciliario en el sistema Rapidito. Esto asegura que cada domiciliario tenga credenciales de acceso listas para usar inmediatamente después de su creación.

## Cambios Realizados

### 1. Modificación del Endpoint `POST /admin/couriers`
**Archivo:** `backend/routers/admin.py`

#### Antes
El endpoint solo creaba un registro en la tabla `couriers` sin crear un usuario asociado.

```python
@router.post("/couriers")
def create_courier(courier: dict):
    # Solo insertaba en couriers sin crear usuario
    cursor.execute(
        """INSERT INTO couriers (name, phone, vehicle, status, rating, earnings, deliveries) 
           VALUES (%s, %s, %s, %s, %s, %s, %s)""",
        (courier['name'], courier['phone'], courier['vehicle'], 'online', 5.0, 0, 0)
    )
```

#### Después
El endpoint ahora:
1. Genera credenciales automáticas (username, email, contraseña temporal)
2. Crea un usuario en la tabla `users` con role `'courier'`
3. Vincula el usuario al domiciliario mediante `user_id`
4. Devuelve las credenciales al administrador

### 2. Lógica de Generación de Credenciales

#### Username
- Se genera a partir del nombre del domiciliario (convertido a minúsculas)
- Los espacios se reemplazan con guiones bajos
- Si ya existe, se añade un sufijo numérico (ej: `juan_perez_1`)

**Ejemplo:**
- Nombre: "Juan Perez" → Username: `juan_perez`
- Nombre: "Carlos Mendez" → Username: `carlos_mendez`

#### Contraseña Temporal
- Se genera aleatoriamente con 12 caracteres
- Combina letras mayúsculas, minúsculas y números
- El domiciliario debe cambiarla en su primer acceso

**Ejemplo:** `aB3xK9mL2pQ5`

#### Email
- Formato: `{username}@rapidito-courier.local`
- Se verifica unicidad en la base de datos
- Si ya existe, se añade un sufijo numérico

**Ejemplo:** `juan_perez@rapidito-courier.local`

### 3. Flujo de Creación

```
1. Admin envía POST /admin/couriers con datos del domiciliario
   ├── name: "Juan Perez"
   ├── phone: "3105555555"
   └── vehicle: "Moto"

2. El sistema genera credenciales automáticas
   ├── username: "juan_perez"
   ├── email: "juan_perez@rapidito-courier.local"
   └── temp_password: "aB3xK9mL2pQ5"

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

5. Se devuelve respuesta con credenciales
```

### 4. Respuesta del API

**Código HTTP:** 200 OK (o 201 Created)

**Estructura de respuesta:**
```json
{
  "message": "Courier and user created successfully",
  "courier_id": 3,
  "user_id": 4,
  "credentials": {
    "username": "juan_perez",
    "email": "juan_perez@rapidito-courier.local",
    "temporary_password": "aB3xK9mL2pQ5",
    "note": "El domiciliario debe cambiar esta contraseña en su primer acceso"
  }
}
```

## Importaciones Añadidas

```python
import string        # Para generar caracteres aleatorios
import random        # Para generar contraseñas aleatorias
from utils import pwd_context  # Para hashear contraseñas con bcrypt
```

## Ventajas de esta Implementación

1. **Automatización:** Elimina el proceso manual de crear usuarios por separado
2. **Consistencia:** Garantiza que cada domiciliario tenga un usuario asociado
3. **Seguridad:** Las contraseñas se hashean con bcrypt antes de guardarse
4. **Unicidad:** Verifica que usernames y emails sean únicos
5. **Trazabilidad:** Mantiene la relación entre usuarios y domiciliarios mediante `user_id`
6. **Facilidad de acceso:** El admin recibe inmediatamente las credenciales para compartir

## Flujo de Acceso del Domiciliario

1. El admin crea el domiciliario y recibe las credenciales
2. El admin comparte las credenciales con el domiciliario
3. El domiciliario accede con `username` y `temporary_password`
4. En el primer acceso, el sistema le pide cambiar la contraseña
5. El domiciliario puede acceder a su panel con las nuevas credenciales

## Consideraciones de Seguridad

- Las contraseñas se hashean con bcrypt (algoritmo seguro)
- Las contraseñas temporales son aleatorias y de 12 caracteres
- Se recomienda implementar cambio obligatorio de contraseña en el primer acceso
- Los emails son internos (`@rapidito-courier.local`) para evitar conflictos

## Testing

Se incluye un archivo de prueba: `backend/test_courier_creation.py`

**Para ejecutar las pruebas:**
```bash
cd backend
python test_courier_creation.py
```

**Requisitos:**
- El servidor FastAPI debe estar ejecutándose en `/api`
- Tener instalado `requests`: `pip install requests`

## Cambios en la Base de Datos

No se requieren cambios en el esquema de la base de datos. La tabla `couriers` ya tiene la columna `user_id` que se utiliza para vincular con la tabla `users`.

## Próximos Pasos Recomendados

1. **Cambio obligatorio de contraseña:** Implementar un endpoint que fuerce al domiciliario a cambiar su contraseña temporal en el primer acceso
2. **Notificación:** Enviar un email o SMS al domiciliario con sus credenciales
3. **Auditoría:** Registrar quién creó cada domiciliario y cuándo
4. **Recuperación de contraseña:** Implementar un flujo de recuperación de contraseña olvidada

## Archivos Modificados

- `backend/routers/admin.py` - Endpoint de creación de domiciliarios actualizado

## Archivos Nuevos

- `backend/test_courier_creation.py` - Script de prueba para validar la funcionalidad
- `IMPLEMENTACION_USUARIOS_DOMICILIARIOS.md` - Este documento
