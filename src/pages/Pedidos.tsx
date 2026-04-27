import { Clock, Eye, Package, Search, TrendingUp, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import StatCard from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";
import { OrderDetailModal } from "@/components/OrderDetailModal";
import { formatCOP } from "@/data/mock";

const Pedidos = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      setError(false);
      try {
        const url = filter === "all" ? "/api/orders" : `/api/orders?status_filter=${filter}`;
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          setOrders(data);
        } else {
          setError(true);
        }
      } catch (error) {
        console.error("Error fetching orders:", error);
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, [filter]);

  const updateOrderStatus = async (orderId: string, newStatus: string, courierId?: number) => {
    try {
      const body: any = { status: newStatus };
      if (newStatus === 'cancelled') {
        body.reason = "Cancelado manualmente por administrador";
      }
      if (courierId) {
        body.courier_id = courierId;
      }

      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (response.ok) {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus, courier_id: courierId || o.courier_id } : o));
      }
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const getTimerColor = (createdAt: string) => {
    const elapsed = (new Date().getTime() - new Date(createdAt).getTime()) / 1000 / 60;
    if (elapsed > 45) return "text-destructive";
    if (elapsed > 25) return "text-warning";
    return "text-success";
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-gradient-warm">
        <AdminSidebar />
        <SidebarInset className="flex-1">
          <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-border/60 bg-background/75 backdrop-blur-xl px-4 md:px-6">
            <SidebarTrigger className="-ml-1" />
            <div className="h-4 w-px bg-border/60 mx-2" />
            <h2 className="text-sm font-semibold text-muted-foreground">Gestión de Pedidos</h2>
          </header>

          <main className="p-4 md:p-8 max-w-7xl mx-auto w-full">
            <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <p className="text-sm text-primary font-semibold">Administración</p>
                <h1 className="text-4xl font-display font-bold tracking-tight">Pedidos</h1>
                <p className="text-muted-foreground mt-1">{(orders || []).length} pedidos encontrados. Monitorea el flujo de vida de las órdenes.</p>
              </div>
              <div className="flex items-center gap-3">
                <select
                  className="h-10 rounded-xl border-border/60 bg-card px-4 text-sm font-medium shadow-card outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">Todos los estados</option>
                  <option value="pending">Pendientes</option>
                  <option value="preparing">En Preparación</option>
                  <option value="shipped">En Camino</option>
                  <option value="delivered">Entregados</option>
                  <option value="cancelled">Cancelados</option>
                </select>
                <div className="relative hidden md:block">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar por ID o cliente…" className="pl-9 h-10 w-64 rounded-xl" />
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-card border border-border/60 shadow-card overflow-hidden">
              <div className="p-5 border-b border-border/60 flex items-center justify-between bg-muted/20">
                <h3 className="font-bold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Lista de Pedidos {filter !== 'all' && <span className="text-muted-foreground font-normal">({filter})</span>}
                </h3>
                <span className="text-xs font-medium text-muted-foreground">
                  {(orders || []).length} pedidos encontrados
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-5 py-3 font-medium">Pedido</th>
                      <th className="text-left px-5 py-3 font-medium">Negocio</th>
                      <th className="text-left px-5 py-3 font-medium">Cliente</th>
                      <th className="text-right px-5 py-3 font-medium">Total</th>
                      <th className="text-left px-5 py-3 font-medium">Estado</th>
                      <th className="text-left px-5 py-3 font-medium">Tiempo</th>
                      <th className="text-right px-5 py-3 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="px-5 py-20 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
                            <p className="text-muted-foreground animate-pulse">Cargando pedidos desde la base de datos...</p>
                          </div>
                        </td>
                      </tr>
                    ) : error ? (
                      <tr>
                        <td colSpan={7} className="px-5 py-20 text-center">
                          <div className="flex flex-col items-center gap-2 text-destructive">
                            <AlertCircle className="h-8 w-8" />
                            <p className="font-bold">Error de conexión con el servidor</p>
                            <p className="text-sm opacity-80">Asegúrate de que el backend en Python esté corriendo en el puerto 8000.</p>
                          </div>
                        </td>
                      </tr>
                    ) : orders.map((o) => (
                      <tr key={o.id} className="hover:bg-muted/30 transition-colors group">
                        <td className="px-5 py-3 font-mono text-xs font-bold text-primary">#{o.id}</td>
                        <td className="px-5 py-3 font-medium">{o.businessName || 'Negocio'}</td>
                        <td className="px-5 py-3 text-muted-foreground">{o.customer_name || o.customer}</td>
                        <td className="px-5 py-3 text-right font-bold">{formatCOP(o.total)}</td>
                        <td className="px-5 py-3"><StatusBadge status={o.status} /></td>
                        <td className="px-5 py-3 text-muted-foreground text-xs">
                          <div className={`flex items-center gap-1 font-semibold ${getTimerColor(o.created_at || o.createdAt)}`}>
                            <Clock className="h-3.5 w-3.5" />
                            {new Date(o.created_at || o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="soft"
                              className="h-8 gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => setSelectedOrderId(o.id)}
                            >
                              <Eye className="h-3.5 w-3.5" /> Detalle
                            </Button>
                            <select
                              className="text-xs border rounded-lg p-1.5 bg-background shadow-soft outline-none focus:ring-2 focus:ring-primary/20"
                              value={o.status}
                              onChange={(e) => updateOrderStatus(o.id, e.target.value)}
                            >
                              <option value="pending">Pendiente</option>
                              <option value="preparing">Preparando</option>
                              <option value="shipped">Enviado</option>
                              <option value="delivered">Entregado</option>
                              <option value="cancelled">Cancelado</option>
                            </select>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {(orders || []).length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-5 py-10 text-center text-muted-foreground italic">
                          No se encontraron pedidos en esta categoría.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </main>
        </SidebarInset>

        {selectedOrderId && (
          <OrderDetailModal
            orderId={selectedOrderId}
            onClose={() => setSelectedOrderId(null)}
            onStatusUpdate={(id, status, courierId) => {
              updateOrderStatus(id, status, courierId);
              setSelectedOrderId(null);
            }}
          />
        )}
      </div>
    </SidebarProvider>
  );
};

export default Pedidos;
