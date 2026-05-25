import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Car, Clock, MapPin, Users, AlertTriangle, Plus, ShieldCheck, ExternalLink, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCOP } from "@/data/mock";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { getPreciseCurrentPosition, isUsablePosition } from "@/utils/geolocation";
import { RIDE_STATUS_LABELS, RIDE_PAYMENT_LABELS, PENALTY_LABELS, formatDeparture } from "@/constants/rides";

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
  const [eligibility, setEligibility] = useState<any>(null);
  const [driverStats, setDriverStats] = useState<any>(null);
  const [vehicleForm, setVehicleForm] = useState({ vehicle_plate: "", vehicle_color: "", vehicle_model: "" });
  const [savingVehicle, setSavingVehicle] = useState(false);

  const load = () => {
    fetch("/api/rides/driver-eligibility")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setEligibility(data);
        if (data) {
          setVehicleForm({
            vehicle_plate: data.vehicle_plate || "",
            vehicle_color: data.vehicle_color || "",
            vehicle_model: data.vehicle_model || "",
          });
        }
      })
      .catch(() => undefined);
    fetch("/api/rides/me")
      .then((res) => (res.ok ? res.json() : []))
      .then(setMyRides)
      .catch(() => undefined);
    fetch("/api/rides/drivers/me/stats")
      .then((res) => (res.ok ? res.json() : null))
      .then(setDriverStats)
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

  const saveVehicleData = async () => {
    if (!user?.id) return;
    setSavingVehicle(true);
    try {
      const response = await fetch(`/api/couriers/${user.id}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vehicleForm),
      });
      if (!response.ok) throw new Error("No se pudo guardar");
      toast({ title: "Datos del vehículo guardados" });
      load();
    } catch {
      toast({ title: "Error", description: "No se pudieron guardar los datos.", variant: "destructive" });
    } finally {
      setSavingVehicle(false);
    }
  };

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
            <Button onClick={() => setShowForm((v) => !v)} className="rounded-xl" disabled={!eligibility?.can_publish}>
              <Plus className="h-4 w-4 mr-2" /> {showForm ? "Ocultar formulario" : "Nuevo viaje"}
            </Button>
          )}
        </div>

        {driverStats && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="rounded-2xl"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Tu ranking</p><p className="text-2xl font-bold flex items-center gap-2"><Trophy className="h-5 w-5 text-warning" /> #{driverStats.rank_position || "—"}</p></CardContent></Card>
            <Card className="rounded-2xl"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Viajes completados</p><p className="text-2xl font-bold">{driverStats.completed_rides}</p></CardContent></Card>
            <Card className="rounded-2xl"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Puntuación</p><p className="text-2xl font-bold text-primary">{driverStats.rank_score}</p></CardContent></Card>
            <Card className={`rounded-2xl ${driverStats.penalty_warning ? "border-warning/40" : ""}`}><CardContent className="p-4"><p className="text-xs text-muted-foreground">Penalizaciones (90 d)</p><p className={`text-2xl font-bold ${driverStats.penalty_points >= (eligibility?.penalty_block_threshold || 50) ? "text-destructive" : ""}`}>{driverStats.penalty_points} pts</p></CardContent></Card>
          </div>
        )}

        {eligibility?.penalty_warning && (
          <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4 flex gap-3">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
            <p className="text-sm">Tienes {eligibility.penalty_points} puntos de penalización. Al llegar a {eligibility.penalty_block_threshold} no podrás publicar viajes.</p>
          </div>
        )}

        {driverStats?.recent_penalties?.length > 0 && (
          <Card className="rounded-2xl">
            <CardHeader><CardTitle className="text-base">Penalizaciones recientes</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {driverStats.recent_penalties.filter((p: any) => !p.waived).slice(0, 5).map((p: any) => (
                <div key={p.id} className="text-sm flex justify-between gap-2 border-b pb-2">
                  <span>{PENALTY_LABELS[p.reason] || p.reason}</span>
                  <span className="font-bold text-destructive">+{p.points} pts</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

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

        {eligibility && !eligibility.ride_verified && eligibility.eligible && (
          <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4 flex gap-3">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Cuenta pendiente de verificación</p>
              <p className="text-sm text-muted-foreground">Un administrador debe verificar tu perfil antes de que puedas publicar viajes.</p>
            </div>
          </div>
        )}

        {eligibility?.eligible && (
          <Card className="rounded-3xl shadow-card">
            <CardHeader><CardTitle className="flex items-center gap-2">Datos del vehículo {eligibility.ride_verified && <ShieldCheck className="h-5 w-5 text-success" />}</CardTitle></CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-4">
              <Input placeholder="Placa (ej: ABC123)" value={vehicleForm.vehicle_plate} onChange={(e) => setVehicleForm((f) => ({ ...f, vehicle_plate: e.target.value.toUpperCase() }))} className="rounded-xl" />
              <Input placeholder="Color (ej: Blanco)" value={vehicleForm.vehicle_color} onChange={(e) => setVehicleForm((f) => ({ ...f, vehicle_color: e.target.value }))} className="rounded-xl" />
              <Input placeholder="Modelo (ej: Chevrolet Spark)" value={vehicleForm.vehicle_model} onChange={(e) => setVehicleForm((f) => ({ ...f, vehicle_model: e.target.value }))} className="rounded-xl" />
              <Button onClick={saveVehicleData} disabled={savingVehicle} className="rounded-xl md:col-span-3 w-fit">{savingVehicle ? "Guardando..." : "Guardar datos del vehículo"}</Button>
            </CardContent>
          </Card>
        )}

        {showForm && eligibility?.can_publish && (
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
                      <Link to={`/viajes/${ride.id}`} className="inline-flex">
                        <Button size="sm" className="rounded-xl"><ExternalLink className="h-4 w-4 mr-1" /> Ingresar PIN e iniciar</Button>
                      </Link>
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
