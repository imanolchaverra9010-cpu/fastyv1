import { useState } from "react";
import { Bike, Check, Clock, MapPin, Navigation, Package, Phone, Plus, X } from "lucide-react";
import { useOutletContext } from "react-router-dom";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/StatusBadge";
import { formatCOP } from "@/data/mock";
import { BusinessContextType, Order } from "@/types/business";
import { RequestDeliveryModal } from "./RequestDeliveryModal";

const statusLabel: Record<string, string> = {
  pending: "Pendiente",
  preparing: "Preparando",
  shipped: "En camino",
  in_transit: "En viaje",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

const nextStatus: Record<string, string | null> = {
  pending: "preparing",
  preparing: "shipped",
  shipped: "delivered",
  in_transit: "delivered",
  delivered: null,
  cancelled: null,
};

export const ExternalOrdersTab = () => {
  const { orders, business, fetchData, handleUpdateOrderStatus } = useOutletContext<BusinessContextType>();
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);

  const externalOrders = (orders || []).filter((order) => order.order_type === "business_requested");

  const groupedOrders = {
    active: externalOrders.filter((order) => !["delivered", "cancelled"].includes(order.status)),
    delivered: externalOrders.filter((order) => order.status === "delivered"),
    cancelled: externalOrders.filter((order) => order.status === "cancelled"),
  };

  const OrderCard = ({ order }: { order: Order }) => {
    const next = nextStatus[order.status];

    return (
      <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-xs font-bold text-primary">#{order.id}</span>
              <StatusBadge status={order.status} />
            </div>
            <h3 className="font-bold text-base truncate">{order.customer_name}</h3>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{order.delivery_address}</span>
            </p>
          </div>
          <div className="text-left sm:text-right shrink-0">
            <p className="text-[10px] uppercase font-bold text-muted-foreground">Valor a cobrar</p>
            <p className="font-display text-xl font-bold text-primary">{formatCOP(order.total || 0)}</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-3 text-xs">
          <div className="rounded-xl bg-muted/30 p-3">
            <p className="font-bold text-muted-foreground uppercase mb-1 flex items-center gap-1">
              <Phone className="h-3 w-3" /> Teléfono
            </p>
            <p className="font-semibold truncate">{order.customer_phone || "No registrado"}</p>
          </div>
          <div className="rounded-xl bg-muted/30 p-3">
            <p className="font-bold text-muted-foreground uppercase mb-1 flex items-center gap-1">
              <Clock className="h-3 w-3" /> Fecha
            </p>
            <p className="font-semibold">{new Date(order.created_at).toLocaleString()}</p>
          </div>
          <div className="rounded-xl bg-muted/30 p-3">
            <p className="font-bold text-muted-foreground uppercase mb-1 flex items-center gap-1">
              <Bike className="h-3 w-3" /> Estado
            </p>
            <p className="font-semibold">{statusLabel[order.status] || order.status}</p>
          </div>
        </div>

        {order.notes && (
          <div className="rounded-xl border border-border/50 bg-muted/20 p-3 text-sm">
            <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Notas</p>
            <p>{order.notes}</p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <Button asChild variant="outline" className="rounded-xl">
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.delivery_address)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MapPin className="h-4 w-4 mr-2" /> Ver en mapa
            </a>
          </Button>
          {next && (
            <Button
              variant="hero"
              className="rounded-xl sm:ml-auto"
              onClick={() => handleUpdateOrderStatus(order.id, next)}
            >
              <Check className="h-4 w-4 mr-2" /> Marcar como {statusLabel[next].toLowerCase()}
            </Button>
          )}
          {!["delivered", "cancelled"].includes(order.status) && (
            <Button
              variant="outline"
              className="rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10"
              onClick={() => {
                if (window.confirm("¿Cancelar este pedido externo?")) {
                  handleUpdateOrderStatus(order.id, "cancelled");
                }
              }}
            >
              <X className="h-4 w-4 mr-2" /> Cancelar
            </Button>
          )}
        </div>
      </div>
    );
  };

  const Section = ({ title, icon, orders }: { title: string; icon: React.ReactNode; orders: Order[] }) => (
    <section className="space-y-3">
      <h2 className="text-[11px] font-black flex items-center gap-2 text-muted-foreground uppercase tracking-[0.15em] bg-muted/30 w-fit px-3 py-1.5 rounded-full border border-border/40">
        {icon} {title}
        <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 ml-1">{orders.length}</span>
      </h2>
      {orders.length > 0 ? (
        <div className="grid gap-4">
          {orders.map((order) => <OrderCard key={order.id} order={order} />)}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border/60 bg-card/50 p-8 text-center">
          <Package className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="text-sm text-muted-foreground">No hay pedidos externos en esta sección.</p>
        </div>
      )}
    </section>
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-center bg-card border border-border/60 p-4 rounded-2xl shadow-card gap-4">
        <div className="text-center md:text-left">
          <h3 className="font-bold text-sm">Pedidos externos</h3>
          <p className="text-xs text-muted-foreground">Solicita domiciliarios y revisa todos tus despachos externos.</p>
        </div>
        <Button
          variant="hero"
          className="w-full md:w-auto h-11 md:h-12 rounded-xl px-6 font-bold shadow-glow gap-2 text-sm"
          onClick={() => setIsDeliveryModalOpen(true)}
        >
          <Plus className="h-4 w-4 md:h-5 md:w-5" /> Pedir pedido externo
        </Button>
      </div>

      <Section title="Activos" icon={<Navigation className="h-4 w-4 text-primary" />} orders={groupedOrders.active} />
      <Section title="Entregados" icon={<Check className="h-4 w-4 text-success" />} orders={groupedOrders.delivered} />
      <Section title="Cancelados" icon={<X className="h-4 w-4 text-muted-foreground" />} orders={groupedOrders.cancelled} />

      {isDeliveryModalOpen && business && (
        <RequestDeliveryModal
          business={business as any}
          onClose={() => setIsDeliveryModalOpen(false)}
          onSuccess={fetchData}
        />
      )}
    </div>
  );
};
