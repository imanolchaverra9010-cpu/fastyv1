import { Clock, Eye, Package, Search, TrendingUp, AlertCircle, Download } from "lucide-react";
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
  const [searchTerm, setSearchTerm] = useState("");

  const filteredOrders = (orders || []).filter(o => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const idMatch = String(o.id).toLowerCase().includes(term);
    const customerMatch = (o.customer_name || o.customer || "").toLowerCase().includes(term);
    const courierMatch = (o.courier_name || "").toLowerCase().includes(term);
    return idMatch || customerMatch || courierMatch;
  });

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

  const smartAssignOrder = async (orderId: string) => {
    const response = await fetch(`/api/orders/${orderId}/smart-assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || "No se pudo asignar un domiciliario");
    }

    const result = await response.json();
    setOrders(prev => prev.map(o => o.id === orderId ? {
      ...o,
      status: "shipped",
      courier_id: result.courier?.id,
      courier_name: result.courier?.name,
      eta_text: result.eta?.eta_text,
      estimated_delivery_minutes: result.eta?.estimated_delivery_minutes,
    } : o));
  };

  const getTimerColor = (createdAt: string) => {
    const elapsed = (new Date().getTime() - new Date(createdAt).getTime()) / 1000 / 60;
    if (elapsed > 45) return "text-destructive";
    if (elapsed > 25) return "text-warning";
    return "text-success";
  };

  const exportOrders = () => {
    if (filteredOrders.length === 0) return;
    
    const today = new Date().toISOString().split('T')[0];
    
    // Generar XML para Excel con estilos
    const xmlHeader = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="sHeader">
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#f97316" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="sDefault">
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000"/>
  </Style>
  <Style ss:ID="sMoney">
   <NumberFormat ss:Format="Currency"/>
  </Style>
  <Style ss:ID="sDate">
   <NumberFormat ss:Format="Short Date"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Pedidos">
  <Table>
   <Column ss:Width="80"/>
   <Column ss:Width="150"/>
   <Column ss:Width="150"/>
   <Column ss:Width="150"/>
   <Column ss:Width="80"/>
   <Column ss:Width="80"/>
   <Column ss:Width="120"/>
   <Row ss:Height="20">
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">ID Pedido</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Negocio</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Repartidor</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Cliente</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Total</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Estado</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Fecha</Data></Cell>
   </Row>`;

    const xmlRows = filteredOrders.map(o => `
   <Row>
    <Cell ss:StyleID="sDefault"><Data ss:Type="String">${o.id}</Data></Cell>
    <Cell ss:StyleID="sDefault"><Data ss:Type="String">${o.business_name || (o.order_type === 'open' ? o.origin_name : 'Negocio')}</Data></Cell>
    <Cell ss:StyleID="sDefault"><Data ss:Type="String">${o.courier_name || 'Sin asignar'}</Data></Cell>
    <Cell ss:StyleID="sDefault"><Data ss:Type="String">${o.customer_name || o.customer}</Data></Cell>
    <Cell ss:StyleID="sMoney"><Data ss:Type="Number">${(o.delivery_fee || 0) + (o.night_fee || 0)}</Data></Cell>
    <Cell ss:StyleID="sDefault"><Data ss:Type="String">${o.status}</Data></Cell>
    <Cell ss:StyleID="sDefault"><Data ss:Type="String">${new Date(o.created_at || o.createdAt).toLocaleString()}</Data></Cell>
   </Row>`).join("");

    const xmlFooter = `
  </Table>
 </Worksheet>
</Workbook>`;

    const xmlContent = xmlHeader + xmlRows + xmlFooter;
    const blob = new Blob([xmlContent], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pedidos_${filter}_${today}.xls`;
    link.click();
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
                <p className="text-muted-foreground mt-1">{filteredOrders.length} pedidos encontrados. Monitorea el flujo de vida de las órdenes.</p>
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
                  <Input 
                    placeholder="Buscar por ID, cliente o repartidor…" 
                    className="pl-9 h-10 w-64 rounded-xl" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Button 
                  onClick={exportOrders} 
                  variant="outline" 
                  size="sm" 
                  className="h-10 rounded-xl gap-2 border-primary/20 hover:bg-primary/5"
                  disabled={filteredOrders.length === 0}
                >
                  <Download className="h-4 w-4" />
                  Exportar
                </Button>
              </div>
            </div>

            <div className="rounded-2xl bg-card border border-border/60 shadow-card overflow-hidden">
              <div className="p-5 border-b border-border/60 flex items-center justify-between bg-muted/20">
                <h3 className="font-bold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Lista de Pedidos {filter !== 'all' && <span className="text-muted-foreground font-normal">({filter})</span>}
                </h3>
                <span className="text-xs font-medium text-muted-foreground">
                  {filteredOrders.length} pedidos encontrados
                </span>
              </div>
              
              {/* Vista de Escritorio: Tabla */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-5 py-3 font-medium">Pedido</th>
                      <th className="text-left px-5 py-3 font-medium">Negocio</th>
                      <th className="text-left px-5 py-3 font-medium">Repartidor</th>
                      <th className="text-left px-5 py-3 font-medium">Productos</th>
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
                        <td colSpan={8} className="px-5 py-20 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
                            <p className="text-muted-foreground animate-pulse">Cargando pedidos desde la base de datos...</p>
                          </div>
                        </td>
                      </tr>
                    ) : error ? (
                      <tr>
                        <td colSpan={8} className="px-5 py-20 text-center">
                          <div className="flex flex-col items-center gap-2 text-destructive">
                            <AlertCircle className="h-8 w-8" />
                            <p className="font-bold">Error de conexión con el servidor</p>
                            <p className="text-sm opacity-80">Asegúrate de que el backend en Python esté corriendo en el puerto 8000.</p>
                          </div>
                        </td>
                      </tr>
                    ) : filteredOrders.map((o) => (
                      <tr key={o.id} className="hover:bg-muted/30 transition-colors group">
                        <td className="px-5 py-3 font-mono text-xs font-bold text-primary">#{o.id}</td>
                        <td className="px-5 py-3 font-medium">
                          {o.business_name || (o.order_type === 'open' ? o.origin_name : 'Negocio')}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex flex-col">
                            <span className="font-medium text-xs">{o.courier_name || (o.courier_id ? 'Asignado' : 'Sin asignar')}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <div className="max-w-[200px] space-y-0.5">
                            {(o.items || []).map((item: any, idx: number) => (
                              <p key={idx} className="text-[10px] truncate leading-tight">
                                <span className="font-bold text-primary">{item.quantity}x</span> {item.name}
                              </p>
                            ))}
                            {o.order_type === 'open' && <p className="text-[10px] italic text-muted-foreground">{o.open_order_description}</p>}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">{o.customer_name || o.customer}</td>
                        <td className="px-5 py-3 text-right font-bold">{formatCOP((o.delivery_fee || 0) + (o.night_fee || 0))}</td>
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
                    {filteredOrders.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-5 py-10 text-center text-muted-foreground italic">
                          No se encontraron pedidos en esta categoría.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Vista Móvil: Tarjetas */}
              <div className="md:hidden divide-y divide-border/60">
                {loading ? (
                  <div className="p-10 text-center">Cargando pedidos...</div>
                ) : filteredOrders.map((o) => (
                  <div key={o.id} className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-primary">#{o.id}</span>
                      <StatusBadge status={o.status} />
                    </div>
                    
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-sm">{o.business_name || (o.order_type === 'open' ? o.origin_name : 'Negocio')}</p>
                        <p className="text-[10px] text-primary font-medium">{o.courier_name || 'Sin repartidor'}</p>
                        <p className="text-xs text-muted-foreground">{o.customer_name || o.customer}</p>
                      </div>
                      <p className="font-bold text-sm text-right">{formatCOP((o.delivery_fee || 0) + (o.night_fee || 0))}</p>
                    </div>

                    {/* Resumen de productos en móvil */}
                    <div className="bg-muted/30 p-2.5 rounded-xl space-y-1.5">
                      <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Productos:</p>
                      {(o.items || []).map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-xs">
                          <span>{item.emoji} {item.name}</span>
                          <span className="font-bold text-primary">x{item.quantity}</span>
                        </div>
                      ))}
                      {o.order_type === 'open' && (
                        <p className="text-xs italic text-muted-foreground bg-white/50 p-1.5 rounded">{o.open_order_description}</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between bg-muted/20 p-2 rounded-lg">
                      <div className={`flex items-center gap-1 text-[10px] font-bold ${getTimerColor(o.created_at || o.createdAt)}`}>
                        <Clock className="h-3 w-3" />
                        {new Date(o.created_at || o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-[10px] font-bold gap-1"
                          onClick={() => setSelectedOrderId(o.id)}
                        >
                          <Eye className="h-3.5 w-3.5" /> Ver Detalle
                        </Button>
                        <select
                          className="text-[10px] border rounded-md p-1 bg-background outline-none font-bold"
                          value={o.status}
                          onChange={(e) => updateOrderStatus(o.id, e.target.value)}
                        >
                          <option value="pending">Pendiente</option>
                          <option value="preparing">Prep</option>
                          <option value="shipped">Env</option>
                          <option value="delivered">Ent</option>
                          <option value="cancelled">Can</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
                {filteredOrders.length === 0 && !loading && (
                  <div className="p-10 text-center text-muted-foreground italic">
                    No hay pedidos.
                  </div>
                )}
              </div>
            </div>
          </main>
        </SidebarInset>

        {selectedOrderId && (
          <OrderDetailModal
            orderId={selectedOrderId}
            onClose={() => setSelectedOrderId(null)}
            onSmartAssign={smartAssignOrder}
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
