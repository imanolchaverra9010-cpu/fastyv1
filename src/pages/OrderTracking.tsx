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
  MessageCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
      <main className="container max-w-4xl pt-8 px-4">
        <Link to="/negocios" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="h-4 w-4" /> Volver a la tienda
        </Link>

        {!order && !loading && (
          <div className="max-w-md mx-auto text-center mt-12 bg-card border rounded-3xl p-8 shadow-glow">
            <Search className="h-12 w-12 text-primary mx-auto mb-4 opacity-50" />
            <h1 className="text-2xl font-display font-bold mb-2">Rastrea tu pedido</h1>
            <p className="text-muted-foreground mb-6">Ingresa el ID de tu pedido para ver su estado actual.</p>
            <form onSubmit={handleSearch} className="flex gap-2">
              <Input
                placeholder="Ej: ORD-723A"
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                className="h-11 rounded-xl"
              />
              <Button type="submit" variant="hero" className="rounded-xl h-11 px-6">
                Rastrear
              </Button>
            </form>
            {error && <p className="mt-4 text-sm text-destructive font-medium">{error}</p>}
          </div>
        )}

        {loading && !order && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground font-medium">Buscando tu pedido...</p>
          </div>
        )}

        {order && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-display font-bold">Estado del Pedido</h1>
                <p className="text-muted-foreground">ID: <span className="font-mono text-foreground font-bold">{order.id}</span></p>
              </div>
              <div className="flex gap-2">
                <Button variant="soft" size="sm" onClick={() => fetchOrder(order.id)} className="rounded-xl">
                  Actualizar
                </Button>
                {!urlOrderId && (
                  <Button variant="outline" size="sm" onClick={() => setOrder(null)} className="rounded-xl">
                    Nueva búsqueda
                  </Button>
                )}
              </div>
            </header>

            {/* Stepper */}
            <div className="bg-card border rounded-3xl p-6 md:p-10 shadow-card">
              <div className="relative flex justify-between">
                {/* Connector line */}
                <div className="absolute top-5 left-0 w-full h-1 bg-muted -z-0" />
                <div
                  className="absolute top-5 left-0 h-1 bg-primary transition-all duration-700 ease-in-out -z-0"
                  style={{ width: `${(Math.max(0, currentStepIndex) / (statusSteps.length - 1)) * 100}%` }}
                />

                {statusSteps.map((step, idx) => {
                  const Icon = step.icon;
                  const isCompleted = idx <= currentStepIndex;
                  const isCurrent = idx === currentStepIndex;

                  return (
                    <div key={step.id} className="relative z-10 flex flex-col items-center text-center">
                      <div className={`
                        h-11 w-11 rounded-full flex items-center justify-center border-4 transition-all duration-300
                        ${isCompleted ? 'bg-primary border-primary text-primary-foreground shadow-glow' : 'bg-card border-muted text-muted-foreground'}
                        ${isCurrent ? 'scale-125 ring-4 ring-primary/20' : ''}
                      `}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className={`mt-3 text-xs md:text-sm font-bold transition-colors ${isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Map or Detail */}
              <div className="bg-card border rounded-3xl overflow-hidden shadow-card h-[300px] md:h-[400px]">
                {order.status === 'shipped' || order.status === 'in_transit' ? (
                  <DeliveryMap
                    pickup={{
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
                  <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-muted/20">
                    <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
                      {order.status === 'delivered' ? <CheckCircle2 className="h-10 w-10" /> : <Clock className="h-10 w-10 animate-pulse" />}
                    </div>
                    <h3 className="font-bold text-xl mb-2">
                      {order.status === 'delivered' ? '¡Entregado!' :
                        order.status === 'preparing' ? 'Preparando tu comida' :
                          'Esperando confirmación'}
                    </h3>
                    <p className="text-muted-foreground max-w-xs">
                      {order.status === 'delivered' ? 'Esperamos que disfrutes tu pedido. ¡Vuelve pronto!' :
                        order.status === 'preparing' ? 'El restaurante está cocinando tus platos favoritos.' :
                          'El restaurante recibirá tu pedido en unos segundos.'}
                    </p>
                  </div>
                )}
              </div>

              {/* Order Info */}
              <div className="bg-card border rounded-3xl p-5 shadow-card space-y-5 overflow-hidden min-w-0">
                {/* Items */}
                <div>
                  <h3 className="font-bold text-lg mb-3">Resumen</h3>
                  <div className="space-y-2">
                    {order.items?.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm min-w-0">
                        <span className="text-xl shrink-0">{item.emoji}</span>
                        <span className="font-medium flex-1 truncate min-w-0">{item.name} x{item.quantity}</span>
                        <span className="font-bold shrink-0 ml-2">{formatCOP(item.price * item.quantity)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t flex justify-between items-center font-bold text-lg">
                    <span>Total</span>
                    <span className="text-primary shrink-0">{formatCOP(order.total)}</span>
                  </div>
                </div>

                {/* Delivery info */}
                <div className="space-y-3 pt-3 border-t">
                  <div className="flex gap-3 min-w-0">
                    <MapPin className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-muted-foreground uppercase mb-0.5">Dirección de entrega</p>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.delivery_address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium hover:text-primary transition-colors break-words block"
                      >
                        {order.delivery_address}
                      </a>
                    </div>
                  </div>
                  <div className="flex gap-3 min-w-0">
                    <Package className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-muted-foreground uppercase mb-0.5">Destinatario</p>
                      <p className="text-sm font-medium truncate">{order.customer_name}</p>
                    </div>
                  </div>
                </div>

                {/* Courier Info */}
                {order.courier_id && (
                  <div className="pt-3 border-t animate-in fade-in slide-in-from-top-2 duration-500">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Tu Domiciliario Fasty</p>
                    <div className="bg-primary/5 rounded-2xl border-2 border-primary/20 p-3 space-y-3">
                      {/* Avatar row */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                          {order.courier_image ? (
                            <img
                              src={order.courier_image}
                              alt={order.courier_name}
                              className="h-12 w-12 rounded-full object-cover border-2 border-primary/40"
                            />
                          ) : (
                            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary border-2 border-primary/40">
                              <Bike className="h-6 w-6" />
                            </div>
                          )}
                          <div className="absolute -bottom-0.5 -right-0.5 bg-success h-3 w-3 rounded-full border-2 border-card animate-pulse" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-bold text-sm leading-snug break-words">{order.courier_name || "Domiciliario asignado"}</p>
                            <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                            {order.courier_rating && (
                              <span className="inline-flex items-center gap-0.5 bg-yellow-400/20 text-yellow-700 px-1.5 py-0.5 rounded text-[10px] font-bold border border-yellow-400/30 shrink-0">
                                <Star className="h-2.5 w-2.5 fill-yellow-500 text-yellow-500" />
                                {Number(order.courier_rating).toFixed(1)}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Bike className="h-3 w-3 shrink-0" />
                            <span className="truncate">{order.courier_vehicle || "Vehículo de entrega"}</span>
                          </p>
                        </div>
                      </div>

                      {/* Action buttons */}
                      {order.courier_phone && (
                        <div className="grid grid-cols-2 gap-2">
                          <Button variant="hero" size="sm" className="h-9 text-xs gap-1.5 rounded-xl w-full" asChild>
                            <a href={`tel:${order.courier_phone}`} className="flex items-center justify-center">
                              <Phone className="h-3.5 w-3.5 shrink-0" /> Llamar
                            </a>
                          </Button>
                          <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5 rounded-xl w-full border-success/40 text-success hover:bg-success/5" asChild>
                            <a
                              href={`https://wa.me/57${order.courier_phone.replace(/\D/g, '')}?text=${encodeURIComponent(`¡Hola! Soy cliente de Fasty, estoy rastreando mi pedido #${order.id}. ¿Cómo vas?`)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center"
                            >
                              <MessageCircle className="h-3.5 w-3.5 shrink-0" /> WhatsApp
                            </a>
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Rating Section */}
            {order.status === 'delivered' && !order.is_rated && !ratedLocally && (
              <div className="bg-card border-2 border-primary/20 rounded-3xl p-8 shadow-glow animate-in zoom-in-95">
                <div className="text-center mb-8">
                  <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Star className="h-8 w-8 text-primary fill-primary" />
                  </div>
                  <h2 className="text-2xl font-display font-bold">¡Danos tu opinión!</h2>
                  <p className="text-muted-foreground">Tu calificación nos ayuda a mejorar la experiencia Fasty.</p>
                </div>

                <div className="grid md:grid-cols-2 gap-8 mb-8">
                  {/* Business Rating */}
                  <div className="space-y-4">
                    <p className="font-bold text-center">¿Qué tal estuvo la comida?</p>
                    <div className="flex justify-center gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => setBizRating(star)}
                          className="transition-transform active:scale-95"
                        >
                          <Star className={`h-8 w-8 ${star <= bizRating ? 'text-yellow-400 fill-yellow-400' : 'text-muted'}`} />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Courier Rating */}
                  {order.courier_id && (
                    <div className="space-y-4">
                      <p className="font-bold text-center">¿Cómo fue la entrega?</p>
                      <div className="flex justify-center gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            onClick={() => setCourierRating(star)}
                            className="transition-transform active:scale-95"
                          >
                            <Star className={`h-8 w-8 ${star <= courierRating ? 'text-yellow-400 fill-yellow-400' : 'text-muted'}`} />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <Input
                    placeholder="Deja un comentario opcional..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="h-12 rounded-xl"
                  />
                  <Button
                    onClick={handleRate}
                    disabled={submittingRating}
                    variant="hero"
                    className="w-full h-12 rounded-xl text-lg font-bold shadow-glow"
                  >
                    {submittingRating ? <Loader2 className="animate-spin h-5 w-5" /> : <><Send className="mr-2 h-5 w-5" /> Enviar calificación</>}
                  </Button>
                </div>
              </div>
            )}

            {ratedLocally && (
              <div className="bg-success/10 border-2 border-success/20 rounded-3xl p-8 text-center animate-in fade-in">
                <CheckCircle2 className="h-10 w-10 text-success mx-auto mb-4" />
                <h3 className="text-xl font-bold text-success">¡Gracias por calificar!</h3>
                <p className="text-muted-foreground">Tu opinión ha sido registrada con éxito.</p>
              </div>
            )}

            {/* History Logs */}
            <div className="bg-card border rounded-3xl p-6 shadow-card">
              <h3 className="font-bold text-lg mb-4">Historial</h3>
              <div className="space-y-4">
                {order.logs?.map((log, idx) => (
                  <div key={idx} className="flex items-center gap-4">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <div className="flex-1">
                      <p className="text-sm font-bold capitalize">Estado: {log.status === 'pending' ? 'Pendiente' : 
                         log.status === 'preparing' ? 'Preparando' :
                         log.status === 'shipped' ? 'En camino' :
                         log.status === 'in_transit' ? 'En camino al destino' :
                         log.status === 'delivered' ? 'Entregado' :
                         log.status === 'cancelled' ? 'Cancelado' : log.status}</p>
                      <p className="text-xs text-muted-foreground">{new Date(log.changed_at).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default OrderTracking;
