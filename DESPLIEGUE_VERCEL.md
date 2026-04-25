# Guía de Despliegue en Vercel - Rapidito

Este documento proporciona instrucciones paso a paso para desplegar la plataforma Rapidito en Vercel.

## Requisitos Previos

1. **Cuenta en Vercel**: Crea una cuenta en [vercel.com](https://vercel.com)
2. **Repositorio Git**: El proyecto debe estar en GitHub, GitLab o Bitbucket
3. **Base de Datos en Hostinger**: Debes tener una base de datos MySQL configurada en Hostinger
4. **Credenciales de OAuth**: Necesitas tener configuradas las credenciales de Google y Facebook

## Estructura del Proyecto

```
rapidito/
├── src/                    # Código fuente del Frontend (React/Vite)
├── public/                 # Archivos públicos
├── backend/                # Código del Backend (FastAPI)
├── api/                    # Funciones Serverless para Vercel
├── package.json            # Dependencias del Frontend
├── requirements.txt        # Dependencias del Backend
├── vercel.json             # Configuración de Vercel
├── vite.config.ts          # Configuración de Vite
└── .env.example            # Variables de entorno (ejemplo)
```

## Paso 1: Preparar la Base de Datos en Hostinger

1. Accede a tu panel de control de Hostinger
2. Crea una base de datos MySQL (si no la tienes)
3. Crea un usuario con permisos en esa base de datos
4. Anota los siguientes datos:
   - **Host**: (ej: mysql.hostinger.com)
   - **Usuario**: (ej: u123456_rapidito)
   - **Contraseña**: (la que configuraste)
   - **Nombre de BD**: (ej: u123456_rapidito)
   - **Puerto**: 3306 (por defecto)

5. Ejecuta el script SQL en tu base de datos:
   ```bash
   # Descarga el archivo schema.sql del backend
   # Luego ejecuta en Hostinger o con un cliente MySQL
   mysql -h HOST -u USUARIO -p NOMBRE_BD < backend/schema.sql
   ```

## Paso 2: Configurar el Repositorio Git

1. Asegúrate de que el proyecto esté en un repositorio Git
2. Sube el código a GitHub (o GitLab/Bitbucket):
   ```bash
   git add .
   git commit -m "Preparar para despliegue en Vercel"
   git push origin main
   ```

## Paso 3: Conectar Vercel a tu Repositorio

1. Accede a [vercel.com](https://vercel.com)
2. Haz clic en "New Project"
3. Selecciona tu repositorio (GitHub/GitLab/Bitbucket)
4. Vercel debería detectar automáticamente que es un proyecto Vite
5. Haz clic en "Deploy"

## Paso 4: Configurar Variables de Entorno en Vercel

Después del despliegue inicial, debes agregar las variables de entorno:

1. Ve a tu proyecto en Vercel
2. Haz clic en "Settings" → "Environment Variables"
3. Agrega las siguientes variables:

### Variables del Frontend
```
VITE_GOOGLE_CLIENT_ID = tu_google_client_id_aqui
VITE_FACEBOOK_APP_ID = tu_facebook_app_id_aqui
```

### Variables del Backend (Base de Datos)
```
DATABASE_HOST = tu_host_hostinger_aqui
DATABASE_USER = tu_usuario_hostinger_aqui
DATABASE_PASSWORD = tu_contraseña_hostinger_aqui
DATABASE_NAME = rapidito
DATABASE_PORT = 3306
```

4. Haz clic en "Save"
5. Ve a "Deployments" y haz clic en "Redeploy" para aplicar los cambios

## Paso 5: Verificar el Despliegue

1. Espera a que se complete el despliegue (verás un estado "Ready")
2. Haz clic en el enlace de tu dominio (ej: https://rapidito.vercel.app)
3. Verifica que:
   - El frontend carga correctamente
   - Puedes acceder a la API en `/api/` (debería mostrar documentación Swagger)
   - Puedes hacer login con Google/Facebook

## Paso 6: Configurar Dominio Personalizado (Opcional)

1. En Vercel, ve a "Settings" → "Domains"
2. Agrega tu dominio personalizado
3. Sigue las instrucciones para configurar los registros DNS

## Notas Importantes

### WebSockets
Los WebSockets **no funcionan** en Vercel Serverless Functions. Si necesitas funcionalidad en tiempo real (notificaciones, actualizaciones en vivo), considera:

- **Pusher** (https://pusher.com) - Recomendado
- **Ably** (https://ably.io)
- **Firebase Realtime Database**

### Límites de Vercel
- Máximo 10 segundos por solicitud (timeout)
- Máximo 50MB de tamaño de función
- Las funciones serverless se ejecutan bajo demanda

### Archivos Estáticos
Los archivos estáticos (imágenes, CSS, JS) se sirven desde el CDN de Vercel automáticamente.

## Troubleshooting

### Error: "Cannot find module"
- Verifica que todas las dependencias estén en `requirements.txt`
- Asegúrate de que los imports en Python sean correctos

### Error: "Database connection failed"
- Verifica que las credenciales de la base de datos sean correctas
- Asegúrate de que Hostinger permite conexiones remotas
- Comprueba que la IP de Vercel está en la lista blanca (si aplica)

### Error: "CORS error"
- Las CORS ya están configuradas en el backend
- Si persiste, verifica que el frontend esté haciendo requests a `/api/`

### El frontend no carga
- Verifica que `npm run build` funciona localmente
- Revisa los logs en Vercel: "Deployments" → "Build Logs"

## Comandos Útiles

```bash
# Instalar dependencias
npm install
pip install -r requirements.txt

# Construir localmente
npm run build

# Ver los logs de Vercel
vercel logs

# Redeploy
vercel --prod
```

## Soporte

Para más información sobre Vercel, consulta:
- [Documentación de Vercel](https://vercel.com/docs)
- [FastAPI en Vercel](https://vercel.com/docs/serverless-functions/supported-languages#python)
- [Vite en Vercel](https://vercel.com/docs/frameworks/vite)

## Próximos Pasos

1. Configura un dominio personalizado
2. Implementa un sistema de notificaciones en tiempo real (Pusher/Ably)
3. Configura monitoreo y alertas
4. Implementa CI/CD automático con GitHub Actions
