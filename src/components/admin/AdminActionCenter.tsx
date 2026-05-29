import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Bike,
  Clock,
  CreditCard,
  Download,
  MapPin,
  Package,
  ShieldAlert,
  Timer,
  TrendingDown,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import StatCard from "@/components/StatCard";
import { formatCOP } from "@/data/mock";

interface AdminActionCenterProps {
  alerts: any;
  metrics: any;
  dailyFinance: any;
  metricsPeriod: "today" | "7d" | "30d";
  onMetricsPeriodChange: (period: "today" | "7d" | "30d") => void;
  onResolveSos: (sosId: number) => void;
  resolvingSosId: number | null;
}

const formatMinutes = (minutes: number) => {
  if (!minutes) return "—";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m}m`;
};

export function AdminActionCenter({
  alerts,
  metrics,
  dailyFinance,
  metricsPeriod,
  onMetricsPeriodChange,
  onResolveSos,
  resolvingSosId,
}: AdminActionCenterProps) {
  const alertTotal = alerts?.summary?.total ?? 0;
  const wompiIssues = dailyFinance?.reconciliation?.issues ?? metrics?.wompi_today?.issues ?? 0;

  const exportWompiCsv = () => {
    window.open("/api/finance/payment-reconciliation/export?today_only=true", "_blank");
  };

  return (
    <div className="mb-8 space-y-5 sm:mb-10 sm:space-y-8">
      {alertTotal > 0 && (
        <div className="flex flex-col gap-4 rounded-2xl border-2 border-destructive/30 bg-destructive/5 p-4 sm:rounded-3xl sm:p-5 md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-destructive/10 sm:h-12 sm:w-12">
              <AlertTriangle className="h-5 w-5 animate-pulse text-destructive sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0">
              <p className="font-display text-base font-bold text-destructive sm:text-lg">{alertTotal} alertas activas</p>
              <p className="text-xs text-muted-foreground sm:text-sm">
                {alerts?.summary?.unassigned_orders ?? 0} sin asignar ·{" "}
                {alerts?.summary?.ride_sos ?? 0} SOS ·{" "}
                {alerts?.summary?.offline_couriers ?? 0} domiciliarios offline
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row md:ml-auto">
            <Button asChild variant="destructive" size="sm" className="h-10 w-full rounded-xl sm:w-auto">
              <Link to="/admin/pedidos">Ver pedidos</Link>
            </Button>
            {(alerts?.summary?.ride_sos ?? 0) > 0 && (
              <Button asChild variant="outline" size="sm" className="h-10 w-full rounded-xl border-destructive/30 sm:w-auto">
                <Link to="/admin/viajes">Ver viajes SOS</Link>
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
        {(["today", "7d", "30d"] as const).map((p) => (
          <button
            key={p}
            onClick={() => onMetricsPeriodChange(p)}
            className={`shrink-0 rounded-xl px-4 py-2.5 text-xs font-bold transition-all active:scale-95 sm:py-2 ${
              metricsPeriod === p
                ? "bg-primary text-white shadow-glow"
                : "border border-border/40 bg-card/50 text-muted-foreground hover:text-foreground"
            }`}
          >
            {p === "today" ? "Hoy" : p === "7d" ? "7 días" : "30 días"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
        <StatCard
          icon={Timer}
          label="Tiempo medio entrega"
          value={formatMinutes(metrics?.avg_delivery_minutes ?? 0)}
          hint={`${metrics?.delivered_orders ?? 0} entregados`}
          tone="primary"
        />
        <StatCard
          icon={TrendingDown}
          label="Tasa cancelación"
          value={`${metrics?.cancellation_rate_pct ?? 0}%`}
          hint={`${metrics?.cancelled_orders ?? 0} de ${metrics?.total_orders ?? 0}`}
          tone={Number(metrics?.cancellation_rate_pct ?? 0) > 10 ? "warning" : "success"}
        />
        <StatCard
          icon={CreditCard}
          label="Wompi hoy"
          value={String(wompiIssues)}
          hint={`${wompiIssues === 0 ? "Sin discrepancias" : "Alertas de conciliación"}`}
          tone={wompiIssues > 0 ? "warning" : "success"}
        />
        <StatCard
          icon={Package}
          label="Pedidos del periodo"
          value={String(metrics?.total_orders ?? 0)}
          hint={`${metrics?.delivered_orders ?? 0} entregados`}
          tone="accent"
        />
      </div>

      <div className="grid gap-4 sm:gap-6 xl:grid-cols-3">
        <Card className="rounded-2xl border-orange-500/20 shadow-card sm:rounded-3xl">
          <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-2">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <Clock className="h-5 w-5 text-orange-500" />
              Sin asignar &gt; {alerts?.threshold_minutes ?? 10} min
            </CardTitle>
            <CardDescription>Pedidos esperando domiciliario.</CardDescription>
          </CardHeader>
          <CardContent className="max-h-72 space-y-2 overflow-auto px-4 pb-4 sm:px-6 sm:pb-6">
            {(alerts?.unassigned_orders ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Sin pedidos retrasados.</p>
            ) : (
              alerts.unassigned_orders.map((order: any) => (
                <div key={order.id} className="rounded-2xl border p-3 text-sm bg-orange-500/5">
                  <div className="flex justify-between gap-2">
                    <b className="font-mono">#{order.id}</b>
                    <span className="text-orange-600 font-bold">{order.waiting_minutes} min</span>
                  </div>
                  <p className="font-medium">{order.customer_name}</p>
                  <p className="text-muted-foreground text-xs truncate">
                    {order.order_type === "open" ? order.origin_name : order.business_name} → {order.delivery_address}
                  </p>
                  <Button asChild variant="link" className="h-auto p-0 text-xs mt-1">
                    <Link to={`/admin/pedidos`}>Gestionar</Link>
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-destructive/20 shadow-card sm:rounded-3xl">
          <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-2">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              SOS viajes activos
            </CardTitle>
            <CardDescription>Alertas de seguridad en viajes.</CardDescription>
          </CardHeader>
          <CardContent className="max-h-72 space-y-2 overflow-auto px-4 pb-4 sm:px-6 sm:pb-6">
            {(alerts?.ride_sos ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Sin alertas SOS activas.</p>
            ) : (
              alerts.ride_sos.map((sos: any) => (
                <div key={sos.id} className="rounded-2xl border border-destructive/20 p-3 text-sm bg-destructive/5">
                  <div className="flex justify-between gap-2">
                    <b>{sos.username}</b>
                    <span className="text-xs text-muted-foreground">
                      {new Date(sos.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{sos.pickup_address} → {sos.dropoff_address}</p>
                  {sos.message && <p className="text-xs mt-1 italic">{sos.message}</p>}
                  <div className="flex gap-2 mt-2">
                    <Button asChild variant="outline" size="sm" className="h-7 text-xs rounded-lg">
                      <Link to="/admin/viajes">Ver viaje</Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 text-xs rounded-lg"
                      disabled={resolvingSosId === sos.id}
                      onClick={() => onResolveSos(sos.id)}
                    >
                      Resolver
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-amber-500/20 shadow-card sm:rounded-3xl">
          <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-2">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <WifiOff className="h-5 w-5 text-amber-600" />
              Domiciliarios offline con pedidos
            </CardTitle>
            <CardDescription>Pueden afectar el rastreo en vivo.</CardDescription>
          </CardHeader>
          <CardContent className="max-h-72 space-y-2 overflow-auto px-4 pb-4 sm:px-6 sm:pb-6">
            {(alerts?.offline_couriers_with_orders ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Todos los domiciliarios activos están online.</p>
            ) : (
              alerts.offline_couriers_with_orders.map((courier: any) => (
                <div key={courier.id} className="rounded-2xl border p-3 text-sm bg-amber-500/5">
                  <div className="flex justify-between gap-2">
                    <b>{courier.name}</b>
                    <span className="text-amber-700 font-bold uppercase text-xs">{courier.courier_status}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{courier.active_orders} pedido(s) activo(s)</p>
                  <p className="text-xs font-mono truncate">IDs: {courier.order_ids}</p>
                  <Button asChild variant="link" className="h-auto p-0 text-xs mt-1">
                    <Link to="/admin/domiciliarios">Ver domiciliario</Link>
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:gap-6 xl:grid-cols-2">
        <Card className="rounded-2xl shadow-card sm:rounded-3xl">
          <CardHeader className="flex flex-row items-start justify-between gap-4 p-4 pb-2 sm:p-6 sm:pb-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm sm:text-base"><Bike className="h-5 w-5 text-primary" /> Ganancia domiciliarios</CardTitle>
              <CardDescription>60% de domicilio + recargo nocturno (periodo seleccionado).</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="max-h-64 space-y-2 overflow-auto px-4 pb-4 sm:px-6 sm:pb-6">
            {(metrics?.courier_earnings ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sin entregas en el periodo.</p>
            ) : (
              metrics.courier_earnings.map((row: any) => (
                <div key={row.id} className="flex justify-between items-center rounded-2xl border p-3 text-sm">
                  <div>
                    <p className="font-bold">{row.name}</p>
                    <p className="text-xs text-muted-foreground">{row.delivered_orders} entregas</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-success">{formatCOP(row.courier_earnings)}</p>
                    <p className="text-xs text-muted-foreground">Bruto {formatCOP(row.gross_fees)}</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-card sm:rounded-3xl">
          <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-2">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base"><MapPin className="h-5 w-5 text-primary" /> Ventas por negocio</CardTitle>
            <CardDescription>Liquidación estimada con comisión 8%.</CardDescription>
          </CardHeader>
          <CardContent className="max-h-64 space-y-2 overflow-auto px-4 pb-4 sm:px-6 sm:pb-6">
            {(metrics?.business_earnings ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sin ventas en el periodo.</p>
            ) : (
              metrics.business_earnings.map((row: any) => (
                <div key={row.id} className="flex justify-between items-center rounded-2xl border p-3 text-sm">
                  <div>
                    <p className="font-bold">{row.name}</p>
                    <p className="text-xs text-muted-foreground">{row.orders} pedidos</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatCOP(row.net_settlement)}</p>
                    <p className="text-xs text-muted-foreground">Ventas {formatCOP(row.gross_sales)}</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-primary/20 shadow-card sm:rounded-3xl">
        <CardHeader className="flex flex-col gap-4 p-4 pb-2 sm:p-6 sm:pb-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <CreditCard className="h-5 w-5 text-primary" />
              Conciliación Wompi — hoy
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {dailyFinance?.reconciliation?.orders_checked ?? 0} pedidos revisados ·{" "}
              {formatCOP(dailyFinance?.reconciliation?.approved_amount ?? 0)} aprobados
            </CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" size="sm" className="h-10 w-full gap-2 rounded-xl sm:w-auto" onClick={exportWompiCsv}>
              <Download className="h-4 w-4" /> Exportar CSV
            </Button>
            <Button asChild variant="soft" size="sm" className="h-10 w-full rounded-xl sm:w-auto">
              <Link to="/admin/operacion">Centro financiero</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="max-h-56 space-y-2 overflow-auto px-4 pb-4 sm:px-6 sm:pb-6">
          {(dailyFinance?.reconciliation?.issue_items ?? []).length === 0 ? (
            <p className="text-sm text-success font-medium py-4 text-center">✓ Sin discrepancias hoy en pagos Wompi.</p>
          ) : (
            dailyFinance.reconciliation.issue_items.map((row: any) => (
              <div key={`${row.order_id}-${row.payment_id || "none"}`} className="rounded-2xl border p-3 text-sm flex justify-between gap-3">
                <div>
                  <b className="font-mono">#{row.order_id}</b>
                  <p className="text-muted-foreground text-xs">{row.order_status} · {row.payment_method}</p>
                </div>
                <div className="text-right">
                  <span className="text-destructive font-bold text-xs uppercase">{row.reconciliation_status}</span>
                  <p className="text-xs">{formatCOP(row.order_total)} / {formatCOP(row.payment_amount || 0)}</p>
                </div>
              </div>
            ))
          )}
          {(dailyFinance?.pending_settlements?.count ?? 0) > 0 && (
            <div className="rounded-2xl bg-muted/40 p-3 text-sm flex justify-between mt-2">
              <span>Liquidaciones pendientes</span>
              <b>{dailyFinance.pending_settlements.count} · {formatCOP(dailyFinance.pending_settlements.amount)}</b>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
