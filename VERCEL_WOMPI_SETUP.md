# Configuración de Wompi en Vercel

## 📋 Pasos para agregar las variables de Wompi a Vercel

### 1. Entra al Dashboard de Vercel

- Ve a [vercel.com](https://vercel.com)
- Inicia sesión con tu cuenta
- Selecciona tu proyecto **Fastyy**

### 2. Accede a Environment Variables

- Click en **Settings** (engranaje)
- En la barra lateral, busca **Environment Variables**
- Click en **Environment Variables**

### 3. Agrega las tres variables

Haz click en **Add New** y copia cada una:

#### Variable 1: WOMPI_PUBLIC_KEY
```
Key: WOMPI_PUBLIC_KEY
Value: (copia tu public key de Wompi)
Environments: Production, Preview, Development
```

#### Variable 2: WOMPI_PRIVATE_KEY
```
Key: WOMPI_PRIVATE_KEY
Value: (copia tu private key de Wompi)
Environments: Production, Preview, Development
```

#### Variable 3: WOMPI_EVENTS_KEY
```
Key: WOMPI_EVENTS_KEY
Value: (copia tu events key de Wompi)
Environments: Production, Preview, Development
```

#### Variable 4: FRONTEND_URL (importante)
```
Key: FRONTEND_URL
Value: https://tu-dominio.vercel.app
Environments: Production
```

### 4. Guarda los cambios

- Click en **Save**
- Vercel te dirá que necesita redeploy

### 5. Redeploy el proyecto

- Ve a **Deployments**
- Click en los 3 puntos del deploy más reciente
- Click en **Redeploy**
- Espera a que termine (muestra "Ready")

## 🔑 Dónde obtener las claves de Wompi

1. Ve a [dashboard.wompi.co](https://dashboard.wompi.co)
2. Inicia sesión con tu cuenta
3. Ve a **API Keys** o **Configuración**
4. Verás:
   - **Public Key**: Puedes exponerla en el frontend
   - **Private Key**: Mantén esto SECRETO ⚠️
   - **Events Key**: Para verificar webhooks

## ✅ Verificar que funciona

Después de redeploy:

1. Abre tu app en `https://tu-dominio.vercel.app`
2. Ve a **Checkout**
3. Selecciona **"Tarjeta"** como método de pago
4. Completa los datos y haz click en **"Confirmar y Pedir Ahora"**
5. Deberías ser redirigido al checkout de Wompi

## 🐛 Si aún no funciona

Abre la consola del navegador (**F12** → **Console**) y mira si hay mensajes de error.

### Mensajes comunes:

**"Wompi not configured"**
- Las variables no están guardadas en Vercel
- Redeploy el proyecto

**"Failed to create Wompi transaction"**
- Las claves de Wompi son incorrectas
- Verifica que copiaste correctamente desde el dashboard de Wompi

**"Referencing column 'order_id' incompatible"**
- Ejecuta la migración de base de datos
- En el servidor: `python backend/migrations/add_payments_table.py`

## 📝 Nota importante

- **NUNCA** compartas tu `WOMPI_PRIVATE_KEY` públicamente
- Las variables de Vercel son cifradas
- El redeploy puede tomar 1-2 minutos

## 🔗 URLs importantes

- Wompi Dashboard: https://dashboard.wompi.co
- Vercel Project Settings: https://vercel.com/dashboard
- Documentación Wompi: https://docs.wompi.co