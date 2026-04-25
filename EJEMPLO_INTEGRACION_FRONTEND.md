# Ejemplo de Integración en el Frontend

## Cómo usar el nuevo endpoint en el frontend

### 1. Función para crear un domiciliario

```typescript
// services/courierService.ts

interface CourierData {
  name: string;
  phone: string;
  vehicle: string;
}

interface CourierResponse {
  message: string;
  courier_id: number;
  user_id: number;
  credentials: {
    username: string;
    email: string;
    temporary_password: string;
    note: string;
  };
}

export async function createCourierWithUser(
  courierData: CourierData
): Promise<CourierResponse> {
  const response = await fetch('/api/admin/couriers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}` // Token del admin
    },
    body: JSON.stringify(courierData)
  });

  if (!response.ok) {
    throw new Error(`Error creating courier: ${response.statusText}`);
  }

  return response.json();
}
```

### 2. Componente de formulario para crear domiciliarios

```tsx
// components/CreateCourierForm.tsx

import React, { useState } from 'react';
import { createCourierWithUser } from '@/services/courierService';

export function CreateCourierForm() {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    vehicle: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [credentials, setCredentials] = useState(null);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await createCourierWithUser(formData);
      
      // Mostrar las credenciales generadas
      setCredentials(response.credentials);
      
      // Limpiar formulario
      setFormData({ name: '', phone: '', vehicle: '' });
      
      // Mostrar mensaje de éxito
      alert(`✅ Domiciliario creado exitosamente!\n\nCredenciales:\nUsername: ${response.credentials.username}\nContraseña: ${response.credentials.temporary_password}`);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-6">Crear Nuevo Domiciliario</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Nombre Completo</label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            placeholder="Juan Perez"
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Teléfono</label>
          <input
            type="tel"
            required
            value={formData.phone}
            onChange={(e) => setFormData({...formData, phone: e.target.value})}
            placeholder="3105555555"
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Vehículo</label>
          <select
            required
            value={formData.vehicle}
            onChange={(e) => setFormData({...formData, vehicle: e.target.value})}
            className="w-full px-3 py-2 border rounded-md"
          >
            <option value="">Seleccionar vehículo</option>
            <option value="Moto">Moto</option>
            <option value="Bicicleta">Bicicleta</option>
            <option value="Auto">Auto</option>
            <option value="Scooter">Scooter</option>
          </select>
        </div>

        {error && (
          <div className="p-3 bg-red-100 text-red-700 rounded-md">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? 'Creando...' : 'Crear Domiciliario'}
        </button>
      </form>

      {credentials && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-md">
          <h3 className="font-bold text-green-800 mb-3">✅ Credenciales Generadas</h3>
          <div className="space-y-2 text-sm">
            <p><strong>Username:</strong> {credentials.username}</p>
            <p><strong>Email:</strong> {credentials.email}</p>
            <p><strong>Contraseña Temporal:</strong> {credentials.temporary_password}</p>
            <p className="text-xs text-gray-600 mt-2">{credentials.note}</p>
          </div>
          <button
            onClick={() => {
              const text = `Username: ${credentials.username}\nContraseña: ${credentials.temporary_password}`;
              navigator.clipboard.writeText(text);
              alert('Credenciales copiadas al portapapeles');
            }}
            className="mt-3 w-full bg-green-600 text-white py-1 rounded text-sm hover:bg-green-700"
          >
            Copiar Credenciales
          </button>
        </div>
      )}
    </div>
  );
}
```

### 3. Integración en la página de administración

```tsx
// pages/AdminDashboard.tsx

import { CreateCourierForm } from '@/components/CreateCourierForm';
import { CouriersList } from '@/components/CouriersList';

export function AdminDashboard() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-8">
      {/* Panel de creación */}
      <div>
        <CreateCourierForm />
      </div>

      {/* Lista de domiciliarios */}
      <div>
        <CouriersList />
      </div>
    </div>
  );
}
```

### 4. Manejo de errores

```typescript
// services/courierService.ts

export async function createCourierWithUser(
  courierData: CourierData
): Promise<CourierResponse> {
  try {
    const response = await fetch('/api/admin/couriers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify(courierData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Error al crear domiciliario');
    }

    return response.json();
  } catch (error) {
    console.error('Error creating courier:', error);
    throw error;
  }
}
```

### 5. Validación en el frontend

```typescript
// utils/validation.ts

export function validateCourierData(data: CourierData): string[] {
  const errors: string[] = [];

  if (!data.name || data.name.trim().length < 3) {
    errors.push('El nombre debe tener al menos 3 caracteres');
  }

  if (!data.phone || !/^\d{10}$/.test(data.phone.replace(/\D/g, ''))) {
    errors.push('El teléfono debe ser válido');
  }

  if (!data.vehicle) {
    errors.push('Debe seleccionar un vehículo');
  }

  return errors;
}
```

## Flujo Completo en el Frontend

1. **Admin accede al panel de administración**
2. **Completa el formulario con datos del domiciliario**
   - Nombre completo
   - Teléfono
   - Tipo de vehículo

3. **Hace clic en "Crear Domiciliario"**

4. **El sistema:**
   - Valida los datos en el frontend
   - Envía la solicitud al backend
   - Recibe las credenciales generadas

5. **Se muestran las credenciales al admin:**
   - Username
   - Contraseña temporal
   - Email (para referencia)
   - Nota sobre cambio de contraseña

6. **El admin puede:**
   - Copiar las credenciales
   - Compartirlas con el domiciliario por email, SMS o WhatsApp
   - Guardarlas en un documento seguro

## Mejoras Opcionales

### 1. Envío automático de credenciales por email

```typescript
// services/emailService.ts

export async function sendCredentialsEmail(
  email: string,
  credentials: CourierCredentials
) {
  await fetch('/api/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: email,
      subject: 'Tus credenciales de acceso - Rapidito',
      template: 'courier_credentials',
      data: credentials
    })
  });
}
```

### 2. Descarga de credenciales como PDF

```typescript
// utils/downloadCredentials.ts

export function downloadCredentialsAsPDF(credentials: CourierCredentials) {
  const doc = new jsPDF();
  doc.text('Credenciales de Acceso - Rapidito', 10, 10);
  doc.text(`Username: ${credentials.username}`, 10, 30);
  doc.text(`Contraseña: ${credentials.temporary_password}`, 10, 40);
  doc.save('credenciales.pdf');
}
```

### 3. Historial de domiciliarios creados

```tsx
// components/CourierHistory.tsx

export function CourierHistory() {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    fetch('/api/admin/couriers')
      .then(r => r.json())
      .then(setHistory);
  }, []);

  return (
    <table className="w-full">
      <thead>
        <tr>
          <th>Nombre</th>
          <th>Teléfono</th>
          <th>Vehículo</th>
          <th>Estado</th>
          <th>Creado</th>
        </tr>
      </thead>
      <tbody>
        {history.map(courier => (
          <tr key={courier.id}>
            <td>{courier.name}</td>
            <td>{courier.phone}</td>
            <td>{courier.vehicle}</td>
            <td>{courier.status}</td>
            <td>{new Date(courier.created_at).toLocaleDateString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

## Notas Importantes

- Las credenciales se generan automáticamente y son únicas
- El domiciliario debe cambiar su contraseña en el primer acceso
- Las credenciales se devuelven solo una vez, así que el admin debe guardarlas
- Se recomienda usar HTTPS en producción para proteger las credenciales en tránsito
