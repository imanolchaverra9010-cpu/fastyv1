import { useState, useEffect } from "react";
import { X, Store, MapPin, Phone, Type, Image as ImageIcon, Smile, Clock, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { CATEGORIES } from "@/constants/categories";

interface BusinessModalProps {
  onClose: () => void;
  onSuccess: () => void;
  business?: any;
}

export function BusinessModal({ onClose, onSuccess, business }: BusinessModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    description: "",
    category: "",
    address: "",
    phone: "",
    emoji: "🏪",
    image_url: "",
    delivery_fee: 0,
    eta: "20-30 min",
    latitude: 0,
    longitude: 0
  });

  useEffect(() => {
    if (business) {
      setFormData({
        id: business.id || "",
        name: business.name || "",
        description: business.description || "",
        category: business.category || "",
        address: business.address || "",
        phone: business.phone || "",
        emoji: business.emoji || "🏪",
        image_url: business.image_url || "",
        delivery_fee: business.delivery_fee || 0,
        eta: business.eta || "20-30 min",
        latitude: business.latitude || 0,
        longitude: business.longitude || 0
      });
    }
  }, [business]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: (name === "delivery_fee" || name === "latitude" || name === "longitude") 
        ? parseFloat(value) || 0 
        : value 
    }));
  };

  const getCoords = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setFormData(prev => ({
          ...prev,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude
        }));
        toast({ title: "Coordenadas obtenidas", description: "Lat/Lng actualizados correctamente." });
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = business
        ? `/api/businesses/${business.id}`
        : "/api/businesses";

      const method = business ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Error al ${business ? 'actualizar' : 'crear'} el negocio`);
      }

      toast({
        title: "¡Éxito!",
        description: `Negocio ${business ? 'actualizado' : 'creado'} correctamente.`
      });
      onSuccess();
      onClose();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="bg-card w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-3xl border border-border/60 shadow-glow flex flex-col">
        <div className="p-6 border-b border-border/60 flex items-center justify-between bg-gradient-hero text-primary-foreground">
          <h2 className="text-2xl font-display font-bold flex items-center gap-2">
            <Store className="h-6 w-6" /> {business ? 'Editar Negocio' : 'Nuevo Negocio'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="id" className="flex items-center gap-2"><Type className="h-4 w-4" /> ID Único (Slug)</Label>
              <Input
                id="id"
                name="id"
                placeholder="ej: pizzeria-napolitana"
                required
                value={formData.id}
                onChange={handleChange}
                disabled={!!business}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name" className="flex items-center gap-2"><Store className="h-4 w-4" /> Nombre del Negocio</Label>
              <Input id="name" name="name" placeholder="ej: Pizzería Napolitana" required value={formData.name} onChange={handleChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category" className="flex items-center gap-2">Categoría</Label>
              <select
                id="category"
                name="category"
                required
                value={formData.category}
                onChange={(e) => {
                  const selectedCat = CATEGORIES.find(c => c.name === e.target.value);
                  setFormData(prev => ({
                    ...prev,
                    category: e.target.value,
                    emoji: selectedCat?.emoji || prev.emoji
                  }));
                }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="" disabled>Selecciona una categoría</option>
                {CATEGORIES.map(cat => (
                  <option key={cat.name} value={cat.name}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-2"><Phone className="h-4 w-4" /> Teléfono</Label>
              <Input id="phone" name="phone" type="tel" placeholder="ej: 3001234567" required value={formData.phone} onChange={handleChange} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="address" className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Dirección</Label>
              <Input id="address" name="address" placeholder="ej: Calle 10 #5-20" required value={formData.address} onChange={handleChange} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description" className="flex items-center gap-2">Descripción</Label>
              <Textarea id="description" name="description" placeholder="Cuéntanos un poco sobre el negocio..." value={formData.description} onChange={handleChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emoji" className="flex items-center gap-2"><Smile className="h-4 w-4" /> Emoji Representativo</Label>
              <Input id="emoji" name="emoji" placeholder="ej: 🍕" value={formData.emoji} onChange={handleChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="image_url" className="flex items-center gap-2"><ImageIcon className="h-4 w-4" /> URL de Imagen (Opcional)</Label>
              <Input id="image_url" name="image_url" placeholder="https://..." value={formData.image_url} onChange={handleChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="delivery_fee" className="flex items-center gap-2"><DollarSign className="h-4 w-4" /> Costo de Envío</Label>
              <Input id="delivery_fee" name="delivery_fee" type="number" placeholder="ej: 3500" required value={formData.delivery_fee} onChange={handleChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="eta" className="flex items-center gap-2"><Clock className="h-4 w-4" /> Tiempo Estimado</Label>
              <Input id="eta" name="eta" placeholder="ej: 25-35 min" required value={formData.eta} onChange={handleChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="latitude">Latitud</Label>
              <Input id="latitude" name="latitude" type="number" step="any" value={formData.latitude} onChange={handleChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="longitude">Longitud</Label>
              <Input id="longitude" name="longitude" type="number" step="any" value={formData.longitude} onChange={handleChange} />
            </div>
            <div className="md:col-span-2">
              <Button type="button" variant="outline" size="sm" onClick={getCoords} className="w-full">
                <MapPin className="h-4 w-4 mr-2" /> Detectar mi ubicación actual para este negocio
              </Button>
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <Button type="button" variant="outline" className="flex-1 rounded-xl" onClick={onClose}>Cancelar</Button>
            <Button type="submit" variant="hero" className="flex-[2] rounded-xl font-bold" disabled={loading}>
              {loading ? (business ? "Actualizando..." : "Creando...") : (business ? "Actualizar Negocio" : "Crear Negocio")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
