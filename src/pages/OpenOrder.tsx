import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ShoppingBag, MapPin, Store, CreditCard, Send, Loader2, LocateFixed, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import Receipt from "@/components/Receipt";
import { isNightFeeTime } from "@/lib/utils";
import { getPositionErrorMessage, getPreciseCurrentPosition } from "@/utils/geolocation";

const OpenOrder = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [orderSummary, setOrderSummary] = useState<any>(null);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [dynamicFee, setDynamicFee] = useState<number | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const [formData, setFormData] = useState({
    customerName: "",
    customerPhone: "",
    deliveryAddress: "",
    originName: "",
    originAddress: "",
    description: "",
    paymentMethod: "cash"
  });

  useEffect(() => {
    const fetchLastOrder = async () => {
      if (!user?.id) return;
      try {
        const response = await fetch(`/api/orders/user/${user.id}`);
        if (response.ok) {
          const orders = await response.json();
          if (orders && orders.length > 0) {
            const lastOrder = orders[0];
            setFormData(prev => ({
              ...prev,
              customerName: lastOrder.customer_name || user.username || "",
              customerPhone: lastOrder.customer_phone || "",
              deliveryAddress: lastOrder.delivery_address || ""
            }));
          } else {
            setFormData(prev => ({ ...prev, customerName: user.username || "" }));
          }
        }
      } catch (error) {
        console.error("Error fetching last order:", error);
      }
    };
    fetchLastOrder();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerName || !formData.originName || !formData.description || !formData.deliveryAddress) {
      toast({ title: "Faltan datos", description: "Por favor completa todos los campos requeridos antes de enviar el pedido.", variant: "destructive" });
      return;
    }

    setIsConfirmOpen(true);
  };

  const processOrder = async () => {
    setIsConfirmOpen(false);
    setLoading(true);
    try {
      const nightFee = isNightFeeTime() ? 2000 : 0;

      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user?.id,
          customer_name: formData.customerName,
          customer_phone: formData.customerPhone,
          delivery_address: formData.deliveryAddress,
          origin_name: formData.originName,
          origin_address: formData.originAddress,
          open_order_description: formData.description,
          payment_method: formData.paymentMethod,
          order_type: "open",
          total: 0,
          latitude: latitude,
          longitude: longitude,
          delivery_fee: 0,
          night_fee: nightFee,
          items: []
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Error al crear el pedido");

      setOrderSummary({
        orderId: data.id,
        customerName: formData.customerName,
        customerPhone: formData.customerPhone,
        deliveryAddress: formData.deliveryAddress,
        paymentMethod: formData.paymentMethod,
        items: [{
          name: `Compra en ${formData.originName}`,
          price: 0,
          quantity: 1,
          emoji: "🛍️"
        }],
        subtotal: 0,
        fee: 0,
        total: 0
      });
      setDone(data.id);
      toast({ title: "¡Pedido enviado!", description: "Un domiciliario se encargará de tu compra." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const getCurrentLocation = () => {
    setLocationLoading(true);
    getPreciseCurrentPosition({ desiredAccuracy: 25, fallbackAccuracy: 80, timeout: 18000 })
      .then(async (position) => {
          const lat = position.latitude;
          const lon = position.longitude;
          setLatitude(lat);
          setLongitude(lon);
          
          try {
            // Get dynamic fee from backend
            const feeResponse = await fetch('/api/orders/calculate-open-fee', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ latitude: lat, longitude: lon })
            });
            
            if (feeResponse.ok) {
              const feeData = await feeResponse.json();
              setDynamicFee(feeData.fee);
            }
            
            // Get human readable address
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`,
              { headers: { 'Accept-Language': 'es' } }
            );
            
            if (response.ok) {
              const data = await response.json();
              if (data.display_name) {
                setFormData(prev => ({ ...prev, deliveryAddress: data.display_name }));
                toast({ title: "Ubicación precisa obtenida", description: `Dirección actualizada. Precisión aprox: ${Math.round(position.accuracy || 0)} m.` });
              } else {
                setFormData(prev => ({ ...prev, deliveryAddress: `${lat.toFixed(6)}, ${lon.toFixed(6)}` }));
                toast({ title: "Ubicación precisa obtenida", description: `Coordenadas actualizadas. Precisión aprox: ${Math.round(position.accuracy || 0)} m.` });
              }
            }
          } catch (err) {
            console.error("Error in location tools:", err);
            setFormData(prev => ({ ...prev, deliveryAddress: `${lat.toFixed(6)}, ${lon.toFixed(6)}` }));
            toast({ title: "Ubicación precisa obtenida", description: "Coordenadas actualizadas." });
          } finally {
            setLocationLoading(false);
          }
        })
        .catch((error) => {
          console.error("Error getting location:", error);
          setLocationLoading(false);
          toast({
            title: "Error de ubicación",
            description: getPositionErrorMessage(error),
            variant: "destructive",
          });
        });
  };



  if (done && orderSummary) {
    return (
      <div className="min-h-screen bg-gradient-warm py-12 px-4">
        <Receipt {...orderSummary} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-warm pb-20">
      <header className="container py-8 max-w-2xl">
        <button 
          onClick={() => navigate(-1)} 
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-8 group"
        >
          <div className="h-8 w-8 rounded-full bg-background shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
            <ArrowLeft className="h-4 w-4" />
          </div>
          <span className="font-semibold">Volver</span>
        </button>
        
        <div className="space-y-2">
          <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-foreground">Pedido Abierto</h1>
          <p className="text-muted-foreground text-lg">¿No encuentras lo que buscas? <span className="text-primary font-bold">Nosotros lo compramos por ti.</span></p>
        </div>
      </header>

      <main className="container max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Sección de la Tienda */}
          <section className="bg-card/50 backdrop-blur-md border border-border/60 rounded-[2rem] p-8 shadow-card hover:shadow-glow transition-all duration-500">
            <div className="flex items-center gap-4 mb-8">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
                <Store className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-2xl font-display font-bold">¿Dónde compramos?</h2>
                <p className="text-sm text-muted-foreground">Dinos el lugar y lo que necesitas.</p>
              </div>
            </div>

            <div className="grid gap-6">
              <div className="space-y-2">
                <Label htmlFor="originName" className="ml-1 font-bold text-xs uppercase tracking-wider text-muted-foreground">Nombre del establecimiento *</Label>
                <Input
                  id="originName"
                  placeholder="Ej: Ferretería El Martillo, Panadería de la esquina..."
                  value={formData.originName}
                  onChange={(e) => {
                    setFormData({ ...formData, originName: e.target.value });
                  }}
                  className="h-12 rounded-xl border-border/60 focus:ring-primary/20 bg-background/50"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="originAddress" className="ml-1 font-bold text-xs uppercase tracking-wider text-muted-foreground">Dirección del lugar (Opcional)</Label>
                <Input
                  id="originAddress"
                  placeholder="Ej: Calle 10 # 5-20"
                  value={formData.originAddress}
                  onChange={(e) => {
                    setFormData({ ...formData, originAddress: e.target.value });
                  }}
                  className="h-12 rounded-xl border-border/60 focus:ring-primary/20 bg-background/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description" className="ml-1 font-bold text-xs uppercase tracking-wider text-muted-foreground">¿Qué necesitas que compremos? *</Label>
                <Textarea
                  id="description"
                  placeholder="Describe detalladamente los productos, marcas o tallas..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="rounded-xl min-h-[120px] border-border/60 bg-background/50 focus:ring-primary/20"
                  required
                />
              </div>
            </div>
          </section>

          {/* Datos de Entrega */}
          <section className="bg-card/50 backdrop-blur-md border border-border/60 rounded-[2rem] p-8 shadow-card hover:shadow-glow transition-all duration-500">
            <div className="flex items-center gap-4 mb-8">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
                <MapPin className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-2xl font-display font-bold">¿A dónde lo llevamos?</h2>
                <p className="text-sm text-muted-foreground">Confirma tus datos de entrega.</p>
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="customerName" className="ml-1 font-bold text-xs uppercase tracking-wider text-muted-foreground">Tu nombre *</Label>
                <Input
                  id="customerName"
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  className="h-12 rounded-xl border-border/60 focus:ring-primary/20 bg-background/50"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerPhone" className="ml-1 font-bold text-xs uppercase tracking-wider text-muted-foreground">Teléfono de contacto</Label>
                <Input
                  id="customerPhone"
                  value={formData.customerPhone}
                  onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                  className="h-12 rounded-xl border-border/60 focus:ring-primary/20 bg-background/50"
                  placeholder="310 000 0000"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="deliveryAddress" className="ml-1 font-bold text-xs uppercase tracking-wider text-muted-foreground">Dirección de entrega *</Label>
                <div className="flex flex-col gap-4">
                  <div className="relative group">
                    <Input
                      id="deliveryAddress"
                      value={formData.deliveryAddress}
                      onChange={(e) => setFormData({ ...formData, deliveryAddress: e.target.value })}
                      placeholder="Ej: Calle 10 #5-20, Interior 3"
                      className="pr-12 h-14 rounded-xl border-primary/20 focus:border-primary focus:ring-primary/20 bg-background/50 font-medium"
                      required
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-primary group-focus-within:scale-110 transition-transform">
                      <MapPin className="h-5 w-5" />
                    </div>
                  </div>
                  
                  <p className="text-[11px] text-muted-foreground font-medium px-1 flex items-center gap-1.5 leading-relaxed">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary/40 shrink-0" />
                    Puedes escribir la dirección manualmente o usar el botón de GPS para calcular una tarifa más precisa.
                  </p>

                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={getCurrentLocation}
                    disabled={locationLoading}
                    className="h-14 rounded-2xl border-2 border-primary/20 text-primary hover:bg-primary/5 hover:border-primary/40 transition-all font-bold group"
                  >
                    {locationLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                        <span>Obteniendo ubicación...</span>
                      </div>
                    ) : (
                      <>
                        <LocateFixed className="h-5 w-5 group-hover:rotate-12 transition-transform" />
                        <span>{formData.deliveryAddress ? "Actualizar ubicación con GPS" : "Obtener mi ubicación actual"}</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </section>

          {/* Método de Pago */}
          <section className="bg-card/50 backdrop-blur-md border border-border/60 rounded-[2rem] p-8 shadow-card hover:shadow-glow transition-all duration-500">
            <div className="flex items-center gap-4 mb-8">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
                <CreditCard className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-2xl font-display font-bold">Método de pago</h2>
                <p className="text-sm text-muted-foreground">Paga el mandado al recibir.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, paymentMethod: 'cash' })}
                className="flex items-center gap-4 p-5 rounded-2xl border-2 border-primary bg-primary/5 cursor-pointer transition-all duration-300 group"
              >
                <div className="h-12 w-12 rounded-xl bg-background shadow-sm flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  💵
                </div>
                <div className="flex-1 text-left">
                  <p className="font-bold text-foreground">Efectivo</p>
                  <p className="text-xs text-muted-foreground">Paga al repartidor cuando llegue con tus cosas</p>
                </div>
                <div className="h-6 w-6 rounded-full border-2 border-primary bg-primary flex items-center justify-center">
                  <div className="h-2 w-2 rounded-full bg-white" />
                </div>
              </button>
            </div>

            <div className="mt-6 p-4 rounded-2xl bg-orange-500/5 border border-orange-500/10 flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0">
                <ShoppingBag className="h-4 w-4 text-orange-600" />
              </div>
              <p className="text-[11px] text-orange-800 font-medium leading-relaxed italic">
                * El valor de los productos comprados se pagará contra entrega presentando el recibo físico. Fasty solo gestiona el servicio de transporte.
              </p>
            </div>
            
            {dynamicFee !== null && (
              <div className="mt-8 p-6 rounded-2xl bg-primary/10 border-2 border-primary/20 flex justify-between items-center animate-in zoom-in-95">
                <div>
                  <span className="font-bold text-sm block text-primary/80 uppercase tracking-wider">Tarifa de entrega estimada</span>
                  <p className="text-xs text-muted-foreground mt-0.5 font-medium">Sujeta a cambios según disponibilidad</p>
                </div>
                <span className="font-display font-black text-3xl text-primary">${dynamicFee.toLocaleString()}</span>
              </div>
            )}
          </section>

          <div className="pt-4">
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-20 rounded-[2.5rem] text-xl font-display font-bold shadow-glow-primary transition-all hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden group"
              variant="hero"
            >
              {loading ? (
                <div className="flex items-center gap-3">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span>Enviando pedido...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-3">
                  <Send className="h-6 w-6 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                  <span>Enviar mi Pedido Abierto</span>
                </div>
              )}
              <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            </Button>
            <p className="text-center text-xs text-muted-foreground mt-6 font-medium italic">
              * Un domiciliario aceptará tu pedido en unos minutos.
            </p>
          </div>
        </form>
      </main>

      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent className="rounded-[2rem] border-2 border-primary/20 bg-background/95 backdrop-blur-xl p-8 max-w-[400px]">
          <AlertDialogHeader className="flex flex-col items-center text-center space-y-4">
            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center text-primary animate-pulse shadow-inner">
              <AlertCircle className="h-10 w-10" />
            </div>
            <AlertDialogTitle className="text-2xl font-display font-bold">¡Un momento!</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground text-base leading-relaxed">
              Antes de procesar tu pedido: la tarifa del domicilio puede variar según la dirección, distancia real y disponibilidad del domiciliario.
              <br /><br />
              <span className="font-bold text-foreground italic">¿Deseas continuar?</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col gap-3 mt-6">
            <AlertDialogAction 
              onClick={processOrder}
              className="w-full h-14 rounded-2xl text-lg font-bold shadow-glow-primary hover:scale-[1.02] transition-transform"
            >
              Sí, continuar
            </AlertDialogAction>
            <AlertDialogCancel className="w-full h-14 rounded-2xl text-lg font-bold border-2 border-border/60 hover:bg-muted transition-colors">
              Revisar pedido
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default OpenOrder;
