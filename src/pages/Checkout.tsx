import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CreditCard, MapPin, LocateFixed, Store, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { formatCOP } from "@/data/mock";
import { toast } from "@/hooks/use-toast";
import MultiReceipt from "@/components/MultiReceipt";

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

    const additionalFees = (uniqueBusinessIds.length - 1) * 2000;
    return baseFee + additionalFees;
  };

  const fee = calculateTotalFee();
  const numBusinesses = new Set(lines.map(l => String(l.businessId))).size;
  const rawDiscount = promo ? (fee * promo.discount / 100) : 0;
  const discount = Math.min(fee, rawDiscount);
  const total = subtotal + fee - discount;

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      setLocationLoading(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
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
                toast({ title: "Ubicación obtenida", description: "Dirección actualizada automáticamente." });
              } else {
                toast({ title: "Ubicación obtenida", description: "Coordenadas actualizadas." });
              }
            }
          } catch (err) {
            console.error("Error in reverse geocoding:", err);
            toast({ title: "Ubicación obtenida", description: "Coordenadas actualizadas (no se pudo obtener la dirección)." });
          } finally {
            setLocationLoading(false);
          }
        },
        (error) => {
          console.error("Error getting location:", error);
          setLocationLoading(false);
          toast({
            title: "Error de ubicación",
            description: "No se pudo obtener la ubicación. Asegúrate de dar permisos.",
            variant: "destructive",
          });
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      toast({
        title: "Geolocalización no soportada",
        description: "Tu navegador no soporta la geolocalización.",
        variant: "destructive",
      });
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.target as HTMLFormElement);
    const customerName = formData.get("customerName") as string;
    const customerPhone = formData.get("phone") as string;
    const deliveryAddress = formData.get("address") as string;
    const paymentMethod = formData.get("paymentMethod") as string;
    const notes = formData.get("notes") as string;

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
        }

        const bSubtotal = bLines.reduce((s, l) => s + l.qty * l.item.price, 0);
        const rawBDiscount = promo ? (bFee * promo.discount / 100) : 0;
        const bDiscount = Math.min(bFee, rawBDiscount);
        const bTotal = bSubtotal + bFee - bDiscount;

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
          total: bTotal
        });
      });

      await Promise.all(orderPromises);

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
    <div className="min-h-screen bg-gradient-warm">
      <main className="container py-10 max-w-5xl">
        <Link to="/negocios" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> Seguir comprando
        </Link>
        <h1 className="text-4xl font-display font-bold tracking-tight mb-8">Finaliza tu pedido</h1>

        <div className="grid lg:grid-cols-[1fr_380px] gap-6">
          <form onSubmit={submit} className="space-y-6">
            <section className="rounded-2xl bg-card border border-border/60 p-6 shadow-card">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><MapPin className="h-5 w-5 text-primary" /> Dirección de entrega</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="customerName">Nombre completo</Label>
                  <Input key={initialData.name} id="customerName" name="customerName" required defaultValue={initialData.name} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input key={initialData.phone} id="phone" name="phone" required type="tel" defaultValue={initialData.phone} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="address">Dirección de entrega</Label>
                  <div className="relative">
                    <Input 
                      id="address" 
                      name="address" 
                      required 
                      readOnly
                      value={addressValue} 
                      className="pr-10 bg-muted/30 cursor-not-allowed font-medium border-primary/20"
                      placeholder="Usa el botón de abajo para obtener tu ubicación"
                    />
                    <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-primary animate-pulse" />
                  </div>
                  <p className="text-[10px] text-primary font-bold uppercase tracking-widest mt-1">
                    * No se permite ingresar la dirección manualmente para asegurar la precisión del envío.
                  </p>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Button
                    type="button"
                    variant="hero"
                    onClick={getCurrentLocation}
                    disabled={locationLoading}
                    className="w-full gap-2 h-12 shadow-glow"
                  >
                    {locationLoading ? "Obteniendo ubicación..." : <><LocateFixed className="h-5 w-5" /> Obtener mi ubicación exacta (GPS)</>}
                  </Button>
                  {!latitude && (
                    <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs p-3 rounded-xl flex items-center gap-2 mt-2">
                      <LocateFixed className="h-4 w-4" />
                      Debes obtener tu ubicación para calcular el envío y confirmar el pedido.
                    </div>
                  )}
                  {latitude && longitude && (
                    <div className="bg-success/10 border border-success/20 text-success text-xs p-3 rounded-xl flex items-center gap-2 mt-2">
                      <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
                      Ubicación verificada: {latitude.toFixed(6)}, {longitude.toFixed(6)}
                    </div>
                  )}
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="notes">Indicaciones adicionales</Label>
                  <Textarea id="notes" name="notes" placeholder="Piso, apto, color de casa o indicaciones para el repartidor" />
                </div>
              </div>
            </section>

            <section className="rounded-2xl bg-card border border-border/60 p-6 shadow-card">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" /> Método de pago</h2>
              <RadioGroup defaultValue="cash" name="paymentMethod" className="grid sm:grid-cols-2 gap-3">
                {[
                  { v: "cash", l: "Efectivo", e: "💵" },
                ].map((o) => (
                  <Label key={o.v} htmlFor={o.v} className="flex items-center gap-3 p-4 rounded-xl border border-border cursor-pointer hover:bg-muted/40 has-[:checked]:border-primary has-[:checked]:bg-primary/5 transition-all">
                    <RadioGroupItem value={o.v} id={o.v} />
                    <span className="text-xl">{o.e}</span>
                    <span className="font-medium">{o.l}</span>
                  </Label>
                ))}
              </RadioGroup>
            </section>

            <Button 
              type="submit" 
              variant="hero" 
              size="xl" 
              className="w-full h-16 text-lg shadow-glow" 
              disabled={loading || !latitude}
            >
              {loading ? "Procesando..." : !latitude ? "Obtén tu ubicación para continuar" : `Confirmar pedido · ${formatCOP(total)}`}
            </Button>
          </form>

          <aside className="rounded-2xl bg-card border border-border/60 p-6 shadow-card h-fit lg:sticky lg:top-24">
            <h2 className="text-lg font-bold mb-4">Resumen de tu pedido</h2>

            <div className="space-y-6 max-h-64 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-muted">
              {Array.from(new Set(lines.map(l => l.businessName))).map(businessName => {
                const businessLines = lines.filter(l => l.businessName === businessName);
                return (
                  <div key={businessName} className="space-y-3">
                    <p className="text-sm font-bold text-primary flex items-center gap-1.5 border-b border-border/50 pb-1">
                      <Store className="h-4 w-4" /> {businessName}
                    </p>
                    {businessLines.map((l) => (
                      <div key={l.item.id} className="flex gap-3 text-sm pl-2">
                        <span className="text-2xl">{l.item.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate">{l.item.name}</p>
                          <p className="text-xs text-muted-foreground">x{l.qty}</p>
                        </div>
                        <span className="font-semibold">{formatCOP(l.item.price * l.qty)}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>

            {benefitsData && benefitsData.benefits && benefitsData.benefits.length > 0 && (
              <div className="mt-5 pt-4 border-t border-border/60">
                <p className="text-sm font-bold mb-3 flex items-center gap-2">
                  <Ticket className="h-4 w-4 text-primary" /> Cupones Disponibles
                </p>
                <div className="space-y-2">
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
                        className={`w-full text-left p-3 rounded-xl border text-sm transition-all ${
                          isSelected
                            ? "bg-primary/10 border-primary text-primary"
                            : "bg-muted/50 border-transparent hover:border-border"
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold">{benefit.code}</span>
                          <span className="font-bold text-xs">{benefit.discount}% OFF</span>
                        </div>
                        <p className={`text-xs ${isSelected ? "text-primary/80" : "text-muted-foreground"}`}>
                          {benefit.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-5 pt-4 border-t border-border space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatCOP(subtotal)}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>Envío</span><span>{formatCOP(fee)}</span></div>
              {promo && (
                <div className="flex justify-between text-success font-medium">
                  <span>Descuento ({promo.code})</span>
                  <span>-{formatCOP(discount)}</span>
                </div>
              )}
              {latitude && longitude && (
                <div className="text-[10px] text-muted-foreground italic text-right mt-1">
                  * Tarifa calculada según distancia.
                </div>
              )}
              <div className="flex justify-between font-display font-bold text-xl pt-2"><span>Total</span><span>{formatCOP(total)}</span></div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
};

export default Checkout;
