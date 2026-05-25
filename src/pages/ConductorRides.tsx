import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Car, Clock, MapPin, Users, AlertTriangle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCOP } from "@/data/mock";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { getPreciseCurrentPosition, isUsablePosition } from "@/utils/geolocation";
import { RIDE_STATUS_LABELS, RIDE_PAYMENT_LABELS, formatDeparture } from "@/constants/rides";

const emptyForm = {
  pickup_address: "",
  dropoff_address: "",
  departure_at: "",
  seats_total: "4",
  price_per_seat: "",
  payment_method: "cash",
  notes: "",
};

const ConductorRides = () => {
  const { user } = useAuth();
  const [myRides, setMyRides] = useState<any[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [publishing, setPublishing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [eligibility, setEligibility] = useState<{ eligible: boolean; vehicle?: string; message?: string } | null>(null);

  const load = () => {
    fetch("/api/rides/driver-eligibility")
      .then((res) => (res.ok ? res.json() : null))
      .then(setEligibility)
      .catch(() => undefined);
    fetch("/api/rides/me")
      .then((res) => (res.ok ? res.json() : []))
      .then(setMyRides)
      .catch(() => undefined);
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const hasActiveRide = myRides.some((ride) => ["driver_arriving", "in_progress"].includes(ride.status));
    if (!hasActiveRide) return;

    const pushLocation = async () => {
      try {
        const pos = await getPreciseCurrentPosition({ desiredAccuracy: 120, fallbackAccuracy: 500, timeout: 8000 });
        if (!isUsablePosition(pos, 500)) return;
        await fetch(`/api/couriers/${user.id}/location`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat: pos.latitude, lng: pos.longitude }),
        });
      } catch {
        // ignore intermittent GPS errors
      }
    };

    pushLocation();
    const timer = setInterval(pushLocation, 15000);
    return () => clearInterval(timer);
  }, [user?.id, myRides]);

  const publishRide = async () => {
    if (!form.pickup_address.trim() || !form.dropoff_address.trim() || !form.price_per_seat) {
      toast({ title: "Completa los campos", description: "Origen, destino y precio por cupo son obligatorios.", variant: "destructive" });
      return;
    }
    setPublishing(true);
    try {
      const response = await fetch("/api/rides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup_address: form.pickup_address.trim(),
          dropoff_address: form.dropoff_address.trim(),
          departure_at: form.departure_at || null,
          seats_total: Number(form.seats_total) || 4,
          price_per_seat: Number(form.price_per_seat),
          payment_method: form.payment_method,
          notes: form.notes.trim() || null,
        }),
      });
      if (!response.ok) {
        throw new Error((await response.json().catch(() => ({}))).detail || "No se pudo publicar");
      }
      toast({ title: "Viaje publicado", description: "Los pasajeros ya pueden reservar cupos." });
      setForm(emptyForm);
      setShowForm(false);
      load();
    } catch (error) {
      toast({
        title: "Error al publicar",
        description: error instanceof Error ? error.message : "Intenta de nuevo",
        variant: "destructive",
      });
    } finally {
      setPublishing(false);
    }
  };

  const updateStatus = async (rideId: string, status: string) => {
    const response = await fetch(`/api/rides/${rideId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) {
      toast({
        title: "No se pudo actualizar",
        description: (await response.json().catch(() => ({}))).detail || "Intenta de nuevo",
        variant: "destructive",
      });
      return;
    }
    load();
  };

  const activeRides = myRides.filter((r) => !["completed", "cancelled"].includes(r.status));
  const pastRides = myRides.filter((r) => ["completed", "cancelled"].includes(r.status));

  return (
    <div className="min-h-screen bg-gradient-warm pb-20">
      <main className="container max-w-6xl pt-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link to="/domiciliario" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Volver a domicilios
          </Link>
          <span className="text-xs font-bold uppercase tracking-wider text-primary bg-primary/10 px-3 py-1 rounded-full">Módulo Viajes</span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-display font-bold flex items-center gap-2">
            <Car className="h-8 w-8 text-primary" /> Publicar viajes
          </h1>
          {eligibility?.eligible && (
            <Button onClick={() => setShowForm((v) => !v)} className="rounded-xl">
              <Plus className="h-4 w-4 mr-2" /> {showForm ? "Ocultar formulario" : "Nuevo viaje"}
            </Button>
          )}
        </div>

        {eligibility && !eligibility.eligible && (
          <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4 flex gap-3">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Tu vehículo no está habilitado para viajes</p>
              <p className="text-sm text-muted-foreground">{eligibility.message}</p>
              {eligibility.vehicle && <p className="text-sm mt-1">Vehículo registrado: <b>{eligibility.vehicle}</b></p>}
              <p className="text-sm mt-2">Actualiza tu vehículo a carro/auto en tu perfil de domiciliario para publicar viajes.</p>
            </div>
          </div>
        )}

        {showForm && eligibility?.eligible && (
          <Card className="rounded-3xl shadow-glow">
            <CardHeader><CardTitle>Publicar un viaje</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Define la ruta y los cupos. Los pasajeros eligen tu viaje; ellos no proponen rutas.
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                <Input
                  placeholder="Origen (ej: Parque Central)"
                  value={form.pickup_address}
                  onChange={(e) => setForm((f) => ({ ...f, pickup_address: e.target.value }))}
                  className="rounded-xl"
                />
                <Input
                  placeholder="Destino (ej: Universidad)"
                  value={form.dropoff_address}
                  onChange={(e) => setForm((f) => ({ ...f, dropoff_address: e.target.value }))}
                  className="rounded-xl"
                />
                <Input
                  type="datetime-local"
                  value={form.departure_at}
                  onChange={(e) => setForm((f) => ({ ...f, departure_at: e.target.value }))}
                  className="rounded-xl"
                />
                <Input
                  type="number"
                  min={1}
                  max={6}
                  placeholder="Cupos totales"
                  value={form.seats_total}
                  onChange={(e) => setForm((f) => ({ ...f, seats_total: e.target.value }))}
                  className="rounded-xl"
                />
                <Input
                  type="number"
                  min={1}
                  placeholder="Precio por cupo (COP)"
                  value={form.price_per_seat}
                  onChange={(e) => setForm((f) => ({ ...f, price_per_seat: e.target.value }))}
                  className="rounded-xl"
                />
                <select
                  value={form.payment_method}
                  onChange={(e) => setForm((f) => ({ ...f, payment_method: e.target.value }))}
                  className="rounded-xl border bg-background px-3 h-10"
                >
                  <option value="cash">Efectivo</option>
                  <option value="transfer">Transferencia</option>
                </select>
              </div>
              <Textarea
                placeholder="Notas para pasajeros (opcional)"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="rounded-xl"
              />
              <Button onClick={publishRide} disabled={publishing} className="rounded-xl">
                {publishing ? "Publicando..." : "Publicar viaje"}
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid lg:grid-cols-[1fr_380px] gap-6">
          <Card className="rounded-3xl shadow-glow">
            <CardHeader><CardTitle>Mis viajes activos</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {activeRides.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {eligibility?.eligible ? "Aún no has publicado viajes." : "Habilita tu vehículo tipo carro para publicar."}
                </p>
              )}
              {activeRides.map((ride) => (
                <div key={ride.id} className="rounded-2xl border p-4 space-y-3">
                  <div className="flex flex-wrap justify-between gap-2">
                    <p className="font-bold flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      {ride.pickup_address} → {ride.dropoff_address}
                    </p>
                    <span className="text-xs font-bold uppercase px-2 py-1 rounded-full bg-primary/10 text-primary">
                      {RIDE_STATUS_LABELS[ride.status] || ride.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {formatDeparture(ride.departure_at)}</span>
                    <span className="flex items-center gap-1"><Users className="h-4 w-4" /> {ride.seats_available}/{ride.seats_total} cupos</span>
                    <span className="font-bold text-primary">{formatCOP(Number(ride.price_per_seat))} / cupo</span>
                    <span>{RIDE_PAYMENT_LABELS[ride.payment_method] || ride.payment_method}</span>
                  </div>
                  {(ride.bookings || []).length > 0 && (
                    <div className="rounded-xl bg-muted/40 p-3 space-y-2">
                      <p className="text-sm font-semibold">Pasajeros reservados:</p>
                      {(ride.bookings || []).map((b: any) => (
                        <p key={b.id} className="text-sm">
                          {b.passenger_name || "Pasajero"} · {b.seats} cupo(s) · {RIDE_PAYMENT_LABELS[b.payment_method] || b.payment_method}
                        </p>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {ride.status === "published" && (ride.bookings || []).length > 0 && (
                      <Button size="sm" onClick={() => updateStatus(ride.id, "driver_arriving")} className="rounded-xl">
                        <Clock className="h-4 w-4 mr-1" /> Voy en camino
                      </Button>
                    )}
                    {ride.status === "full" && (
                      <Button size="sm" onClick={() => updateStatus(ride.id, "driver_arriving")} className="rounded-xl">
                        <Clock className="h-4 w-4 mr-1" /> Cupos llenos — salir
                      </Button>
                    )}
                    {ride.status === "driver_arriving" && (
                      <Button size="sm" onClick={() => updateStatus(ride.id, "in_progress")} className="rounded-xl">Iniciar viaje</Button>
                    )}
                    {ride.status === "in_progress" && (
                      <Button size="sm" onClick={() => updateStatus(ride.id, "completed")} className="rounded-xl">Finalizar viaje</Button>
                    )}
                    {["published", "full"].includes(ride.status) && (
                      <Button size="sm" variant="outline" onClick={() => updateStatus(ride.id, "cancelled")} className="rounded-xl">Cancelar viaje</Button>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-3xl shadow-card">
            <CardHeader><CardTitle>Historial</CardTitle></CardHeader>
            <CardContent className="space-y-3 max-h-[600px] overflow-auto">
              {pastRides.length === 0 && <p className="text-sm text-muted-foreground">Sin viajes finalizados.</p>}
              {pastRides.map((ride) => (
                <div key={ride.id} className="rounded-2xl border p-3 space-y-1">
                  <p className="text-sm font-semibold">{ride.pickup_address} → {ride.dropoff_address}</p>
                  <p className="text-xs text-muted-foreground">{formatDeparture(ride.departure_at)}</p>
                  <p className="text-xs capitalize">{RIDE_STATUS_LABELS[ride.status] || ride.status}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default ConductorRides;
