import { Bike, DollarSign, ShoppingBag, Store, Users, Loader2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useState, useEffect } from "react";
import StatCard from "@/components/StatCard";
import { HoursChart, RevenueChart, TopBusinessesChart } from "@/components/AdminCharts";
import { Button } from "@/components/ui/button";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";
import { formatCOP } from "@/data/mock";

const AdminPanel = () => {
  const [stats, setStats] = useState<any>(null);
  const [revenueChart, setRevenueChart] = useState<any[]>([]);
  const [hoursChart, setHoursChart] = useState<any[]>([]);
  const [topBusinesses, setTopBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [statsRes, revenueRes, hoursRes, topRes] = await Promise.all([
          fetch("http://localhost:8000/admin/stats"),
          fetch("http://localhost:8000/admin/revenue-chart"),
          fetch("http://localhost:8000/admin/hours-chart"),
          fetch("http://localhost:8000/admin/top-businesses")
        ]);

        if (statsRes.ok) setStats(await statsRes.json());
        if (revenueRes.ok) setRevenueChart(await revenueRes.json());
        if (hoursRes.ok) setHoursChart(await hoursRes.json());
        if (topRes.ok) setTopBusinesses(await topRes.json());
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

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
              Dashboard
            </h2>
          </header>

          <main className="p-4 md:p-8 max-w-7xl mx-auto w-full">
            <div className="mb-8">
              <p className="text-sm text-primary font-semibold">Administración</p>
              <h1 className="text-4xl font-display font-bold tracking-tight">Panel de control</h1>
              <p className="text-muted-foreground mt-1">Visión completa de la operación de Rapidito.</p>
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
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default AdminPanel;
