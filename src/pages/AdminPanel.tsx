import { Bike, DollarSign, ShoppingBag, Store, Users, Loader2, Download } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useState, useEffect } from "react";
import StatCard from "@/components/StatCard";
import { HoursChart, RevenueChart, TopBusinessesChart } from "@/components/AdminCharts";
import { Button } from "@/components/ui/button";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";
import { formatCOP } from "@/data/mock";
import { toast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Hammer } from "lucide-react";

const AdminPanel = () => {
  const [stats, setStats] = useState<any>(null);
  const [revenueChart, setRevenueChart] = useState<any[]>([]);
  const [hoursChart, setHoursChart] = useState<any[]>([]);
  const [topBusinesses, setTopBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [togglingMaintenance, setTogglingMaintenance] = useState(false);
  const [dailyReport, setDailyReport] = useState<any[]>([]);


  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [statsRes, revenueRes, hoursRes, topRes] = await Promise.all([
          fetch("/api/admin/stats"),
          fetch("/api/admin/revenue-chart"),
          fetch("/api/admin/hours-chart"),
          fetch("/api/admin/top-businesses")
        ]);

        if (statsRes.ok) setStats(await statsRes.json());
        if (revenueRes.ok) setRevenueChart(await revenueRes.json());
        if (hoursRes.ok) setHoursChart(await hoursRes.json());
        if (topRes.ok) setTopBusinesses(await topRes.json());
        
        const reportRes = await fetch("/api/admin/daily-report");
        if (reportRes.ok) setDailyReport(await reportRes.json());

        const maintRes = await fetch("/api/admin/maintenance");
        if (maintRes.ok) {
          const maintData = await maintRes.json();
          setMaintenanceMode(maintData.maintenance_mode);
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  const handleToggleMaintenance = async () => {
    setTogglingMaintenance(true);
    try {
      const response = await fetch("/api/admin/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !maintenanceMode })
      });
      if (response.ok) {
        setMaintenanceMode(!maintenanceMode);
        toast({
          title: !maintenanceMode ? "Modo mantenimiento activado" : "Modo mantenimiento desactivado",
          description: !maintenanceMode ? "La plataforma ahora está en mantenimiento." : "La plataforma vuelve a estar en línea.",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo cambiar el estado de mantenimiento.",
        variant: "destructive"
      });
    } finally {
      setTogglingMaintenance(false);
    }
  };

  const exportDailyReport = () => {
    if (dailyReport.length === 0) return;
    
    const headers = ["ID Repartidor", "Nombre", "Entregas Hoy", "Total Recaudado"];
    const rows = dailyReport.map(c => [
      c.id,
      c.name,
      c.total_deliveries,
      c.total_revenue
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    const today = new Date().toISOString().split('T')[0];
    
    link.setAttribute("href", url);
    link.setAttribute("download", `reporte_diario_${today}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-warm">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-gradient-warm">
        <AdminSidebar />
        <SidebarInset className="flex-1">
          <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-border/60 bg-background/75 backdrop-blur-xl px-4 md:px-6">
            <SidebarTrigger className="-ml-1" />
            <div className="h-4 w-px bg-border/60 mx-2" />
            <h2 className="text-sm font-semibold text-muted-foreground capitalize">
              Resumen
            </h2>
            <div className="ml-auto flex items-center gap-4">
              <div className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded-full border border-border/40">
                <Hammer className={`h-4 w-4 ${maintenanceMode ? "text-orange-500 animate-pulse" : "text-muted-foreground"}`} />
                <span className="text-xs font-medium">Mantenimiento</span>
                <Switch 
                  checked={maintenanceMode} 
                  onCheckedChange={handleToggleMaintenance} 
                  disabled={togglingMaintenance}
                />
              </div>
            </div>
          </header>

          <main className="p-4 md:p-8 max-w-7xl mx-auto w-full">
            <div className="mb-6 md:mb-8">
              <p className="text-xs md:text-sm text-primary font-semibold">Administración</p>
              <h1 className="text-2xl md:text-4xl font-display font-bold tracking-tight">Panel de control</h1>
              <p className="text-sm text-muted-foreground mt-1">Visión completa de la operación de Fasty.</p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
              <StatCard
                icon={DollarSign}
                label="Ingresos totales"
                value={formatCOP(stats?.total_revenue || 0)}
                hint={`Ticket prom: ${formatCOP(stats?.avg_ticket || 0)}`}
                tone="success"
              />
              <StatCard
                icon={ShoppingBag}
                label="Pedidos"
                value={String(stats?.total_orders || 0)}
                hint={`${stats?.payments?.card || 0} 💳 · ${stats?.payments?.cash || 0} 💵 · ${stats?.payments?.wallet || 0} 📱`}
                tone="primary"
              />
              <StatCard
                icon={Store}
                label="Negocios"
                value={String(stats?.businesses?.active || 0)}
                hint={`${stats?.businesses?.pending || 0} pendientes de aprobación`}
                tone="accent"
              />
              <StatCard
                icon={Bike}
                label="Domiciliarios"
                value={String(stats?.couriers?.online || 0)}
                hint={`${stats?.couriers?.total || 0} registrados`}
                tone="warning"
              />
            </div>

            {/* Charts */}
            <div className="grid lg:grid-cols-2 gap-4 mb-6">
              <RevenueChart data={revenueChart} />
              <HoursChart data={hoursChart} />
            </div>
            <div className="mb-10">
              <TopBusinessesChart data={topBusinesses} />
            </div>

            {/* Reporte Diario de Repartidores */}
            <div className="mb-10 rounded-3xl bg-card border border-border/60 p-6 shadow-card overflow-hidden">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-display font-bold">Reporte Diario de Repartidores</h2>
                  <p className="text-sm text-muted-foreground">Entregas realizadas hoy por cada repartidor.</p>
                </div>
                <div className="bg-primary/10 text-primary px-4 py-2 rounded-2xl text-sm font-bold flex items-center gap-2">
                  <Bike className="h-4 w-4" />
                  {dailyReport.reduce((acc, curr) => acc + curr.total_deliveries, 0)} Entregas Hoy
                </div>
                <Button 
                  onClick={exportDailyReport} 
                  variant="outline" 
                  size="sm" 
                  className="rounded-2xl gap-2 border-primary/20 hover:bg-primary/5"
                  disabled={dailyReport.length === 0}
                >
                  <Download className="h-4 w-4" />
                  Exportar CSV
                </Button>
              </div>

              <div className="grid gap-6">
                {dailyReport.length === 0 ? (
                  <div className="text-center py-10 border-2 border-dashed border-border/40 rounded-3xl">
                    <p className="text-muted-foreground">No hay entregas registradas hoy todavía.</p>
                  </div>
                ) : (
                  dailyReport.map((courier) => (
                    <div key={courier.id} className="border border-border/40 rounded-2xl overflow-hidden bg-muted/20">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 bg-muted/40 gap-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                            {courier.name.charAt(0)}
                          </div>
                          <div>
                            <h3 className="font-bold">{courier.name}</h3>
                            <p className="text-xs text-muted-foreground">ID: {courier.id}</p>
                          </div>
                        </div>
                        <div className="flex gap-4 w-full md:w-auto">
                          <div className="flex-1 md:flex-none text-center md:text-right">
                            <p className="text-[10px] uppercase font-bold text-muted-foreground">Pedidos</p>
                            <p className="text-lg font-display font-bold">{courier.total_deliveries}</p>
                          </div>
                          <div className="flex-1 md:flex-none text-center md:text-right">
                            <p className="text-[10px] uppercase font-bold text-muted-foreground">Recaudado</p>
                            <p className="text-lg font-display font-bold text-success">{formatCOP(courier.total_revenue || 0)}</p>
                          </div>
                        </div>
                      </div>
                      
                      {courier.orders && courier.orders.length > 0 && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-border/40 text-left text-muted-foreground bg-muted/10">
                                <th className="p-3 font-medium">ID Pedido</th>
                                <th className="p-3 font-medium">Cliente</th>
                                <th className="p-3 font-medium">Negocio</th>
                                <th className="p-3 font-medium">Hora</th>
                                <th className="p-3 font-medium text-right">Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/20">
                              {courier.orders.map((order: any) => (
                                <tr key={order.id} className="hover:bg-white/50 transition-colors">
                                  <td className="p-3 font-mono text-xs">{order.id}</td>
                                  <td className="p-3">{order.customer_name}</td>
                                  <td className="p-3">{order.business_name}</td>
                                  <td className="p-3 text-xs">
                                    {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </td>
                                  <td className="p-3 text-right font-bold">{formatCOP(order.total)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default AdminPanel;
