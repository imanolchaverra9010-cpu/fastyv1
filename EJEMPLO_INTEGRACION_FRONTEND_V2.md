# Ejemplo de Integración en el Frontend (Versión 2)

## Cómo usar el nuevo endpoint con credenciales manuales

### 1. Función para crear un domiciliario

```typescript
// services/courierService.ts

interface CourierCreateData {
  name: string;
  phone: string;
  vehicle: string;
  username: string;
  password: string;
}

interface CourierResponse {
  message: string;
  courier_id: number;
  user_id: number;
  data: {
    username: string;
    email: string;
    name: string;
    phone: string;
    vehicle: string;
  };
}

export async function createCourierWithCredentials(
  courierData: CourierCreateData
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
    const errorData = await response.json();
    throw new Error(errorData.detail || 'Error al crear domiciliario');
  }

  return response.json();
}
```

### 2. Componente de formulario mejorado

```tsx
// components/CreateCourierForm.tsx

import React, { useState } from 'react';
import { createCourierWithCredentials } from '@/services/courierService';

export function CreateCourierForm() {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    vehicle: '',
    username: '',
    password: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [createdCourier, setCreatedCourier] = useState(null);

  // Validar campos en tiempo real
  const validateField = (name: string, value: string): string => {
    switch (name) {
      case 'name':
        if (!value.trim()) return 'El nombre es requerido';
        if (value.trim().length < 3) return 'El nombre debe tener al menos 3 caracteres';
        return '';
      
      case 'phone':
        if (!value.trim()) return 'El teléfono es requerido';
        if (!/^\d{10}$/.test(value.replace(/\D/g, ''))) return 'Teléfono inválido';
        return '';
      
      case 'vehicle':
        if (!value) return 'Debe seleccionar un vehículo';
        return '';
      
      case 'username':
        if (!value.trim()) return 'El nombre de usuario es requerido';
        if (value.trim().length < 3) return 'El username debe tener al menos 3 caracteres';
        if (!/^[a-zA-Z0-9_]+$/.test(value.trim())) {
          return 'El username solo puede contener letras, números y guiones bajos';
        }
        return '';
      
      case 'password':
        if (!value) return 'La contraseña es requerida';
        if (value.length < 6) return 'La contraseña debe tener al menos 6 caracteres';
        return '';
      
      default:
        return '';
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Validar mientras escribe
    const error = validateField(name, value);
    setErrors(prev => ({
      ...prev,
      [name]: error
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar todos los campos
    const newErrors: Record<string, string> = {};
    Object.entries(formData).forEach(([key, value]) => {
      const error = validateField(key, value);
      if (error) newErrors[key] = error;
    });
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      const response = await createCourierWithCredentials(formData);
      
      // Mostrar datos del domiciliario creado
      setCreatedCourier(response.data);
      setSuccess(true);
      
      // Limpiar formulario
      setFormData({
        name: '',
        phone: '',
        vehicle: '',
        username: '',
        password: ''
      });
      
      // Ocultar mensaje de éxito después de 5 segundos
      setTimeout(() => setSuccess(false), 5000);
      
    } catch (err) {
      setErrors({
        submit: err instanceof Error ? err.message : 'Error desconocido'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-6">Crear Nuevo Domiciliario</h2>
      
      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h3 className="font-bold text-green-800 mb-2">✅ Domiciliario creado exitosamente</h3>
          {createdCourier && (
            <div className="text-sm text-green-700">
              <p><strong>Nombre:</strong> {createdCourier.name}</p>
              <p><strong>Username:</strong> {createdCourier.username}</p>
              <p><strong>Vehículo:</strong> {createdCourier.vehicle}</p>
            </div>
          )}
        </div>
      )}

      {errors.submit && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">{errors.submit}</p>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Datos del Domiciliario */}
        <fieldset className="border-t pt-4">
          <legend className="text-lg font-semibold mb-3">Datos del Domiciliario</legend>
          
          <div>
            <label className="block text-sm font-medium mb-1">Nombre Completo *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Juan Perez"
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                errors.name ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
              }`}
            />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Teléfono *</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="3105555555"
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                errors.phone ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
              }`}
            />
            {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Vehículo *</label>
            <select
              name="vehicle"
              value={formData.vehicle}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                errors.vehicle ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
              }`}
            >
              <option value="">Seleccionar vehículo</option>
              <option value="Moto">Moto</option>
              <option value="Bicicleta">Bicicleta</option>
              <option value="Auto">Auto</option>
              <option value="Scooter">Scooter</option>
            </select>
            {errors.vehicle && <p className="text-red-500 text-xs mt-1">{errors.vehicle}</p>}
          </div>
        </fieldset>

        {/* Credenciales de Acceso */}
        <fieldset className="border-t pt-4">
          <legend className="text-lg font-semibold mb-3">Credenciales de Acceso</legend>
          
          <div>
            <label className="block text-sm font-medium mb-1">Nombre de Usuario *</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="juan_perez"
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                errors.username ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
              }`}
            />
            {errors.username && <p className="text-red-500 text-xs mt-1">{errors.username}</p>}
            <p className="text-gray-500 text-xs mt-1">Solo letras, números y guiones bajos</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Contraseña *</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                errors.password ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
              }`}
            />
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
            <p className="text-gray-500 text-xs mt-1">Mínimo 6 caracteres</p>
          </div>
        </fieldset>

        <button
          type="submit"
          disabled={loading || Object.values(errors).some(e => e)}
          className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 font-medium transition"
        >
          {loading ? 'Creando...' : 'Crear Domiciliario'}
        </button>
      </form>
    </div>
  );
}
```

### 3. Hook personalizado para validación

```typescript
// hooks/useCourierForm.ts

import { useState } from 'react';

export function useCourierForm() {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    vehicle: '',
    username: '',
    password: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'El teléfono es requerido';
    }

    if (!formData.vehicle) {
      newErrors.vehicle = 'Debe seleccionar un vehículo';
    }

    if (!formData.username.trim()) {
      newErrors.username = 'El nombre de usuario es requerido';
    }

    if (!formData.password) {
      newErrors.password = 'La contraseña es requerida';
    } else if (formData.password.length < 6) {
      newErrors.password = 'La contraseña debe tener al menos 6 caracteres';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      vehicle: '',
      username: '',
      password: ''
    });
    setErrors({});
  };

  return {
    formData,
    setFormData,
    errors,
    setErrors,
    validateForm,
    resetForm
  };
}
```

### 4. Integración en la página de administración

```tsx
// pages/AdminDashboard.tsx

import { CreateCourierForm } from '@/components/CreateCourierForm';
import { CouriersList } from '@/components/CouriersList';
import { useState } from 'react';

export function AdminDashboard() {
  const [refreshList, setRefreshList] = useState(0);

  const handleCourierCreated = () => {
    // Refrescar la lista de domiciliarios
    setRefreshList(prev => prev + 1);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-8">
      {/* Panel de creación */}
      <div>
        <CreateCourierForm onSuccess={handleCourierCreated} />
      </div>

      {/* Lista de domiciliarios */}
      <div>
        <CouriersList key={refreshList} />
      </div>
    </div>
  );
}
```

### 5. Componente de lista de domiciliarios

```tsx
// components/CouriersList.tsx

import { useEffect, useState } from 'react';

export function CouriersList() {
  const [couriers, setCouriers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCouriers();
  }, []);

  const fetchCouriers = async () => {
    try {
      const response = await fetch('/api/admin/couriers', {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`
        }
      });
      const data = await response.json();
      setCouriers(data);
    } catch (error) {
      console.error('Error fetching couriers:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Cargando...</div>;

  return (
    <div>
      <h3 className="text-xl font-bold mb-4">Domiciliarios Registrados</h3>
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2 text-left">Nombre</th>
            <th className="border p-2 text-left">Teléfono</th>
            <th className="border p-2 text-left">Vehículo</th>
            <th className="border p-2 text-left">Estado</th>
          </tr>
        </thead>
        <tbody>
          {couriers.map(courier => (
            <tr key={courier.id} className="hover:bg-gray-50">
              <td className="border p-2">{courier.name}</td>
              <td className="border p-2">{courier.phone}</td>
              <td className="border p-2">{courier.vehicle}</td>
              <td className="border p-2">
                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                  courier.status === 'online' ? 'bg-green-100 text-green-800' :
                  courier.status === 'busy' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {courier.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

## Flujo Completo en el Frontend

1. **Admin accede al panel de administración**
2. **Completa el formulario con todos los datos:**
   - Datos del domiciliario (nombre, teléfono, vehículo)
   - Credenciales de acceso (username, contraseña)
3. **El sistema valida los datos en tiempo real**
4. **Hace clic en "Crear Domiciliario"**
5. **El sistema envía la solicitud al backend**
6. **Se muestra confirmación de éxito**
7. **La lista de domiciliarios se actualiza automáticamente**

## Mejoras Opcionales

### 1. Generador de Contraseñas Seguras

```typescript
// utils/passwordGenerator.ts

export function generateSecurePassword(length: number = 12): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*';
  
  const allChars = uppercase + lowercase + numbers + symbols;
  let password = '';
  
  for (let i = 0; i < length; i++) {
    password += allChars.charAt(Math.floor(Math.random() * allChars.length));
  }
  
  return password;
}
```

### 2. Botón para Generar Contraseña

```tsx
<div className="flex gap-2">
  <input
    type="password"
    name="password"
    value={formData.password}
    onChange={handleChange}
    placeholder="••••••••"
    className="flex-1 px-3 py-2 border rounded-md"
  />
  <button
    type="button"
    onClick={() => {
      const newPassword = generateSecurePassword();
      setFormData(prev => ({ ...prev, password: newPassword }));
    }}
    className="px-3 py-2 bg-gray-200 rounded-md hover:bg-gray-300"
  >
    Generar
  </button>
</div>
```

### 3. Mostrar/Ocultar Contraseña

```tsx
const [showPassword, setShowPassword] = useState(false);

<div className="relative">
  <input
    type={showPassword ? 'text' : 'password'}
    name="password"
    value={formData.password}
    onChange={handleChange}
    className="w-full px-3 py-2 border rounded-md pr-10"
  />
  <button
    type="button"
    onClick={() => setShowPassword(!showPassword)}
    className="absolute right-3 top-2"
  >
    {showPassword ? '👁️' : '👁️‍🗨️'}
  </button>
</div>
```

