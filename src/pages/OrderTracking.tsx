import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Package,
  MapPin,
  Clock,
  CheckCircle2,
  Search,
  Loader2,
  Phone,
  ArrowLeft,
  ChevronRight,
  Bike,
  Star,
  Send,
  MessageCircle,
  Store
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatCOP } from "@/data/mock";
import DeliveryMap from "@/components/DeliveryMap";
import { useToast } from "@/components/ui/use-toast";
import { getWebSocketUrl } from "@/lib/utils";

interface OrderLog {
  status: string;
  changed_at: string;
}

interface OrderItem {
  name: string;
  price: number;
  quantity: number;
  emoji: string;
}

interface OrderDetail {
  id: string;
  user_id: number;
  order_type?: "standard" | "open";
  status: "pending" | "preparing" | "shipped" | "in_transit" | "delivered" | "cancelled";
  customer_name: string;
  delivery_address: string;
  total: number;
  latitude: number | null;
  longitude: number | null;
  courier_lat: number | null;
  courier_lng: number | null;
  business_lat: number | null;
  business_lng: number | null;
  business_name: string;
  business_emoji?: string;
  items: OrderItem[];
  logs: OrderLog[];
  created_at: string;
  is_rated: boolean;
  courier_id: number | null;
  courier_name?: string;
  courier_image?: string;
  courier_vehicle?: string;
  courier_phone?: string;
  courier_rating?: number;
  estimated_delivery_minutes?: number | null;
  eta_text?: string | null;
  offers?: Array<{
    id: number;
    courier_name?: string;
    courier_vehicle?: string;
    courier_rating?: number;
    amount: number;
    status: string;
  }>;
}

const OrderTracking = () => {
  const { orderId: urlOrderId } = useParams();
  const { toast } = useToast();
  const [searchId, setSearchId] = useState(urlOrderId || "");
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(!!urlOrderId);
  const [error, setError] = useState<string | null>(null);
  const [bizRating, setBizRating] = useState(5);
  const [courierRating, setCourierRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submittingRating, setSubmittingRating] = useState(false);
  const [ratedLocally, setRatedLocally] = useState(false);
  const orderRef = useRef<OrderDetail | null>(null);

  const fetchOrder = async (id: string, silent = false) => {
    if (!silent) {
      setLoading(true);
    }
    setError(null);
    try {
      const response = await fetch(`/api/orders/${id}`);
      if (!response.ok) {
        throw new Error("Pedido no encontrado. Verifica el ID.");
      }
      const data = await response.json();
      setOrder(data);
      orderRef.current = data;
    } catch (err: any) {
      setError(err.message);
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (urlOrderId) {
      fetchOrder(urlOrderId);
      const interval = setInterval(() => {
        fetchOrder(urlOrderId, true);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [urlOrderId]);

  // WebSocket for real-time notifications
  useEffect(() => {
    // Usamos urlOrderId o el id del pedido actual
    const targetUserId = orderRef.current?.user_id;
    if (!targetUserId) return;

    const connect = () => {
      const url = getWebSocketUrl(`/ws/user/${targetUserId}`);
      if (!url) return;

      const ws = new WebSocket(url);

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        const currentOrder = orderRef.current;

        if (message.type === "courier_location_update" && currentOrder && message.order_id === currentOrder.id) {
          setOrder(prev => prev ? {
            ...prev,
            courier_lat: message.lat,
            courier_lng: message.lng
          } : null);
          if (orderRef.current) {
            orderRef.current.courier_lat = message.lat;
            orderRef.current.courier_lng = message.lng;
          }
        } else if (message.type === "order_status_update" && currentOrder && message.order_id === currentOrder.id) {
          setOrder(prev => prev ? {
            ...prev,
            status: message.status as any
          } : null);
          if (orderRef.current) {
            orderRef.current.status = message.status as any;
          }

          toast({
            title: "Pedido actualizado",
            description: `Tu pedido ahora está en estado: ${message.status}`,
          });
        } else if (message.type === "order_offer" && currentOrder && message.order_id === currentOrder.id) {
          toast({
            title: "Nueva oferta recibida",
            description: message.message || `Un domiciliario ofreció ${message.amount}`,
          });

          setOrder(prev => {
            if (!prev) return prev;
            const existingOffers = prev.offers || [];
            const newOfferId = message.offer_id || Date.now();
            const alreadyExists = existingOffers.some((offer) => offer.id === newOfferId || (offer.courier_id === message.courier_id && offer.amount === message.amount));
            if (alreadyExists) {
              return prev;
            }
            return {
              ...prev,
              offers: [
                ...existingOffers,
                {
                  id: newOfferId,
                  courier_id: message.courier_id,
                  courier_name: message.courier_name,
                  amount: message.amount,
                  status: 'pending'
                }
              ]
            };
          });
        }
      };

      ws.onclose = () => setTimeout(connect, 5000);
    };

    connect();
  }, [order?.user_id]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchId) {
      fetchOrder(searchId);
    }
  };

  const handleRate = async () => {
    if (!order) return;
    setSubmittingRating(true);
    try {
      const response = await fetch(`/api/orders/${order.id}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_rating: bizRating,
          courier_rating: order.courier_id ? courierRating : null,
          comment: comment
        })
      });
      if (response.ok) {
        setRatedLocally(true);
      }
    } catch (err) {
      console.error("Error rating:", err);
    } finally {
      setSubmittingRating(false);
    }
  };

  const handleAcceptOffer = async (offerId: number) => {
    if (!order) return;
    try {
      const response = await fetch(`/api/orders/${order.id}/offers/${offerId}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "No se pudo aceptar la oferta");
      }
      toast({
        title: "Oferta aceptada",
        description: "El domiciliario fue notificado."
      });
      fetchOrder(order.id, true);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const statusSteps = [
    { id: "pending", label: "Confirmado", icon: CheckCircle2 },
    { id: "preparing", label: "Preparando", icon: Clock },
    { id: "shipped", label: "Asignado", icon: Bike },
    { id: "in_transit", label: "En camino", icon: Bike },
    { id: "delivered", label: "Entregado", icon: Package },
  ];

  const currentStepIndex = order ? statusSteps.findIndex(s => s.id === order.status) : -1;

  return (
    <div className="min-h-screen bg-gradient-warm pb-20">
      <main className="container max-w-5xl pt-8 px-4">
        <Link to="/negocios" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-8 group">
          <div className="h-8 w-8 rounded-full bg-background shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
            <ArrowLeft className="h-4 w-4" />
          </div>
          <span className="font-semibold">Volver a la tienda</span>
        </Link>

        {!order && !loading && (
          <div className="max-w-md mx-auto text-center mt-12 bg-card/50 backdrop-blur-md border border-border/60 rounded-[2.5rem] p-10 shadow-card hover:shadow-glow transition-all duration-500">
            <div className="h-20 w-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-6 rotate-3 group-hover:rotate-0 transition-transform">
              <Search className="h-10 w-10 text-primary" />
            </div>
            <h1 className="text-3xl font-display font-bold mb-3 tracking-tight">Rastrea tu pedido</h1>
            <p className="text-muted-foreground mb-8 text-sm leading-relaxed">Ingresa el ID de tu pedido para ver su estado actual en tiempo real.</p>
            <form onSubmit={handleSearch} className="space-y-4">
              <Input
                placeholder="Ej: ORD-723A"
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                className="h-14 rounded-2xl border-border/60 focus:ring-primary/20 bg-background/50 text-center font-mono text-lg uppercase"
              />
              <Button type="submit" variant="hero" size="xl" className="w-full rounded-2xl h-14 font-display font-bold shadow-glow-primary">
                Buscar mi pedido
              </Button>
            </form>
            {error && (
              <div className="mt-6 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-bold animate-in shake">
                {error}
              </div>
            )}
          </div>
        )}

        {loading && !order && (
          <div className="flex flex-col items-center justify-center py-24 animate-in fade-in zoom-in-95">
            <div className="relative">
              <div className="h-20 w-20 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
              <Search className="h-8 w-8 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
            </div>
            <p className="text-foreground font-display font-bold text-xl mt-6">Localizando tu pedido...</p>
            <p className="text-muted-foreground text-sm mt-1 italic">Conectando con el centro de logística</p>
          </div>
        )}

        {order && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="space-y-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest border border-primary/20">
                    Rastreo en vivo
                  </span>
                </div>
                <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight">Estado del Pedido</h1>
                <p className="text-muted-foreground text-lg">Referencia: <span className="font-mono text-primary font-black uppercase">{order.id}</span></p>
              </div>
              
              <div className="flex flex-wrap items-center gap-3">
                {order.eta_text && order.status !== 'delivered' && order.status !== 'cancelled' && (
                  <div className="inline-flex items-center gap-2 rounded-2xl border-2 border-primary/20 bg-primary/5 px-4 py-3 text-sm font-black text-primary animate-pulse">
                    <Clock className="h-5 w-5" />
                    Llega en {order.eta_text}
                  </div>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" size="lg" onClick={() => fetchOrder(order.id)} className="rounded-2xl h-12 border-2 border-border/60 hover:bg-muted font-bold px-6">
                    Actualizar
                  </Button>
                  {!urlOrderId && (
                    <Button variant="ghost" size="lg" onClick={() => setOrder(null)} className="rounded-2xl h-12 font-bold px-6">
                      Nueva búsqueda
                    </Button>
                  )}
                </div>
              </div>
            </header>

            {/* Stepper Modernizado */}
            <div className="bg-card/50 backdrop-blur-md border border-border/60 rounded-[2.5rem] p-8 md:p-12 shadow-card overflow-hidden relative">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <Package className="h-32 w-32" />
              </div>

              <div className="relative flex justify-between max-w-3xl mx-auto">
                {/* Línea de fondo */}
                <div className="absolute top-6 left-0 w-full h-1.5 bg-muted/40 rounded-full -z-0" />
                {/* Línea de progreso */}
                <div
                  className="absolute top-6 left-0 h-1.5 bg-primary transition-all duration-1000 ease-out rounded-full -z-0 shadow-glow-primary"
                  style={{ width: `${(Math.max(0, currentStepIndex) / (statusSteps.length - 1)) * 100}%` }}
                />

                {statusSteps.map((step, idx) => {
                  const Icon = step.icon;
                  const isCompleted = idx <= currentStepIndex;
                  const isCurrent = idx === currentStepIndex;

                  return (
                    <div key={step.id} className="relative z-10 flex flex-col items-center flex-1">
                      <div className={`
                        h-12 w-12 rounded-2xl flex items-center justify-center border-4 transition-all duration-500
                        ${isCompleted ? 'bg-primary border-primary text-primary-foreground shadow-glow-primary' : 'bg-background border-muted/40 text-muted-foreground'}
                        ${isCurrent ? 'scale-125 ring-8 ring-primary/10 -rotate-3' : ''}
                      `}>
                        <Icon className={`h-6 w-6 ${isCurrent ? 'animate-bounce' : ''}`} />
                      </div>
                      <span className={`mt-4 text-[8px] md:text-[10px] font-black uppercase tracking-tighter text-center leading-none max-w-[60px] md:max-w-none transition-colors ${isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid lg:grid-cols-[1fr_400px] gap-8">
              {/* Columna Izquierda: Mapa o Estado Visual */}
              <div className="space-y-8">
                <div className="bg-card border border-border/60 rounded-[2rem] overflow-hidden shadow-card h-[400px] md:h-[500px] relative group">
                  {order.status === 'shipped' || order.status === 'in_transit' ? (
                    <DeliveryMap
                      pickup={order.order_type === 'open' ? undefined : {
                        lat: order.business_lat || 4.67,
                        lng: order.business_lng || -74.05,
                        label: order.business_name || "Restaurante",
                        emoji: order.business_emoji
                      }}
                      dropoff={{
                        lat: order.latitude || 4.68,
                        lng: order.longitude || -74.06,
                        label: "Tu destino"
                      }}
                      courier={order.courier_lat && order.courier_lng ? {
                        lat: order.courier_lat,
                        lng: order.courier_lng,
                        label: "Tu domiciliario"
                      } : undefined}
                    />
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center p-12 text-center bg-muted/10 relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
                      <div className="relative z-10">
                        <div className="h-28 w-28 rounded-[2.5rem] bg-primary/10 flex items-center justify-center text-primary mb-8 shadow-inner rotate-6 transition-transform group-hover:rotate-0">
                          {order.status === 'delivered' ? <CheckCircle2 className="h-14 w-14" /> : <Clock className="h-14 w-14 animate-pulse" />}
                        </div>
                        <h3 className="font-display font-black text-3xl mb-4 tracking-tight">
                          {order.status === 'delivered' ? '¡Pedido Entregado!' :
                            order.status === 'preparing' ? 'Preparando tu pedido' :
                              'Esperando confirmación'}
                        </h3>
                        <p className="text-muted-foreground text-lg max-w-sm mx-auto leading-relaxed font-medium">
                          {order.status === 'delivered' ? 'Esperamos que disfrutes tu pedido. ¡Gracias por confiar en Fasty!' :
                            order.status === 'preparing' ? 'El restaurante está preparando todo con los mejores ingredientes.' :
                              'Tu pedido está en proceso de ser aceptado por el restaurante.'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Historial de estados (Logs) */}
                <div className="bg-card/50 backdrop-blur-sm border border-border/60 rounded-[2rem] p-8 shadow-card">
                  <h3 className="text-xl font-display font-bold mb-6 flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" /> Historial de estados
                  </h3>
                  <div className="space-y-6 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-muted/40">
                    {order.logs?.map((log, idx) => (
                      <div key={idx} className="flex gap-6 relative">
                        <div className={`h-6 w-6 rounded-full border-4 border-card z-10 shrink-0 ${idx === 0 ? 'bg-primary shadow-glow-primary scale-125' : 'bg-muted'}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-bold capitalize ${idx === 0 ? 'text-primary' : 'text-foreground'}`}>
                            {log.status === 'pending' ? 'Pedido Confirmado' : 
                             log.status === 'preparing' ? 'En Preparación' :
                             log.status === 'shipped' ? 'Domiciliario Asignado' :
                             log.status === 'in_transit' ? 'En Camino al Destino' :
                             log.status === 'delivered' ? 'Pedido Entregado' :
                             log.status === 'cancelled' ? 'Pedido Cancelado' : log.status}
                          </p>
                          <p className="text-xs text-muted-foreground font-medium mt-1">
                            {new Date(log.changed_at).toLocaleString('es-CO', {
                              weekday: 'long',
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Columna Derecha: Información y Resumen */}
              <aside className="space-y-8 lg:sticky lg:top-24 h-fit">
                {/* Ofertas de Domiciliarios (Solo para Pedidos Abiertos) */}
                {order.order_type === 'open' && !order.courier_id && (
                  <div className="bg-card border-2 border-primary/20 rounded-[2rem] p-8 shadow-glow animate-in slide-in-from-right-4">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-display font-bold">Ofertas activas</h3>
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
                        <div className="h-2 w-2 rounded-full bg-primary" />
                      </div>
                    </div>
                    
                    {(order.offers || []).filter(offer => offer.status === 'pending').length === 0 ? (
                      <div className="rounded-2xl bg-primary/5 p-6 text-center border border-dashed border-primary/20">
                        <Loader2 className="h-8 w-8 text-primary/40 mx-auto mb-3 animate-spin" />
                        <p className="text-sm font-medium text-primary/70">Esperando que los domiciliarios propongan una tarifa...</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {(order.offers || []).filter(offer => offer.status === 'pending').map((offer) => (
                          <div key={offer.id} className="rounded-2xl border border-border/60 bg-background/50 p-4 hover:border-primary/40 transition-all group">
                            <div className="flex items-center gap-4 mb-3">
                              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black">
                                {offer.courier_name?.charAt(0) || "D"}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-sm truncate">{offer.courier_name || "Domiciliario Fasty"}</p>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                                    <Star className="h-2.5 w-2.5 fill-yellow-400 text-yellow-400" /> {offer.courier_rating || "Nuevo"}
                                  </span>
                                  <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                                    <Bike className="h-2.5 w-2.5" /> {offer.courier_vehicle || "Bici/Moto"}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center justify-between gap-3 pt-3 border-t border-border/50">
                              <span className="font-display font-black text-xl text-primary">{formatCOP(offer.amount)}</span>
                              <Button size="sm" variant="hero" className="rounded-xl px-4 h-9 shadow-glow-primary group-hover:scale-105 transition-transform" onClick={() => handleAcceptOffer(offer.id)}>
                                Aceptar
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Resumen Estilo Recibo */}
                <div className="bg-card border border-border/60 rounded-[2rem] p-8 shadow-card overflow-hidden relative">
                  <div className="absolute top-0 right-0 p-8 opacity-5">
                    <Store className="h-20 w-20" />
                  </div>
                  
                  <h3 className="text-xl font-display font-bold mb-6 flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" /> Resumen del pedido
                  </h3>

                  <div className="space-y-6 max-h-[30vh] overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-primary/10">
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                      <div className="flex items-center justify-between border-b border-border/50 pb-2">
                        <p className="text-xs font-bold text-primary flex items-center gap-2 uppercase tracking-widest">
                          <Store className="h-3.5 w-3.5" /> {order.business_name || "Establecimiento"}
                        </p>
                      </div>
                      <div className="space-y-4 pl-1">
                        {order.items?.map((item, idx) => (
                          <div key={idx} className="flex gap-4 group">
                            <div className="h-10 w-10 rounded-xl bg-muted/30 flex items-center justify-center text-xl group-hover:scale-110 transition-transform shrink-0">
                              {item.emoji || "📦"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-sm truncate">{item.name}</p>
                              <p className="text-xs text-muted-foreground font-medium">Cantidad: {item.quantity}</p>
                            </div>
                            <span className="font-bold text-sm shrink-0">{formatCOP(item.price * item.quantity)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 pt-6 border-t-2 border-dashed border-border/60">
                    <div className="flex justify-between items-end">
                      <span className="font-display font-bold text-base">Total pagado</span>
                      <div className="text-right">
                        <span className="block text-3xl font-display font-black text-primary tracking-tight">
                          {formatCOP(order.total)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Detalles de Entrega */}
                <div className="bg-card/50 backdrop-blur-sm border border-border/60 rounded-[2rem] p-8 shadow-card space-y-6">
                  <div className="flex gap-4">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0 shadow-inner">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Entregar en</p>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.delivery_address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-bold hover:text-primary transition-colors leading-relaxed block"
                      >
                        {order.delivery_address}
                      </a>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0 shadow-inner">
                      <Star className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Cliente</p>
                      <p className="text-sm font-bold truncate">{order.customer_name}</p>
                    </div>
                  </div>
                </div>

                {/* Info del Domiciliario Premium */}
                {order.courier_id && (
                  <div className="bg-primary/5 rounded-[2.5rem] border-2 border-primary/20 p-8 shadow-glow animate-in zoom-in-95">
                    <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-6 text-center">Tu Domiciliario Asignado</p>
                    
                    <div className="flex flex-col items-center text-center space-y-4 mb-8">
                      <div className="relative">
                        <div className="h-24 w-24 rounded-[2rem] overflow-hidden border-4 border-white shadow-xl rotate-3">
                          {order.courier_image ? (
                            <img src={order.courier_image} alt={order.courier_name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full bg-primary/10 flex items-center justify-center text-primary">
                              <Bike className="h-10 w-10" />
                            </div>
                          )}
                        </div>
                        <div className="absolute -bottom-2 -right-2 bg-success h-6 w-6 rounded-full border-4 border-card flex items-center justify-center shadow-lg">
                          <CheckCircle2 className="h-3 w-3 text-white" />
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="text-2xl font-display font-black tracking-tight">{order.courier_name || "Socio Fasty"}</h4>
                        <div className="flex items-center justify-center gap-3 mt-1">
                          <span className="flex items-center gap-1 text-xs font-bold text-muted-foreground">
                            <Bike className="h-3.5 w-3.5" /> {order.courier_vehicle || "Transporte"}
                          </span>
                          <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                          <span className="flex items-center gap-1 text-xs font-bold text-yellow-600 bg-yellow-400/10 px-2 py-0.5 rounded-lg border border-yellow-400/20">
                            <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" /> {Number(order.courier_rating || 5.0).toFixed(1)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {order.courier_phone && (
                      <div className="grid grid-cols-1 gap-3">
                        <Button variant="hero" size="xl" className="h-14 rounded-2xl gap-3 font-display font-bold shadow-glow-primary group" asChild>
                          <a href={`tel:${order.courier_phone}`}>
                            <Phone className="h-5 w-5 group-hover:rotate-12 transition-transform" /> 
                            Llamar al domiciliario
                          </a>
                        </Button>
                        <Button variant="outline" size="xl" className="h-14 rounded-2xl gap-3 font-display font-bold border-2 border-success/30 text-success hover:bg-success/5 group" asChild>
                          <a
                            href={`https://wa.me/57${order.courier_phone.replace(/\D/g, '')}?text=${encodeURIComponent(`¡Hola! Soy cliente de Fasty, estoy rastreando mi pedido #${order.id}. ¿Cómo vas?`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <MessageCircle className="h-5 w-5 group-hover:scale-110 transition-transform" /> 
                            WhatsApp Directo
                          </a>
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </aside>
            </div>

            {/* Sección de Calificación (Solo cuando se entrega) */}
            {order.status === 'delivered' && !order.is_rated && !ratedLocally && (
              <div className="bg-card/50 backdrop-blur-md border-2 border-primary/20 rounded-[3rem] p-10 md:p-16 shadow-glow animate-in zoom-in-95 relative overflow-hidden text-center max-w-3xl mx-auto mt-12">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-yellow-400 via-primary to-yellow-400" />
                
                <div className="h-24 w-24 bg-primary/10 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-inner">
                  <Star className="h-12 w-12 text-primary fill-primary animate-pulse" />
                </div>
                
                <h2 className="text-4xl font-display font-black tracking-tight mb-4">¿Qué tal estuvo todo?</h2>
                <p className="text-muted-foreground text-lg mb-12 max-w-md mx-auto leading-relaxed">Tu opinión es el motor de Fasty. Ayúdanos a premiar a los mejores domiciliarios y restaurantes.</p>

                <div className="grid md:grid-cols-2 gap-12 mb-12">
                  <div className="space-y-4">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">La comida / Productos</p>
                    <div className="flex justify-center gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button key={star} onClick={() => setBizRating(star)} className="group transition-all active:scale-90">
                          <Star className={`h-10 w-10 transition-all ${star <= bizRating ? 'text-yellow-400 fill-yellow-400 scale-110' : 'text-muted-foreground/20 group-hover:text-yellow-400/40'}`} />
                        </button>
                      ))}
                    </div>
                  </div>

                  {order.courier_id && (
                    <div className="space-y-4">
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">El Servicio de Entrega</p>
                      <div className="flex justify-center gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button key={star} onClick={() => setCourierRating(star)} className="group transition-all active:scale-90">
                            <Star className={`h-10 w-10 transition-all ${star <= courierRating ? 'text-yellow-400 fill-yellow-400 scale-110' : 'text-muted-foreground/20 group-hover:text-yellow-400/40'}`} />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="max-w-md mx-auto space-y-6">
                  <Textarea
                    placeholder="Escribe algo sobre tu experiencia (opcional)..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="min-h-[100px] rounded-2xl border-border/60 bg-background/50 focus:ring-primary/20 text-center text-lg italic"
                  />
                  <Button
                    onClick={handleRate}
                    disabled={submittingRating}
                    variant="hero"
                    size="xl"
                    className="w-full h-16 rounded-2xl text-xl font-display font-bold shadow-glow-primary group"
                  >
                    {submittingRating ? (
                      <Loader2 className="animate-spin h-6 w-6" />
                    ) : (
                      <>
                        <Send className="mr-3 h-6 w-6 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" /> 
                        Enviar mi Calificación
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {ratedLocally && (
              <div className="bg-success/5 border-2 border-success/20 rounded-[3rem] p-12 text-center animate-in zoom-in-95 max-w-2xl mx-auto mt-12">
                <div className="h-20 w-20 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="h-10 w-10 text-success" />
                </div>
                <h3 className="text-3xl font-display font-black text-success tracking-tight mb-2">¡Muchas gracias!</h3>
                <p className="text-muted-foreground font-medium text-lg">Tu calificación ha sido registrada. ¡Esperamos verte pronto de nuevo!</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default OrderTracking;
