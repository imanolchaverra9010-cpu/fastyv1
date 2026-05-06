// v1.0.3 - Manual UTC Shift for Night Fee
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CreditCard, MapPin, LocateFixed, Store, Ticket, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { formatCOP } from "@/data/mock";
import { toast } from "@/hooks/use-toast";
import MultiReceipt from "@/components/MultiReceipt";
import { isNightFeeTime } from "@/lib/utils";
import { getPositionErrorMessage, getPreciseCurrentPosition } from "@/utils/geolocation";

const getDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // Radio de la tierra en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const getDeliveryFeeByDistance = (distance: number) => {
  if (distance <= 2) return 5000;
  if (distance <= 4) return 8000;
  if (distance <= 6) return 10000;
  if (distance <= 8) return 12000;
  if (distance <= 10) return 15000;
  return Math.ceil(distance * 1500);
};

const Checkout = () => {
  const { lines, subtotal, clear, promo, applyPromo } = useCart();
  const { user } = useAuth();
  const [done, setDone] = useState<boolean>(false);
  const [orderSummaries, setOrderSummaries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [businessCoords, setBusinessCoords] = useState<Record<string, {lat: number, lng: number}>>({});
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const navigate = useNavigate();

  const [initialData, setInitialData] = useState({
    name: "",
    phone: "",
    address: ""
  });
  const [addressValue, setAddressValue] = useState("");

  useEffect(() => {
    const fetchLastOrder = async () => {
      if (!user?.id) return;
      try {
        const response = await fetch(`/api/orders/user/${user.id}`);
        if (response.ok) {
          const orders = await response.json();
          if (orders && orders.length > 0) {
            const lastOrder = orders[0];
            setInitialData({
              name: lastOrder.customer_name || user.username || "",
              phone: lastOrder.customer_phone || "",
              address: lastOrder.delivery_address || ""
            });
            setAddressValue(lastOrder.delivery_address || "");
            
            // Set coordinates from the last order so distance fee is calculated automatically
            if (lastOrder.latitude && lastOrder.longitude) {
              setLatitude(lastOrder.latitude);
              setLongitude(lastOrder.longitude);
            }
          } else {
            setInitialData(prev => ({ ...prev, name: user.username || "" }));
          }
        }
      } catch (error) {
        console.error("Error fetching last order:", error);
      }
    };
    fetchLastOrder();
  }, [user]);

  useEffect(() => {
    const fetchBusinessCoords = async () => {
      const uniqueBusinessIds = Array.from(new Set(lines.map(l => String(l.businessId))));
      
      const newCoords: Record<string, {lat: number, lng: number}> = {};
      
      for (const bId of uniqueBusinessIds) {
        try {
          const res = await fetch(`/api/businesses/${bId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.latitude && data.longitude) {
              newCoords[bId] = { lat: data.latitude, lng: data.longitude };
            }
          }
        } catch (e) {
          console.error("Error fetching business coords:", e);
        }
      }
      setBusinessCoords(newCoords);
    };
    if (lines.length > 0) fetchBusinessCoords();
  }, [lines]);

  // Debug toast for night fee
  useEffect(() => {
    const isNight = isNightFeeTime();
    if (isNight) {
      toast({
        title: "Horario Nocturno Detectado",
        description: "Se aplicará un recargo de 2000 COP a tu envío.",
      });
    }
  }, []);

  const { data: benefitsData } = useQuery({
    queryKey: ["userBenefits", user?.id],
    queryFn: async () => {
      const res = await fetch(`/api/users/${user?.id}/benefits`);
      if (!res.ok) throw new Error("Error fetching benefits");
      return res.json();
    },
    enabled: !!user?.id,
  });

  const calculateTotalFee = () => {
    if (lines.length === 0) return 0;
    const uniqueBusinessIds = Array.from(new Set(lines.map(l => String(l.businessId))));
    
    let maxDistance = -1;
    let baseFee = 5000;

    uniqueBusinessIds.forEach(bId => {
      const coords = businessCoords[bId];
      if (coords && latitude && longitude) {
        const distance = getDistanceKm(latitude, longitude, coords.lat, coords.lng);
        if (!isNaN(distance) && distance > maxDistance) {
          maxDistance = distance;
          baseFee = getDeliveryFeeByDistance(distance);
        }
      }
    });

    const isNight = isNightFeeTime();
    const additionalFees = (uniqueBusinessIds.length - 1) * 2000;
    const nightFee = isNight ? 2000 : 0;
    
    return baseFee + additionalFees + nightFee;
  };

  const fee = calculateTotalFee();
  const numBusinesses = new Set(lines.map(l => String(l.businessId))).size;
  const rawDiscount = promo ? (fee * promo.discount / 100) : 0;
  const discount = Math.min(fee, rawDiscount);
  const total = subtotal + fee - discount;

  const getCurrentLocation = () => {
    setLocationLoading(true);
    getPreciseCurrentPosition({ desiredAccuracy: 25, fallbackAccuracy: 80, timeout: 18000 })
      .then(async (position) => {
          const lat = position.latitude;
          const lon = position.longitude;
          setLatitude(lat);
          setLongitude(lon);
          
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`,
              {
                headers: {
                  'Accept-Language': 'es'
                }
              }
            );
            if (response.ok) {
              const data = await response.json();
              if (data.display_name) {
                // Nominatim returns a very long display_name. We can try to simplify it.
                // display_name: "Calle 123, Barrio, Ciudad, Departamento, Código Postal, País"
                setAddressValue(data.display_name);
                toast({ title: "Ubicación precisa obtenida", description: `Dirección actualizada. Precisión aprox: ${Math.round(position.accuracy || 0)} m.` });
              } else {
                toast({ title: "Ubicación precisa obtenida", description: `Coordenadas actualizadas. Precisión aprox: ${Math.round(position.accuracy || 0)} m.` });
              }
            }
          } catch (err) {
            console.error("Error in reverse geocoding:", err);
            toast({ title: "Ubicación precisa obtenida", description: "Coordenadas actualizadas (no se pudo obtener la dirección)." });
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    const formData = new FormData(e.target as HTMLFormElement);
    const data = {
      customerName: formData.get("customerName") as string,
      customerPhone: formData.get("phone") as string,
      deliveryAddress: formData.get("address") as string,
      paymentMethod: formData.get("paymentMethod") as string,
      notes: formData.get("notes") as string,
    };

    setPendingFormData(data);
    setIsConfirmOpen(true);
  };

  const processOrder = async () => {
    if (!pendingFormData) return;
    setIsConfirmOpen(false);
    setLoading(true);

    const { customerName, customerPhone, deliveryAddress, paymentMethod, notes } = pendingFormData;

    const linesByBusiness: Record<string, typeof lines> = {};
    lines.forEach(l => {
      const bId = String(l.businessId);
      if (!linesByBusiness[bId]) linesByBusiness[bId] = [];
      linesByBusiness[bId].push(l);
    });

    // Generate a shared batch_id only when ordering from multiple businesses
    const businessIds = Object.keys(linesByBusiness);
    const batchId = businessIds.length > 1
      ? `batch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
      : null;

    try {
      const summaries: any[] = [];
      const businessIds = Object.keys(linesByBusiness);
      
      // Determinar cuál es el negocio más lejano
      let furthestBusinessId = businessIds[0];
      let maxDistance = -1;
      
      businessIds.forEach(bId => {
        const coords = businessCoords[bId];
        if (coords && latitude && longitude) {
          const distance = getDistanceKm(latitude, longitude, coords.lat, coords.lng);
          if (distance > maxDistance) {
            maxDistance = distance;
            furthestBusinessId = bId;
          }
        }
      });

      const orderPromises = Object.entries(linesByBusiness).map(async ([businessId, bLines]) => {
        const businessIdString = String(businessId);
        let bFee = 2000; // Base para negocios adicionales

        if (businessIdString === furthestBusinessId) {
          const coords = businessCoords[businessIdString];
          if (coords && latitude && longitude) {
            const distance = getDistanceKm(latitude, longitude, coords.lat, coords.lng);
            bFee = getDeliveryFeeByDistance(distance);
          } else {
            bFee = 5000; // Fallback si no hay coordenadas
          }
          
          // Aplicar recargo nocturno SOLO a la orden del negocio principal (el más lejano)
          if (isNightFeeTime()) {
            bFee += 2000;
          }
        }

        const bSubtotal = bLines.reduce((s, l) => s + l.qty * l.item.price, 0);
        const rawBDiscount = promo ? (bFee * promo.discount / 100) : 0;
        const bDiscount = Math.min(bFee, rawBDiscount);
        const bTotal = bSubtotal + bFee - bDiscount;

        // Separar delivery_fee y night_fee para el backend
        const isMainBusiness = businessIdString === furthestBusinessId;
        const bNightFee = isMainBusiness && isNightFeeTime() ? 2000 : 0;
        const bDeliveryFee = bFee - bNightFee;

        const orderData = {
          user_id: user?.id,
          business_id: businessId,
          customer_name: customerName,
          customer_phone: customerPhone,
          delivery_address: deliveryAddress,
          payment_method: paymentMethod || "card",
          notes: notes,
          total: Math.round(bTotal),
          latitude: latitude ? parseFloat(latitude.toFixed(8)) : null,
          longitude: longitude ? parseFloat(longitude.toFixed(8)) : null,
          batch_id: batchId,
          promo_code: promo?.code,
          delivery_fee: Math.round(bDeliveryFee),
          night_fee: Math.round(bNightFee),
          items: bLines.map(l => ({
            name: String(l.item.name),
            price: Math.round(l.item.price),
            quantity: Math.round(l.qty),
            emoji: String(l.item.emoji)
          }))
        };

        const response = await fetch("/api/orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(orderData),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.detail || "Error al crear el pedido");
        }

        // If payment method is card, create payment with Wompi
        let paymentData = null;
        if (paymentMethod === "card") {
          console.log("Creating payment with Wompi for order:", data.id);
          
          const paymentResponse = await fetch("/api/payments/create", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              order_id: data.id,
              amount: Math.round(bTotal),
              currency: "COP",
              customer_email: user?.email || "customer@example.com",
              reference: `order-${data.id}-${Date.now()}`
            }),
          });

          if (paymentResponse.ok) {
            paymentData = await paymentResponse.json();
            console.log("Payment created successfully:", paymentData);
          } else {
            const errorText = await paymentResponse.text();
            console.error("Error creating payment:", errorText);
            throw new Error(`Error al crear el pago: ${errorText}`);
          }
        }

        summaries.push({
          orderId: data.id,
          businessName: bLines[0].businessName,
          customerName: customerName,
          customerPhone: customerPhone,
          deliveryAddress: deliveryAddress,
          paymentMethod: paymentMethod || "card",
          items: bLines.map(l => ({
            name: String(l.item.name),
            price: Math.round(l.item.price),
            quantity: Math.round(l.qty),
            emoji: String(l.item.emoji)
          })),
          subtotal: bSubtotal,
          fee: bFee,
          discount: bDiscount,
          promoCode: promo?.code,
          total: bTotal,
          payment: paymentData
        });
      });

      await Promise.all(orderPromises);

      // Check if we need to redirect to payment
      const paymentOrder = summaries.find(s => s.payment?.checkout_url);
      if (paymentOrder) {
        console.log("Redirecting to Wompi checkout:", paymentOrder.payment.checkout_url);
        // Redirect to Wompi checkout
        window.location.href = paymentOrder.payment.checkout_url;
        return;
      } else {
        console.log("No payment orders found or no checkout URL", summaries);
      }

      setOrderSummaries(summaries);
      setDone(true);
      clear();
      toast({ title: "¡Pedidos confirmados!", description: "Tus pedidos están siendo preparados." });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo procesar el pedido. Intenta de nuevo.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (done && orderSummaries.length > 0) {
    return (
      <div className="min-h-screen bg-gradient-warm py-12 px-4 flex flex-col justify-center items-center">
        <MultiReceipt
          customerName={orderSummaries[0].customerName}
          deliveryAddress={orderSummaries[0].deliveryAddress}
          paymentMethod={orderSummaries[0].paymentMethod}
          orders={orderSummaries}
          promoCode={promo?.code}
        />
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-warm">
        <main className="container py-20 text-center max-w-md">
          <h1 className="text-3xl font-display font-bold">Tu carrito está vacío</h1>
          <p className="text-muted-foreground mt-2">Añade productos desde un negocio para continuar.</p>
          <Button asChild variant="hero" className="mt-6"><Link to="/negocios">Ver negocios</Link></Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-warm pb-12">
      <main className="container py-8 max-w-5xl">
        <Link to="/negocios" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-8 group">
          <div className="h-8 w-8 rounded-full bg-background shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
            <ArrowLeft className="h-4 w-4" />
          </div>
          <span className="font-semibold">Volver a la tienda</span>
        </Link>
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
          <div>
            <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-foreground">Finaliza tu pedido</h1>
            <p className="text-muted-foreground mt-2 text-lg">Estás a un paso de recibir tus productos favoritos.</p>
          </div>
          <div className="hidden md:flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <span className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center">1</span>
            <span className="text-primary font-bold">Checkout</span>
            <div className="h-px w-8 bg-border mx-1" />
            <span className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">2</span>
            <span>Rastreo</span>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_400px] gap-8">
          <form onSubmit={submit} className="space-y-8">
            {/* Sección de Entrega */}
            <section className="rounded-[2rem] bg-card/50 backdrop-blur-md border border-border/60 p-8 shadow-card hover:shadow-glow transition-all duration-500">
              <div className="flex items-center gap-4 mb-8">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
                  <MapPin className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-display font-bold">Dirección de entrega</h2>
                  <p className="text-sm text-muted-foreground">¿A dónde enviamos tu pedido?</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="customerName" className="ml-1 font-bold text-xs uppercase tracking-wider text-muted-foreground">Nombre completo</Label>
                  <Input 
                    key={initialData.name} 
                    id="customerName" 
                    name="customerName" 
                    required 
                    defaultValue={initialData.name}
                    className="h-12 rounded-xl border-border/60 focus:ring-primary/20 bg-background/50"
                    placeholder="Tu nombre"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="ml-1 font-bold text-xs uppercase tracking-wider text-muted-foreground">Teléfono de contacto</Label>
                  <Input 
                    key={initialData.phone} 
                    id="phone" 
                    name="phone" 
                    required 
                    type="tel" 
                    defaultValue={initialData.phone}
                    className="h-12 rounded-xl border-border/60 focus:ring-primary/20 bg-background/50"
                    placeholder="310 000 0000"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="address" className="ml-1 font-bold text-xs uppercase tracking-wider text-muted-foreground">Dirección exacta</Label>
                  <div className="relative group">
                    <Input 
                      id="address" 
                      name="address" 
                      required 
                      value={addressValue} 
                      onChange={(e) => {
                        setAddressValue(e.target.value);
                        setLatitude(null);
                        setLongitude(null);
                      }}
                      className="pr-12 h-14 rounded-xl border-primary/20 focus:border-primary focus:ring-primary/20 bg-background/50 font-medium"
                      placeholder="Ej: Calle 10 #5-20, Apto 301"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-primary group-focus-within:scale-110 transition-transform">
                      <MapPin className="h-5 w-5" />
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground font-medium mt-2 px-1 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary/40" />
                    Completa tu dirección manualmente o usa el botón de GPS para mayor precisión.
                  </p>
                </div>
                
                <div className="space-y-4 md:col-span-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={getCurrentLocation}
                    disabled={locationLoading}
                    className="w-full gap-3 h-14 rounded-2xl border-2 border-primary/20 text-primary hover:bg-primary/5 hover:border-primary/40 transition-all font-bold group"
                  >
                    {locationLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                        <span>Obteniendo ubicación...</span>
                      </div>
                    ) : (
                      <>
                        <LocateFixed className="h-5 w-5 group-hover:rotate-12 transition-transform" />
                        <span>Usar mi ubicación actual para calcular tarifa</span>
                      </>
                    )}
                  </Button>
                  
                  {latitude && longitude && (
                    <div className="bg-success/5 border-2 border-success/20 text-success text-xs p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                      <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center shrink-0">
                        <div className="h-3 w-3 rounded-full bg-success animate-pulse" />
                      </div>
                      <div>
                        <p className="font-bold text-sm">Ubicación GPS activada</p>
                        <p className="opacity-80">Tarifa calculada con precisión: {latitude.toFixed(4)}, {longitude.toFixed(4)}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="notes" className="ml-1 font-bold text-xs uppercase tracking-wider text-muted-foreground">Instrucciones para el repartidor</Label>
                  <Textarea 
                    id="notes" 
                    name="notes" 
                    placeholder="Piso, apto, indicaciones sobre la fachada o cómo llegar..." 
                    className="rounded-xl min-h-[100px] border-border/60 bg-background/50 focus:ring-primary/20"
                  />
                </div>
              </div>
            </section>

            {/* Sección de Pago */}
            <section className="rounded-[2rem] bg-card/50 backdrop-blur-md border border-border/60 p-8 shadow-card hover:shadow-glow transition-all duration-500">
              <div className="flex items-center gap-4 mb-8">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
                  <CreditCard className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-display font-bold">Método de pago</h2>
                  <p className="text-sm text-muted-foreground">Selecciona cómo prefieres pagar.</p>
                </div>
              </div>

              <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} name="paymentMethod" className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { v: "cash", l: "Efectivo", e: "💵", desc: "Al recibir" },
                  { v: "card", l: "Tarjeta", e: "💳", desc: "Con Wompi" },
                  { v: "wallet", l: "Billetera", e: "📱", desc: "Nequi/Davi" },
                ].map((o) => (
                  <Label 
                    key={o.v} 
                    htmlFor={o.v} 
                    className="flex flex-col items-center text-center gap-3 p-5 rounded-2xl border-2 border-border/60 cursor-pointer hover:bg-muted/40 hover:border-primary/20 has-[:checked]:border-primary has-[:checked]:bg-primary/5 transition-all duration-300 group relative"
                  >
                    <RadioGroupItem value={o.v} id={o.v} className="sr-only" />
                    <div className="h-14 w-14 rounded-2xl bg-background shadow-sm flex items-center justify-center text-3xl group-hover:scale-110 transition-transform mb-1">
                      {o.e}
                    </div>
                    <div>
                      <p className="font-bold text-foreground text-sm leading-none mb-1">{o.l}</p>
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">{o.desc}</p>
                    </div>
                    <div className="absolute top-3 right-3 h-5 w-5 rounded-full border-2 border-muted group-has-[:checked]:border-primary group-has-[:checked]:bg-primary flex items-center justify-center transition-colors">
                      <div className="h-1.5 w-1.5 rounded-full bg-white scale-0 group-has-[:checked]:scale-100 transition-transform" />
                    </div>
                  </Label>
                ))}
              </RadioGroup>
              
              <div className="mt-6 p-4 rounded-2xl bg-primary/5 border border-primary/10 flex items-start gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <AlertCircle className="h-4 w-4 text-primary" />
                </div>
                <p className="text-[11px] text-primary/80 font-medium leading-relaxed">
                  {paymentMethod === 'card' 
                    ? 'Serás redirigido a la pasarela segura de Wompi para completar tu pago con tarjeta o PSE.' 
                    : paymentMethod === 'wallet'
                    ? 'Prepara tu aplicación de Nequi o Daviplata para realizar la transferencia al recibir.'
                    : 'Asegúrate de tener el efectivo exacto o el cambio necesario para agilizar la entrega.'}
                </p>
              </div>
            </section>

            <div className="pt-4">
              <Button 
                type="submit" 
                variant="hero" 
                size="xl" 
                className="w-full h-20 text-xl font-display font-bold shadow-glow-primary rounded-[2rem] transition-all hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden group" 
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span>Procesando pedido...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-3">
                    <span>Confirmar y Pedir Ahora</span>
                    <span className="h-8 w-px bg-white/20 mx-2" />
                    <span>{formatCOP(total)}</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              </Button>
              <p className="text-center text-xs text-muted-foreground mt-4 font-medium italic">
                * Al confirmar, aceptas los términos y condiciones de Fasty.
              </p>
            </div>
          </form>

          {/* Resumen Sidebar */}
          <aside className="space-y-6 lg:sticky lg:top-24 h-fit">
            <div className="rounded-[2rem] bg-card border border-border/60 p-8 shadow-card overflow-hidden relative">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <Store className="h-24 w-24" />
              </div>
              
              <h2 className="text-2xl font-display font-bold mb-6 flex items-center gap-2">
                Resumen del pedido
              </h2>

              <div className="space-y-8 max-h-[40vh] overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-primary/10 hover:scrollbar-thumb-primary/20 transition-colors">
                {Array.from(new Set(lines.map(l => l.businessName))).map(businessName => {
                  const businessLines = lines.filter(l => l.businessName === businessName);
                  return (
                    <div key={businessName} className="space-y-4 animate-in fade-in slide-in-from-right-4">
                      <div className="flex items-center justify-between border-b border-border/50 pb-2">
                        <p className="text-sm font-bold text-primary flex items-center gap-2">
                          <Store className="h-4 w-4" /> {businessName}
                        </p>
                        <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase tracking-tighter">
                          {businessLines.length} {businessLines.length === 1 ? 'item' : 'items'}
                        </span>
                      </div>
                      <div className="space-y-4 pl-1">
                        {businessLines.map((l) => (
                          <div key={l.item.id} className="flex gap-4 group">
                            <div className="h-12 w-12 rounded-xl bg-muted/30 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                              {l.item.emoji}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-sm truncate">{l.item.name}</p>
                              <p className="text-xs text-muted-foreground font-medium">Cantidad: {l.qty}</p>
                            </div>
                            <span className="font-bold text-sm">{formatCOP(l.item.price * l.qty)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Coupons Section */}
              {benefitsData && benefitsData.benefits && benefitsData.benefits.length > 0 && (
                <div className="mt-8 pt-6 border-t border-border/60">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                    <Ticket className="h-4 w-4 text-primary" /> Cupones Disponibles
                  </p>
                  <div className="space-y-3">
                    {benefitsData.benefits.map((benefit: any) => {
                      const isSelected = promo?.code === benefit.code;
                      return (
                        <button
                          key={benefit.code}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              applyPromo("", 0);
                            } else {
                              applyPromo(benefit.code, benefit.discount);
                              toast({ title: "Cupón aplicado", description: `Se aplicó ${benefit.discount}% de descuento en el domicilio.` });
                            }
                          }}
                          className={`w-full text-left p-4 rounded-2xl border-2 transition-all group ${
                            isSelected
                              ? "bg-primary/10 border-primary shadow-sm"
                              : "bg-background/50 border-transparent hover:border-primary/20 hover:bg-muted/30"
                          }`}
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-sm group-hover:text-primary transition-colors">{benefit.code}</span>
                            <span className="font-black text-xs bg-primary text-white px-2 py-0.5 rounded-lg">{benefit.discount}% OFF</span>
                          </div>
                          <p className={`text-[11px] leading-relaxed ${isSelected ? "text-primary/80" : "text-muted-foreground"}`}>
                            {benefit.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Totals Section */}
              <div className="mt-8 pt-6 border-t-2 border-dashed border-border/60 space-y-4">
                <div className="flex justify-between items-center text-sm font-medium text-muted-foreground">
                  <span>Subtotal productos</span>
                  <span className="text-foreground font-bold">{formatCOP(subtotal)}</span>
                </div>
                
                <div className="flex justify-between items-start text-sm font-medium text-muted-foreground">
                  <div className="flex flex-col">
                    <span>Costo de envío</span>
                    {isNightFeeTime() && (
                      <span className="text-[10px] text-primary font-bold flex items-center gap-1">
                        <div className="h-1 w-1 rounded-full bg-primary animate-pulse" />
                        Incluye recargo nocturno
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-foreground font-bold">{formatCOP(fee)}</span>
                  </div>
                </div>

                {promo && (
                  <div className="flex justify-between items-center text-sm font-bold text-success animate-in slide-in-from-left-2">
                    <span className="flex items-center gap-1.5">
                      <Ticket className="h-3.5 w-3.5" /> 
                      Cupón ({promo.code})
                    </span>
                    <span>-{formatCOP(discount)}</span>
                  </div>
                )}

                {!latitude && !longitude && (
                  <div className="bg-orange-500/5 border border-orange-500/10 rounded-xl p-3 text-[10px] text-orange-600 leading-relaxed italic">
                    * La tarifa de envío es estimada. Usa GPS para obtener el valor exacto según la distancia.
                  </div>
                )}

                <div className="pt-4 border-t border-border/60">
                  <div className="flex justify-between items-end">
                    <span className="font-display font-bold text-lg">Total a pagar</span>
                    <div className="text-right">
                      <span className="block text-3xl font-display font-black text-primary tracking-tight">
                        {formatCOP(total)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-primary/5 rounded-2xl p-4 border border-primary/10 flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <Ticket className="h-4 w-4 text-primary" />
              </div>
              <p className="text-[11px] text-primary/80 font-medium leading-relaxed">
                ¡Recuerda! En Fasty premiamos tu fidelidad. Entre más pidas, más cupones de descuento recibirás para tus envíos.
              </p>
            </div>
          </aside>
        </div>
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

export default Checkout;
