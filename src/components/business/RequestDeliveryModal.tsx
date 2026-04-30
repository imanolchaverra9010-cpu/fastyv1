import { useState } from "react";
import { X, MapPin, Phone, User, DollarSign, FileText, Navigation, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Business } from "@/types/business";

interface RequestDeliveryModalProps {
  business: Business;
  onClose: () => void;
  onSuccess: () => void;
}

export const RequestDeliveryModal = ({ business, onClose, onSuccess }: RequestDeliveryModalProps) => {
  const [loading, setLoading] = useState(false);
  const [searchingLocation, setSearchingLocation] = useState(false);
  const [formData, setFormData] = useState({
    customer_name: "",
    customer_phone: "",
    delivery_address: "",
    total: "",
    payment_method: "Efectivo",
    notes: "",
    latitude: null as number | null,
    longitude: null as number | null,
  });

  const getCurrentLocation = () => {
    setSearchingLocation(true);
    if (!navigator.geolocation) {
      toast({ title: "Error", description: "Tu navegador no soporta geolocalización", variant: "destructive" });
      setSearchingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          const data = await res.json();
          setFormData(prev => ({
            ...prev,
            delivery_address: data.display_name,
            latitude,
            longitude
          }));
          toast({ title: "Ubicación detectada" });
        } catch (error) {
          setFormData(prev => ({ ...prev, latitude, longitude }));
        } finally {
          setSearchingLocation(false);
        }
      },
      () => {
        toast({ title: "Error", description: "No se pudo obtener tu ubicación actual", variant: "destructive" });
        setSearchingLocation(false);
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.delivery_address || !formData.customer_name || !formData.total) {
      toast({ title: "Error", description: "Completa los campos obligatorios", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_id: business.id,
          user_id: null, // Pedido manual del negocio
          customer_name: formData.customer_name,
          customer_phone: formData.customer_phone,
          delivery_address: formData.delivery_address,
          payment_method: formData.payment_method,
          notes: formData.notes,
          total: parseInt(formData.total),
          latitude: formData.latitude,
          longitude: formData.longitude,
          order_type: "business_requested",
          origin_name: business.name,
          origin_address: business.address,
          items: [
            {
              name: "Servicio de Domicilio Externo",
              price: parseInt(formData.total),
              quantity: 1,
              emoji: "🛵"
            }
          ]
        }),
      });

      if (response.ok) {
        toast({ title: "Solicitud enviada", description: "Los repartidores han sido notificados." });
        onSuccess();
        onClose();
      } else {
        throw new Error("Error al crear la solicitud");
      }
    } catch (error) {
      toast({ title: "Error", description: "No se pudo enviar la solicitud.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-background/80 backdrop-blur-sm">
      <div className="bg-card w-full max-w-lg h-full sm:h-auto sm:rounded-3xl border-0 sm:border border-border/60 shadow-glow overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
        <div className="p-4 sm:p-6 border-b border-border/60 flex items-center justify-between bg-primary text-primary-foreground shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Navigation className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-display font-bold">Solicitar Domicilio</h2>
              <p className="text-[10px] sm:text-xs opacity-80">Despacho para pedidos externos</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                <User className="h-3 w-3" /> Cliente
              </label>
              <Input
                required
                value={formData.customer_name}
                onChange={e => setFormData(prev => ({ ...prev, customer_name: e.target.value }))}
                className="h-11 rounded-xl"
                placeholder="Nombre del cliente"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                <Phone className="h-3 w-3" /> Teléfono
              </label>
              <Input
                required
                value={formData.customer_phone}
                onChange={e => setFormData(prev => ({ ...prev, customer_phone: e.target.value }))}
                className="h-11 rounded-xl"
                placeholder="ej: 3001234567"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                <MapPin className="h-3 w-3" /> Dirección de Entrega
              </label>
              <button 
                type="button"
                onClick={getCurrentLocation}
                disabled={searchingLocation}
                className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1"
              >
                {searchingLocation ? <Loader2 className="h-3 w-3 animate-spin" /> : <Navigation className="h-3 w-3" />}
                Mi ubicación actual
              </button>
            </div>
            <Input
              required
              value={formData.delivery_address}
              onChange={e => setFormData(prev => ({ ...prev, delivery_address: e.target.value }))}
              className="h-11 rounded-xl"
              placeholder="Dirección exacta del cliente"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                <DollarSign className="h-3 w-3" /> Valor a Cobrar
              </label>
              <Input
                required
                type="number"
                value={formData.total}
                onChange={e => setFormData(prev => ({ ...prev, total: e.target.value }))}
                className="h-11 rounded-xl"
                placeholder="Total a recaudar"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase">Método de Pago</label>
              <select
                className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm shadow-soft outline-none focus:ring-2 focus:ring-primary/20"
                value={formData.payment_method}
                onChange={e => setFormData(prev => ({ ...prev, payment_method: e.target.value }))}
              >
                <option value="Efectivo">Efectivo (Cobrar al entregar)</option>
                <option value="Transferencia">Transferencia (Ya pagado)</option>
                <option value="Datafono">Datáfono</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
              <FileText className="h-3 w-3" /> Notas / Instrucciones
            </label>
            <textarea
              className="w-full h-24 rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-soft outline-none focus:ring-2 focus:ring-primary/20"
              value={formData.notes}
              onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Indicaciones para el repartidor (ej: llevar cambio de $50.000)"
            />
          </div>

          <div className="pt-4 flex gap-3">
            <Button type="button" variant="outline" className="flex-1 rounded-xl h-12" onClick={onClose}>Cancelar</Button>
            <Button type="submit" variant="hero" className="flex-[2] rounded-xl h-12 font-bold text-lg shadow-glow" disabled={loading}>
              {loading ? "Procesando..." : "Solicitar Repartidor"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
