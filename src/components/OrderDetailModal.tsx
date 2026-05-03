import { useEffect, useState } from "react";
import {
  X, MapPin, Phone, Clock, Package,
  CreditCard, User, Bike, CheckCircle2,
  AlertCircle, History
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCOP } from "@/data/mock";
import StatusBadge from "@/components/StatusBadge";

interface OrderDetailModalProps {
  orderId: string;
  onClose: () => void;
  onStatusUpdate: (id: string, status: string, courierId?: number) => void;
  onSmartAssign?: (id: string) => Promise<void>;
}

export function OrderDetailModal({ orderId, onClose, onStatusUpdate, onSmartAssign }: OrderDetailModalProps) {
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [couriers, setCouriers] = useState<any[]>([]);
  const [selectedCourierId, setSelectedCourierId] = useState<string>("");
  const [smartAssigning, setSmartAssigning] = useState(false);

  useEffect(() => {
    // Cargar pedido
    const fetchOrder = fetch(`/api/orders/${orderId}`).then(res => res.json());
    // Cargar domiciliarios online
    const fetchCouriers = fetch(`/api/admin/couriers?status_filter=online`).then(res => res.json());

    Promise.all([fetchOrder, fetchCouriers])
      .then(([orderData, couriersData]) => {
        setOrder(orderData);
        setCouriers(couriersData);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setOrder({ error: true, message: err.message });
        setLoading(false);
      });
  }, [orderId]);

  if (loading) return null;

  if (order?.error) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
        <div className="bg-card w-full max-w-md p-8 rounded-3xl border border-border/60 shadow-glow text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Error al cargar el pedido</h2>
          <p className="text-muted-foreground mb-6">{order.message}</p>
          <Button onClick={onClose} variant="hero" className="w-full">Cerrar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="bg-card w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-3xl border border-border/60 shadow-glow flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-border/60 flex items-center justify-between bg-gradient-hero text-primary-foreground">
          <div>
            <h2 className="text-2xl font-display font-bold flex items-center gap-2">
              Pedido #{order.id}
            </h2>
            <p className="text-sm opacity-90">{new Date(order.created_at).toLocaleString()}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 grid md:grid-cols-2 gap-8">
          {/* Columna Izquierda: Detalles */}
          <div className="space-y-8">
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                <User className="h-4 w-4" /> Cliente y Entrega
              </h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="mt-1 h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-bold">{order.customer_name}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {order.customer_phone || 'No registrado'}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1 h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{order.delivery_address || 'Sin dirección'}</p>
                    <a href={`https://maps.google.com/?q=${order.delivery_address}`} target="_blank" className="text-xs text-primary hover:underline">Ver en mapa</a>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                <Package className="h-4 w-4" /> Productos
              </h3>
              <div className="space-y-3">
                {order.items?.map((item: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
                    <span className="text-2xl">{item.emoji}</span>
                    <div className="flex-1">
                      <p className="text-sm font-bold">{item.name}</p>
                      <p className="text-xs text-muted-foreground">x{item.quantity} · {formatCOP(item.price)} c/u</p>
                    </div>
                    <p className="text-sm font-bold">{formatCOP(item.price * item.quantity)}</p>
                  </div>
                ))}
                {order.order_type === 'open' && order.open_order_description && (
                  <div className="p-3 rounded-xl bg-muted/30 border border-primary/20">
                    <p className="text-xs uppercase font-bold text-primary mb-1">Pedido Abierto / Personalizado</p>
                    <p className="text-sm font-medium">{order.open_order_description}</p>
                  </div>
                )}
                {(!order.items || order.items.length === 0) && order.order_type !== 'open' && (
                  <p className="text-sm text-muted-foreground italic">No hay productos en este pedido.</p>
                )}
                <div className="pt-3 border-t border-border/60 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Método de Pago</span>
                      <CreditCard className="h-3 w-3" /> {order.payment_method === 'cash' ? 'Efectivo 💵' : 
                                                           order.payment_method === 'card' ? 'Tarjeta 💳' : 
                                                           order.payment_method === 'wallet' ? 'Billetera 📱' : order.payment_method}
                  </div>
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span className="text-primary">{formatCOP(order.total)}</span>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Columna Derecha: Estado y Logística */}
          <div className="space-y-8">
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                <History className="h-4 w-4" /> Estado de la Orden
              </h3>
              <div className="p-4 rounded-2xl border border-border/60 bg-muted/20">
                <div className="flex items-center justify-between mb-4">
                  <StatusBadge status={order.status} />
                  {order.eta_text && order.status !== 'delivered' && order.status !== 'cancelled' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                      <Clock className="h-3.5 w-3.5" /> ETA {order.eta_text}
                    </span>
                  )}
                  {order.status !== 'delivered' && order.status !== 'cancelled' && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="soft" onClick={() => onStatusUpdate(order.id, 'cancelled')}>Cancelar</Button>
                      <Button size="sm" variant="hero" onClick={() => {
                        const next: any = { pending: 'preparing', preparing: 'shipped', shipped: 'delivered' };
                        onStatusUpdate(order.id, next[order.status]);
                      }}>Avanzar</Button>
                    </div>
                  )}
                </div>

                {/* Timeline de Logs */}
                <div className="space-y-4">
                  {order.logs?.map((log: any, i: number) => (
                    <div key={i} className="flex gap-3 relative">
                      {i < (order.logs?.length || 0) - 1 && (
                        <div className="absolute left-1.5 top-4 bottom-0 w-0.5 bg-border/60" />
                      )}
                      <div className={`mt-1.5 h-3 w-3 rounded-full shrink-0 ${i === (order.logs?.length || 0) - 1 ? 'bg-primary animate-pulse' : 'bg-border'}`} />
                      <div className="flex-1 pb-4">
                        <p className="text-sm font-bold capitalize">{
                          log.status === 'pending' ? 'Pendiente' : 
                          log.status === 'preparing' ? 'Preparando' :
                          log.status === 'shipped' ? 'En camino' :
                          log.status === 'in_transit' ? 'Cerca de ti' :
                          log.status === 'delivered' ? 'Entregado' :
                          log.status === 'cancelled' ? 'Cancelado' : log.status
                        }</p>
                        <p className="text-xs text-muted-foreground">{new Date(log.changed_at).toLocaleTimeString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                <Bike className="h-4 w-4" /> Asignación de Domiciliario
              </h3>
              <div className="p-4 rounded-2xl border border-border/60 bg-muted/20 space-y-4">
                {order.courier_id ? (
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-hero flex items-center justify-center text-primary-foreground">
                      <Bike className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold">Asignado correctamente</p>
                      <p className="text-xs text-muted-foreground">Repartidor: {order.courier_name || `ID ${order.courier_id}`}</p>
                    </div>
                    <Button size="sm" variant="soft" onClick={() => onStatusUpdate(order.id, order.status, undefined)}>Cambiar</Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground italic">No hay domiciliario asignado a este pedido.</p>
                    {onSmartAssign && (
                      <Button
                        variant="hero"
                        className="w-full rounded-xl"
                        disabled={smartAssigning}
                        onClick={async () => {
                          setSmartAssigning(true);
                          try {
                            await onSmartAssign(order.id);
                            onClose();
                          } catch (error: any) {
                            alert(error.message || "No se pudo asignar un domiciliario");
                          } finally {
                            setSmartAssigning(false);
                          }
                        }}
                      >
                        {smartAssigning ? "Asignando..." : "Asignar inteligente"}
                      </Button>
                    )}
                    <div className="flex gap-2">
                      <select
                        className="flex-1 text-sm border rounded-xl px-3 bg-background shadow-soft outline-none focus:ring-2 focus:ring-primary/20 h-10"
                        value={selectedCourierId}
                        onChange={(e) => setSelectedCourierId(e.target.value)}
                      >
                        <option value="">Seleccionar domiciliario...</option>
                        {(couriers || []).map(c => (
                          <option key={c.id} value={c.id}>{c.name} ({c.vehicle})</option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        variant="hero"
                        disabled={!selectedCourierId}
                        onClick={() => onStatusUpdate(order.id, order.status, parseInt(selectedCourierId))}
                      >
                        Asignar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {order.courier_id && (
              <section>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Ubicación en Vivo
                </h3>
                <div className="p-4 rounded-2xl border border-border/60 bg-muted/20 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center text-success">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold">Rastreo activo</p>
                    <p className="text-xs text-muted-foreground">Lat: {order.courier_lat || '4.6097'}, Lng: {order.courier_lng || '-74.0817'}</p>
                  </div>
                  <Button size="sm" variant="soft">Ver Mapa</Button>
                </div>
              </section>
            )}

            {order.cancellation_reason && (
              <section className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20">
                <div className="flex items-center gap-2 text-destructive mb-1 font-bold text-sm">
                  <AlertCircle className="h-4 w-4" /> Motivo de Cancelación
                </div>
                <p className="text-sm text-destructive/80">{order.cancellation_reason}</p>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
