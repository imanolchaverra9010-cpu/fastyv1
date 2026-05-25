import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Car, ShieldCheck, CheckCircle, Gavel } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { RIDE_STATUS_LABELS, RIDE_REPORT_LABELS, PENALTY_LABELS, formatDeparture } from "@/constants/rides";

const AdminRides = () => {
  const [rides, setRides] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [sosEvents, setSosEvents] = useState<any[]>([]);
  const [penalties, setPenalties] = useState<any[]>([]);
  const [tab, setTab] = useState<"rides" | "reports" | "sos" | "penalties">("rides");

  const load = () => {
    fetch("/api/admin/rides").then((r) => r.ok ? r.json() : []).then(setRides).catch(() => undefined);
    fetch("/api/admin/rides/reports?status=pending").then((r) => r.ok ? r.json() : []).then(setReports).catch(() => undefined);
    fetch("/api/admin/rides/sos?active_only=true").then((r) => r.ok ? r.json() : []).then(setSosEvents).catch(() => undefined);
    fetch("/api/admin/rides/penalties").then((r) => r.ok ? r.json() : []).then(setPenalties).catch(() => undefined);
  };

  useEffect(() => { load(); }, []);

  const resolveReport = async (id: number, status: string) => {
    const response = await fetch(`/api/admin/rides/reports/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) {
      toast({ title: "Error", variant: "destructive" });
      return;
    }
    toast({ title: "Reporte actualizado" });
    load();
  };

  const resolveSos = async (id: number) => {
    const response = await fetch(`/api/admin/rides/sos/${id}/resolve`, { method: "PATCH" });
    if (!response.ok) {
      toast({ title: "Error", variant: "destructive" });
      return;
    }
    toast({ title: "SOS resuelto" });
    load();
  };

  const waivePenalty = async (id: number) => {
    const response = await fetch(`/api/admin/rides/penalties/${id}/waive`, { method: "PATCH" });
    if (!response.ok) {
      toast({ title: "Error", variant: "destructive" });
      return;
    }
    toast({ title: "Penalización condonada" });
    load();
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-gradient-warm">
        <AdminSidebar />
        <SidebarInset className="flex-1">
          <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-border/60 bg-background/75 backdrop-blur-xl px-4 md:px-6">
            <SidebarTrigger className="-ml-1" />
            <h2 className="text-sm font-semibold text-muted-foreground">Viajes compartidos</h2>
          </header>

          <main className="p-4 md:p-8 max-w-6xl mx-auto w-full space-y-6">
            <div>
              <p className="text-sm text-primary font-semibold">Administración</p>
              <h1 className="text-4xl font-display font-bold">Viajes — Fase 2</h1>
              <p className="text-muted-foreground mt-1">Monitorea viajes, reportes y alertas SOS.</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant={tab === "rides" ? "default" : "outline"} className="rounded-xl" onClick={() => setTab("rides")}>
                <Car className="h-4 w-4 mr-2" /> Viajes ({rides.length})
              </Button>
              <Button variant={tab === "reports" ? "default" : "outline"} className="rounded-xl" onClick={() => setTab("reports")}>
                Reportes ({reports.length})
              </Button>
              <Button variant={tab === "sos" ? "destructive" : "outline"} className="rounded-xl" onClick={() => setTab("sos")}>
                <AlertTriangle className="h-4 w-4 mr-2" /> SOS activos ({sosEvents.length})
              </Button>
              <Button variant={tab === "penalties" ? "default" : "outline"} className="rounded-xl" onClick={() => setTab("penalties")}>
                <Gavel className="h-4 w-4 mr-2" /> Penalizaciones ({penalties.filter((p) => !p.waived).length})
              </Button>
            </div>

            {tab === "rides" && (
              <div className="space-y-3">
                {rides.map((ride) => (
                  <Card key={ride.id} className="rounded-2xl">
                    <CardContent className="p-4 flex flex-wrap justify-between gap-3">
                      <div>
                        <p className="font-bold">{ride.pickup_address} → {ride.dropoff_address}</p>
                        <p className="text-sm text-muted-foreground">{formatDeparture(ride.departure_at)} · {ride.driver_name}</p>
                        <p className="text-xs flex items-center gap-1 mt-1">
                          {RIDE_STATUS_LABELS[ride.status] || ride.status}
                          {ride.driver_verified && <ShieldCheck className="h-3 w-3 text-success" />}
                        </p>
                      </div>
                      <Link to={`/viajes/${ride.id}`} className="text-sm text-primary">Ver detalle</Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {tab === "reports" && (
              <div className="space-y-3">
                {reports.length === 0 && <p className="text-muted-foreground">Sin reportes pendientes.</p>}
                {reports.map((rep) => (
                  <Card key={rep.id} className="rounded-2xl">
                    <CardHeader className="pb-2"><CardTitle className="text-base">{RIDE_REPORT_LABELS[rep.category] || rep.category}</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm">{rep.description}</p>
                      <p className="text-xs text-muted-foreground">Viaje: {rep.pickup_address} → {rep.dropoff_address} · Por {rep.reporter_name}</p>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => resolveReport(rep.id, "reviewed")} className="rounded-xl">Marcar revisado</Button>
                        <Button size="sm" variant="outline" onClick={() => resolveReport(rep.id, "resolved")} className="rounded-xl">Resolver</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {tab === "sos" && (
              <div className="space-y-3">
                {sosEvents.length === 0 && <p className="text-muted-foreground">Sin alertas SOS activas.</p>}
                {sosEvents.map((sos) => (
                  <Card key={sos.id} className="rounded-2xl border-destructive/30">
                    <CardContent className="p-4 space-y-2">
                      <p className="font-bold text-destructive flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> SOS — {sos.username}</p>
                      <p className="text-sm">{sos.pickup_address} → {sos.dropoff_address}</p>
                      <p className="text-xs text-muted-foreground">Estado viaje: {RIDE_STATUS_LABELS[sos.ride_status] || sos.ride_status}</p>
                      <div className="flex gap-2">
                        <Link to={`/viajes/${sos.ride_id}`}><Button size="sm" variant="outline" className="rounded-xl">Ver viaje</Button></Link>
                        <Button size="sm" onClick={() => resolveSos(sos.id)} className="rounded-xl"><CheckCircle className="h-4 w-4 mr-1" /> Resolver</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {tab === "penalties" && (
              <div className="space-y-3">
                {penalties.length === 0 && <p className="text-muted-foreground">Sin penalizaciones registradas.</p>}
                {penalties.map((p) => (
                  <Card key={p.id} className={`rounded-2xl ${p.waived ? "opacity-60" : ""}`}>
                    <CardContent className="p-4 flex flex-wrap justify-between gap-3">
                      <div>
                        <p className="font-bold">{p.driver_name} · +{p.points} pts</p>
                        <p className="text-sm">{PENALTY_LABELS[p.reason] || p.reason}</p>
                        <p className="text-xs text-muted-foreground">{p.ride_id || "—"} · {p.source} {p.waived && "· Condonada"}</p>
                      </div>
                      {!p.waived && (
                        <Button size="sm" variant="outline" className="rounded-xl" onClick={() => waivePenalty(p.id)}>Condonar</Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default AdminRides;
