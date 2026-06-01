import { Bike, DollarSign, ShoppingBag, Store, Loader2, Download } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import StatCard from "@/components/StatCard";
import { HoursChart, RevenueChart, TopBusinessesChart } from "@/components/AdminCharts";
import { AdminActionCenter } from "@/components/admin/AdminActionCenter";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminMaintenanceToggle } from "@/components/admin/AdminMaintenanceToggle";
import { Button } from "@/components/ui/button";
import { formatCOP } from "@/data/mock";
import { toast } from "@/hooks/use-toast";

const AdminPanel = () => {
  const [stats, setStats] = useState<any>(null);
  const [revenueChart, setRevenueChart] = useState<any[]>([]);
  const [hoursChart, setHoursChart] = useState<any[]>([]);
  const [topBusinesses, setTopBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [togglingMaintenance, setTogglingMaintenance] = useState(false);
  const [dailyReport, setDailyReport] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [dailyFinance, setDailyFinance] = useState<any>(null);
  const [metricsPeriod, setMetricsPeriod] = useState<"today" | "7d" | "30d">("today");
  const [resolvingSosId, setResolvingSosId] = useState<number | null>(null);


  const fetchMetrics = useCallback(async (period: "today" | "7d" | "30d") => {
    const res = await fetch(`/api/admin/metrics?period=${period}`);
    if (res.ok) setMetrics(await res.json());
  }, []);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [statsRes, revenueRes, hoursRes, topRes, alertsRes, financeRes] = await Promise.all([
          fetch("/api/admin/stats"),
          fetch("/api/admin/revenue-chart"),
          fetch("/api/admin/hours-chart"),
          fetch("/api/admin/top-businesses"),
          fetch("/api/admin/alerts"),
          fetch("/api/finance/daily-summary"),
        ]);

        if (statsRes.ok) setStats(await statsRes.json());
        if (revenueRes.ok) setRevenueChart(await revenueRes.json());
        if (hoursRes.ok) setHoursChart(await hoursRes.json());
        if (topRes.ok) setTopBusinesses(await topRes.json());
        if (alertsRes.ok) setAlerts(await alertsRes.json());
        if (financeRes.ok) setDailyFinance(await financeRes.json());
        
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

  useEffect(() => {
    if (loading) return;
    fetchMetrics(metricsPeriod);
  }, [metricsPeriod, fetchMetrics, loading]);

  useEffect(() => {
    if (loading) return;
    const scanAlerts = () => {
      fetch("/api/admin/push-alerts/scan", { method: "POST" }).catch(() => {});
      fetch("/api/admin/jobs/process-pending", { method: "POST" }).catch(() => {});
    };
    scanAlerts();
    const interval = setInterval(scanAlerts, 3 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loading]);

  const handleResolveSos = async (sosId: number) => {
    setResolvingSosId(sosId);
    try {
      const res = await fetch(`/api/admin/rides/sos/${sosId}/resolve`, { method: "PATCH" });
      if (res.ok) {
        setAlerts((prev: any) => ({
          ...prev,
          ride_sos: (prev?.ride_sos ?? []).filter((s: any) => s.id !== sosId),
          summary: {
            ...prev?.summary,
            total: Math.max(0, (prev?.summary?.total ?? 1) - 1),
            ride_sos: Math.max(0, (prev?.summary?.ride_sos ?? 1) - 1),
          },
        }));
        toast({ title: "SOS resuelto", description: "La alerta fue marcada como atendida." });
      }
    } catch {
      toast({ title: "Error", description: "No se pudo resolver la alerta.", variant: "destructive" });
    } finally {
      setResolvingSosId(null);
    }
  };

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
    
    const today = new Date().toISOString().split('T')[0];
    
    // Generar XML para Excel con estilos básicos
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
 </Styles>
 <Worksheet ss:Name="Reporte Diario">
  <Table>
   <Column ss:Width="100"/>
   <Column ss:Width="200"/>
   <Column ss:Width="100"/>
   <Column ss:Width="120"/>
   <Row ss:Height="20">
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">ID Repartidor</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Nombre</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Entregas Hoy</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Total Recaudado</Data></Cell>
   </Row>`;

    const xmlRows = dailyReport.map(c => `
   <Row>
    <Cell ss:StyleID="sDefault"><Data ss:Type="String">${c.id}</Data></Cell>
    <Cell ss:StyleID="sDefault"><Data ss:Type="String">${c.name}</Data></Cell>
    <Cell ss:StyleID="sDefault"><Data ss:Type="Number">${c.total_deliveries}</Data></Cell>
    <Cell ss:StyleID="sMoney"><Data ss:Type="Number">${c.total_revenue || 0}</Data></Cell>
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
    link.download = `reporte_diario_${today}.xls`;
    link.click();
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-warm">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AdminLayout
      breadcrumb="Resumen"
      eyebrow="Administración"
      title="Panel de control"
      description="Visión completa de la operación de Fasty."
      headerActions={
        <AdminMaintenanceToggle
          enabled={maintenanceMode}
          disabled={togglingMaintenance}
          onToggle={handleToggleMaintenance}
        />
      }
    >
            <div className="mb-8 grid grid-cols-2 gap-2.5 sm:mb-10 sm:gap-4 lg:grid-cols-4">
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
                hint={`${stats?.couriers?.total || 0} registrados · ${alerts?.summary?.total ?? 0} alertas`}
                tone="warning"
              />
            </div>

            <AdminActionCenter
              alerts={alerts}
              metrics={metrics}
              dailyFinance={dailyFinance}
              metricsPeriod={metricsPeriod}
              onMetricsPeriodChange={setMetricsPeriod}
              onResolveSos={handleResolveSos}
              resolvingSosId={resolvingSosId}
            />

            {/* Charts */}
            <div className="mb-6 grid gap-4 lg:grid-cols-2">
              <RevenueChart data={revenueChart} />
              <HoursChart data={hoursChart} />
            </div>
            <div className="mb-10">
              <TopBusinessesChart data={topBusinesses} />
            </div>

            {/* Reporte Diario de Repartidores */}
            <div className="mb-10 overflow-hidden rounded-2xl border border-border/60 bg-card p-4 shadow-card sm:rounded-3xl sm:p-6">
              <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <h2 className="font-display text-lg font-bold sm:text-xl">Reporte Diario de Repartidores</h2>
                  <p className="text-xs text-muted-foreground sm:text-sm">Entregas realizadas hoy por cada repartidor.</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="flex items-center justify-center gap-2 rounded-2xl bg-primary/10 px-3 py-2 text-xs font-bold text-primary sm:px-4 sm:text-sm">
                    <Bike className="h-4 w-4 shrink-0" />
                    {dailyReport.reduce((acc, curr) => acc + curr.total_deliveries, 0)} Entregas Hoy
                  </div>
                  <Button 
                    onClick={exportDailyReport} 
                    variant="outline" 
                    size="sm" 
                    className="h-10 w-full gap-2 rounded-2xl border-primary/20 hover:bg-primary/5 sm:w-auto"
                    disabled={dailyReport.length === 0}
                  >
                    <Download className="h-4 w-4" />
                    Exportar CSV
                  </Button>
                </div>
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
                        <div className="-mx-4 overflow-x-auto sm:mx-0">
                          <table className="w-full min-w-[520px] text-sm">
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
    </AdminLayout>
  );
};

export default AdminPanel;
