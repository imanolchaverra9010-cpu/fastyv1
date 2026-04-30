import { useState } from "react";
import { AlertCircle, ChefHat, Package, Check, MapPin, ChevronDown, ChevronUp, ExternalLink, Phone, ArrowRight, Bike, Navigation, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCOP } from "@/data/mock";
import { Order, BusinessContextType } from "@/types/business";
import { useOutletContext, Link } from "react-router-dom";
import DeliveryMap from "@/components/DeliveryMap";
import { RequestDeliveryModal } from "./RequestDeliveryModal";

const STATUS_CONFIG = {
  pending: { label: "Pendiente", color: "border-destructive/30 bg-destructive/5", badge: "bg-destructive/10 text-destructive" },
  preparing: { label: "Preparando", color: "border-primary/30 bg-primary/5", badge: "bg-primary/10 text-primary" },
  shipped:   { label: "En camino",   color: "border-warning/30 bg-warning/5",          badge: "bg-warning/10 text-warning" },
  in_transit: { label: "En viaje",    color: "border-warning/40 bg-warning/10",         badge: "bg-warning/20 text-warning" },
  delivered: { label: "Entregado",   color: "border-success/30 bg-success/5",          badge: "bg-success/10 text-success" },
  cancelled: { label: "Cancelado", color: "border-muted/30 bg-muted/5", badge: "bg-muted/10 text-muted-foreground" },
};

const STATUS_FLOW: Record<string, string[]> = {
  pending:   ["preparing", "cancelled"],
  preparing: ["shipped",   "cancelled"],
  shipped:   ["delivered"],
  in_transit: ["delivered"],
  delivered: [],
  cancelled: [],
};

const NEXT_LABEL: Record<string, string> = {
  preparing: "✅ Confirmar → Preparando",
  shipped: "🚚 Marcar como Enviado",
  delivered: "✔️ Marcar como Entregado",
  cancelled: "❌ Cancelar Pedido",
};

interface OrderCardProps {
  order: Order;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onStatusChange: (orderId: string, newStatus: string) => void;
  businessCoords?: { lat: number, lng: number };
}

const OrderCard = ({ order, isExpanded, onToggleExpand, onStatusChange, businessCoords }: OrderCardProps) => {
  const config = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
  const nextStatuses = STATUS_FLOW[order.status] ?? [];

  return (
    <div className={`bg-card border-2 rounded-2xl transition-all duration-200 overflow-hidden ${config.color}`}>
      {/* Header — always visible */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer select-none"
        onClick={onToggleExpand}
      >
        {/* Status dot */}
        <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${
          order.status === "pending"   ? "bg-destructive animate-pulse" :
          order.status === "preparing" ? "bg-primary animate-pulse" :
          order.status === "shipped" || order.status === "in_transit" ? "bg-warning animate-pulse" :
          order.status === "delivered" ? "bg-success" : "bg-muted-foreground"
        }`} />

        <div className="flex-1 min-w-0">
          <p className="font-bold truncate">{order.customer_name}</p>
          <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
            <MapPin className="h-3 w-3 shrink-0" /> {order.delivery_address}
          </p>
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          <p className="font-bold text-base">{formatCOP(order.total)}</p>
          <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${config.badge}`}>
            {config.label}
          </span>
          {order.order_type === "business_requested" && (
            <span className="text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 mt-1">
              Servicio Externo
            </span>
          )}
        </div>

        <div className="ml-2 text-muted-foreground">
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </div>

      {/* Expanded Detail */}
      {isExpanded && (
        <div className="px-4 pb-5 space-y-4 border-t border-border/40 pt-4">
          {/* ID + Google Maps Link */}
          <div className="flex items-center justify-between">
            <p className="text-xs font-mono text-muted-foreground">{order.id}</p>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.delivery_address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              <MapPin className="h-3.5 w-3.5" /> Ver en Google Maps
            </a>
          </div>

          {/* Products */}
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Productos</p>
            <div className="space-y-1.5 bg-muted/30 rounded-xl p-3">
              {(order.items || []).map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span className="flex items-center gap-1.5">
                    <span>{item.emoji}</span>
                    <span className="font-medium">{item.name}</span>
                    <span className="text-muted-foreground">×{item.quantity}</span>
                  </span>
                  <span className="font-bold">{formatCOP(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Meta */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" /> Teléfono
              </p>
              <p className="font-medium mt-0.5">{order.customer_phone || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pago</p>
              <p className="font-medium capitalize mt-0.5">{order.payment_method}</p>
            </div>
          </div>

          {order.notes && (
            <div className="bg-muted/40 rounded-xl p-3 text-sm">
              <p className="text-xs font-bold text-muted-foreground uppercase mb-1">Notas del cliente</p>
              <p>{order.notes}</p>
            </div>
          )}

          {/* Live Map for Active Deliveries */}
          {(order.status === 'shipped' || order.status === 'in_transit') && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                <Bike className="h-3.5 w-3.5" /> Rastreo en vivo
              </p>
              <div className="h-[200px] rounded-xl overflow-hidden border border-border/60 shadow-inner">
                <DeliveryMap 
                   pickup={{ 
                      lat: businessCoords?.lat || 4.6533, 
                      lng: businessCoords?.lng || -74.0836, 
                      label: "Tu Negocio",
                      emoji: businessCoords?.emoji
                    }}
                  dropoff={{ 
                    lat: order.latitude || 4.6712, 
                    lng: order.longitude || -74.0598, 
                    label: "Cliente" 
                  }}
                  courier={order.courier_lat && order.courier_lng ? { 
                    lat: order.courier_lat, 
                    lng: order.courier_lng, 
                    label: "Domiciliario" 
                  } : undefined}
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {nextStatuses.length > 0 && (
            <div className="flex flex-col gap-2 pt-1">
              {nextStatuses.map((ns) => (
                <Button
                  key={ns}
                  variant={ns === "cancelled" ? "outline" : "hero"}
                  className={`w-full rounded-xl h-11 font-bold gap-2 ${ns === "cancelled" ? "border-destructive/40 text-destructive hover:bg-destructive/10" : ""}`}
                  onClick={() => onStatusChange(order.id, ns)}
                >
                  {NEXT_LABEL[ns] ?? ns} <ArrowRight className="h-4 w-4" />
                </Button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const OrdersTab = () => {
  const { orders, expandedOrder, setExpandedOrder, handleUpdateOrderStatus, business, fetchBusinessData } = useOutletContext<BusinessContextType>();
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);

  const businessCoords = (business as any)?.latitude && (business as any)?.longitude 
    ? { 
        lat: (business as any).latitude, 
        lng: (business as any).longitude,
        emoji: (business as any).emoji
      }
    : undefined;

  const pendingOrders   = orders.filter(o => o.status === "pending");
  const preparingOrders = orders.filter(o => o.status === "preparing");
  const shippedOrders   = orders.filter(o => o.status === "shipped" || o.status === "in_transit");
  const deliveredOrders = orders.filter(o => o.status === "delivered");

  if ((orders || []).length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
        <p className="text-muted-foreground">No tienes pedidos activos en este momento.</p>
      </div>
    );
  }

  const Section = ({ title, icon, orders: sectionOrders }: { title: string; icon: React.ReactNode; orders: Order[] }) => (
    sectionOrders.length > 0 ? (
      <section>
        <h2 className="text-base font-bold mb-3 flex items-center gap-2 text-muted-foreground uppercase tracking-wide text-xs">
          {icon} {title} <span className="bg-muted rounded-full px-2 py-0.5 text-foreground">{sectionOrders.length}</span>
        </h2>
        <div className="space-y-3">
          {sectionOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              isExpanded={expandedOrder === order.id}
              onToggleExpand={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
              onStatusChange={handleUpdateOrderStatus}
              businessCoords={businessCoords}
            />
          ))}
        </div>
      </section>
    ) : null
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-center bg-card border border-border/60 p-4 rounded-2xl shadow-card gap-4">
        <div className="text-center md:text-left">
          <h3 className="font-bold text-sm">¿Tienes pedidos externos?</h3>
          <p className="text-xs text-muted-foreground">Solicita un domiciliario de Fasty ahora.</p>
        </div>
        <Button 
          variant="hero" 
          className="w-full md:w-auto h-11 md:h-12 rounded-xl px-6 font-bold shadow-glow gap-2 text-sm"
          onClick={() => setIsDeliveryModalOpen(true)}
        >
          <Navigation className="h-4 w-4 md:h-5 md:w-5" /> Solicitar Domicilio
        </Button>
      </div>

      <Section title="Pendientes" icon={<AlertCircle className="h-4 w-4 text-destructive" />} orders={pendingOrders} />
      <Section title="En Preparación" icon={<ChefHat className="h-4 w-4 text-primary" />} orders={preparingOrders} />
      <Section title="En Camino" icon={<Package className="h-4 w-4 text-warning" />} orders={shippedOrders} />
      <Section title="Entregados" icon={<Check className="h-4 w-4 text-success" />} orders={deliveredOrders.slice(0, 5)} />

      {isDeliveryModalOpen && business && (
        <RequestDeliveryModal 
          business={business as any}
          onClose={() => setIsDeliveryModalOpen(false)}
          onSuccess={fetchBusinessData}
        />
      )}
    </div>
  );
};
