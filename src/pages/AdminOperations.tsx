import { useEffect, useState } from "react";
import { AlertCircle, Banknote, Bike, ClipboardList, CreditCard, DollarSign, FileText, Loader2, MapPinned, Scale, ShieldCheck, Store, TrendingUp } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import StatCard from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/context/AuthContext";
import { formatCOP } from "@/data/mock";

const toNumber = (value: unknown) => Number(value || 0);

const AdminOperations = () => {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [reconciliation, setReconciliation] = useState<any>(null);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reconciliationTodayOnly, setReconciliationTodayOnly] = useState(true);

  useEffect(() => {
    const fetchOperations = async () => {
      setLoading(true);
      setError(false);
      try {
        const headers = user?.token ? { Authorization: `Bearer ${user.token}` } : undefined;
        const response = await fetch("/api/admin/operations", { headers });
        const reconciliationResponse = await fetch(
          `/api/finance/payment-reconciliation?today_only=${reconciliationTodayOnly}&issues_only=false`,
          { headers },
        );
        const settlementsResponse = await fetch("/api/finance/settlements", { headers });
        const dailySummaryResponse = await fetch("/api/finance/daily-summary", { headers });
        if (!response.ok) throw new Error("No se pudo cargar la operación admin");
        setData(await response.json());
        if (reconciliationResponse.ok) setReconciliation(await reconciliationResponse.json());
        if (settlementsResponse.ok) setSettlements(await settlementsResponse.json());
        if (dailySummaryResponse.ok) {
          const summary = await dailySummaryResponse.json();
          setReconciliation((prev: any) => ({
            ...(prev || {}),
            daily_summary: summary,
          }));
        }
      } catch (err) {
        console.error("Error fetching admin operations:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchOperations();
  }, [user?.token, reconciliationTodayOnly]);

  const exportCsv = (rows: any[], filename: string) => {
    if (!rows?.length) return;
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(","), ...rows.map((row) => headers.map((key) => JSON.stringify(row[key] ?? "")).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
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
      breadcrumb="Operación avanzada"
      eyebrow="Administración robusta"
      title="Centro financiero y operativo"
      description="Comisiones, liquidaciones, pagos, desempeño, auditoría, reclamos y tarifas."
      toolbar={
        <>
          <Button variant="outline" className="h-10 w-full rounded-2xl sm:w-auto" onClick={() => exportCsv(data?.business_sales || [], "liquidaciones_negocios.csv")}>
            <FileText className="mr-2 h-4 w-4" /> Exportar liquidaciones
          </Button>
          <Button
            variant="outline"
            className="h-10 w-full rounded-2xl sm:w-auto"
            onClick={() => window.open(`/api/finance/payment-reconciliation/export?today_only=${reconciliationTodayOnly}`, "_blank")}
          >
            <CreditCard className="mr-2 h-4 w-4" /> Exportar conciliación Wompi
          </Button>
        </>
      }
    >
      <div className="space-y-6 sm:space-y-8">
            {error && (
              <Card className="border-destructive/30 bg-destructive/5">
                <CardContent className="p-4 flex items-center gap-3 text-destructive">
                  <AlertCircle className="h-5 w-5" /> No se pudo cargar el centro operativo.
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
              <StatCard icon={DollarSign} label="Ventas brutas" value={formatCOP(toNumber(data?.financial?.gross_sales))} hint="Pedidos no cancelados" tone="success" />
              <StatCard icon={Banknote} label="Ingreso domicilio" value={formatCOP(toNumber(data?.financial?.delivery_income))} hint="Domicilio + nocturno" tone="primary" />
              <StatCard icon={ClipboardList} label="Pedidos activos" value={String(toNumber(data?.financial?.active_orders))} hint={`${toNumber(data?.financial?.delivered_orders)} entregados`} tone="accent" />
              <StatCard icon={Scale} label="Comisión base" value={`${Math.round(toNumber(data?.settings?.commission_rate) * 100)}%`} hint={data?.settings?.zone_pricing_model || "Configurable"} tone="warning" />
            </div>

            <div className="grid xl:grid-cols-2 gap-6">
              <Card className="rounded-3xl shadow-card">
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2"><Store className="h-5 w-5 text-primary" /> Ventas y liquidaciones por negocio</CardTitle>
                    <CardDescription>Base para comisiones y pagos pendientes a aliados.</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader><TableRow><TableHead>Negocio</TableHead><TableHead>Pedidos</TableHead><TableHead>Ventas</TableHead><TableHead>Comisión</TableHead><TableHead>Liquidar</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {(data?.business_sales || []).map((row: any) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell>{row.orders}</TableCell>
                          <TableCell>{formatCOP(toNumber(row.sales))}</TableCell>
                          <TableCell>{formatCOP(toNumber(row.commission))}</TableCell>
                          <TableCell className="font-bold text-success">{formatCOP(toNumber(row.settlement))}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card className="rounded-3xl shadow-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Bike className="h-5 w-5 text-primary" /> Desempeño de domiciliarios</CardTitle>
                  <CardDescription>Entregas, cancelaciones e ingreso generado por domicilio.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader><TableRow><TableHead>Domiciliario</TableHead><TableHead>Estado</TableHead><TableHead>Entregas</TableHead><TableHead>Cancelados</TableHead><TableHead>Ingreso</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {(data?.courier_performance || []).map((row: any) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell>{row.status}</TableCell>
                          <TableCell>{row.delivered_orders}</TableCell>
                          <TableCell>{row.cancelled_orders}</TableCell>
                          <TableCell>{formatCOP(toNumber(row.generated_delivery_income))}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            <div className="grid xl:grid-cols-2 gap-6">
              <Card className="rounded-3xl shadow-card">
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" /> Conciliación de pagos</CardTitle>
                      <CardDescription>Detecta pagos faltantes, montos diferentes o estados inconsistentes.</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={reconciliationTodayOnly ? "default" : "outline"}
                        className="rounded-xl text-xs"
                        onClick={() => setReconciliationTodayOnly(true)}
                      >
                        Hoy
                      </Button>
                      <Button
                        size="sm"
                        variant={!reconciliationTodayOnly ? "default" : "outline"}
                        className="rounded-xl text-xs"
                        onClick={() => setReconciliationTodayOnly(false)}
                      >
                        Histórico
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 max-h-96 overflow-auto">
                  <div className="rounded-2xl border p-3 flex justify-between"><span>Registros revisados</span><b>{toNumber(reconciliation?.summary?.total)}</b></div>
                  <div className="rounded-2xl border p-3 flex justify-between"><span>Alertas</span><b className={toNumber(reconciliation?.summary?.issues) > 0 ? "text-destructive" : "text-success"}>{toNumber(reconciliation?.summary?.issues)}</b></div>
                  <div className="rounded-2xl border p-3 flex justify-between"><span>Aprobado Wompi</span><b className="text-success">{formatCOP(toNumber(reconciliation?.summary?.approved_amount))}</b></div>
                  {(reconciliation?.items || []).filter((row: any) => row.reconciliation_status !== "ok").slice(0, 12).map((row: any) => (
                    <div key={`${row.order_id}-${row.payment_id || "none"}`} className="rounded-2xl border p-3 text-sm">
                      <div className="flex justify-between gap-3"><b>#{row.order_id}</b><span className="text-destructive font-semibold">{row.reconciliation_status}</span></div>
                      <p className="text-muted-foreground">Pedido: {row.order_status} · Pago: {row.payment_status || "sin pago"}</p>
                      <p>{formatCOP(toNumber(row.order_total))} / {formatCOP(toNumber(row.payment_amount))}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="rounded-3xl shadow-card">
                <CardHeader><CardTitle className="flex items-center gap-2"><Banknote className="h-5 w-5 text-primary" /> Liquidaciones generadas</CardTitle><CardDescription>Pagos pendientes o completados a negocios y domiciliarios.</CardDescription></CardHeader>
                <CardContent className="space-y-2 max-h-96 overflow-auto">
                  {settlements.length === 0 && <p className="text-sm text-muted-foreground">Aún no hay liquidaciones generadas desde el módulo financiero.</p>}
                  {settlements.map((row: any) => (
                    <div key={row.id} className="rounded-2xl border p-3 text-sm">
                      <div className="flex justify-between gap-3"><b>{row.target_type} #{row.target_id}</b><span className="capitalize">{row.status}</span></div>
                      <p className="font-bold">{formatCOP(toNumber(row.net_amount))}</p>
                      <p className="text-muted-foreground">Bruto {formatCOP(toNumber(row.gross_amount))} · Comisión {formatCOP(toNumber(row.commission_amount))}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
              <Card className="rounded-3xl shadow-card">
                <CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" /> Historial de pagos</CardTitle><CardDescription>Resumen por método de pago.</CardDescription></CardHeader>
                <CardContent className="space-y-3">
                  {(data?.payments || []).map((row: any) => (
                    <div key={row.payment_method} className="flex items-center justify-between rounded-2xl border p-3">
                      <span className="font-medium capitalize">{row.payment_method}</span>
                      <span className="text-right"><b>{formatCOP(toNumber(row.amount))}</b><br /><small className="text-muted-foreground">{row.count} pagos</small></span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="rounded-3xl shadow-card">
                <CardHeader><CardTitle className="flex items-center gap-2"><MapPinned className="h-5 w-5 text-primary" /> Tarifas por zona</CardTitle><CardDescription>Lectura actual de tarifas usadas.</CardDescription></CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl border p-3"><p className="text-muted-foreground">Domicilio mínimo</p><b>{formatCOP(toNumber(data?.zone_fees?.min_fee))}</b></div>
                  <div className="rounded-2xl border p-3"><p className="text-muted-foreground">Domicilio máximo</p><b>{formatCOP(toNumber(data?.zone_fees?.max_fee))}</b></div>
                  <div className="rounded-2xl border p-3"><p className="text-muted-foreground">Promedio</p><b>{formatCOP(toNumber(data?.zone_fees?.avg_fee))}</b></div>
                  <div className="rounded-2xl border p-3"><p className="text-muted-foreground">Nocturno prom.</p><b>{formatCOP(toNumber(data?.zone_fees?.avg_night_fee))}</b></div>
                </CardContent>
              </Card>

              <Card className="rounded-3xl shadow-card">
                <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" /> Reporte 30 días</CardTitle><CardDescription>Ventas diarias recientes.</CardDescription></CardHeader>
                <CardContent className="space-y-2 max-h-72 overflow-auto">
                  {(data?.daily_sales || []).map((row: any) => (
                    <div key={row.date} className="flex justify-between border-b pb-2 text-sm"><span>{row.date}</span><span className="font-bold">{formatCOP(toNumber(row.sales))}</span></div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <div className="grid xl:grid-cols-2 gap-6">
              <Card className="rounded-3xl shadow-card">
                <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /> Auditoría de acciones</CardTitle><CardDescription>Últimos cambios de estado registrados.</CardDescription></CardHeader>
                <CardContent className="space-y-2 max-h-96 overflow-auto">
                  {(data?.audit || []).map((row: any, index: number) => (
                    <div key={`${row.order_id}-${index}`} className="rounded-2xl border p-3 text-sm">
                      <div className="flex justify-between gap-3"><b>#{row.order_id}</b><span className="text-primary font-semibold">{row.status}</span></div>
                      <p className="text-muted-foreground">{row.business_name || "Sin negocio"} · {row.customer_name || "Cliente"}</p>
                      <p className="text-xs text-muted-foreground">{row.changed_at}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="rounded-3xl shadow-card">
                <CardHeader><CardTitle className="flex items-center gap-2"><AlertCircle className="h-5 w-5 text-primary" /> Soporte y reclamos</CardTitle><CardDescription>Pedidos cancelados para seguimiento operativo.</CardDescription></CardHeader>
                <CardContent className="space-y-2 max-h-96 overflow-auto">
                  {(data?.support_cases || []).map((row: any) => (
                    <div key={row.id} className="rounded-2xl border p-3 text-sm">
                      <div className="flex justify-between gap-3"><b>#{row.id}</b><span>{row.customer_phone || "Sin teléfono"}</span></div>
                      <p>{row.customer_name || "Cliente"}</p>
                      <p className="text-muted-foreground">{row.cancellation_reason || "Sin motivo registrado"}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
      </div>
    </AdminLayout>
  );
};

export default AdminOperations;
