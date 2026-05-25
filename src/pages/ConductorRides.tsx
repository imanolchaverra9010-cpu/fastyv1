import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Car, Clock, MapPin, Wallet, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCOP } from "@/data/mock";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { getPreciseCurrentPosition, isUsablePosition } from "@/utils/geolocation";
import { RIDE_STATUS_LABELS, RIDE_PAYMENT_LABELS } from "@/constants/rides";

const ConductorRides = () => {
  const { user } = useAuth();
  const [rides, setRides] = useState<any[]>([]);
  const [myRides, setMyRides] = useState<any[]>([]);
  const [offer, setOffer] = useState<Record<string, { amount: string; eta: string }>>({});
  const [eligibility, setEligibility] = useState<{ eligible: boolean; vehicle?: string; message?: string } | null>(null);

  const load = () => {
    fetch("/api/rides/driver-eligibility")
      .then((res) => (res.ok ? res.json() : null))
      .then(setEligibility)
      .catch(() => undefined);
    fetch("/api/rides/available")
      .then((res) => (res.ok ? res.json() : []))
      .then(setRides)
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
    const hasActiveRide = myRides.some((ride) => ["accepted", "driver_arriving", "in_progress"].includes(ride.status));
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

  const sendOffer = async (rideId: string) => {
    const values = offer[rideId] || { amount: "", eta: "" };
    const response = await fetch(`/api/rides/${rideId}/offers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: Number(values.amount), eta_minutes: Number(values.eta) || null }),
    });
    if (!response.ok) {
      toast({
        title: "No se pudo ofertar",
        description: (await response.json().catch(() => ({}))).detail || "Intenta de nuevo",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Oferta enviada", description: "El cliente podrá aceptarla." });
    load();
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

  return (
    <div className="min-h-screen bg-gradient-warm pb-20">
      <main className="container max-w-6xl pt-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link to="/domiciliario" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Volver a domicilios
          </Link>
          <span className="text-xs font-bold uppercase tracking-wider text-primary bg-primary/10 px-3 py-1 rounded-full">Módulo Viajes</span>
        </div>

        <h1 className="text-3xl font-display font-bold flex items-center gap-2">
          <Car className="h-8 w-8 text-primary" /> Panel de viajes en carro
        </h1>

        {eligibility && !eligibility.eligible && (
          <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4 flex gap-3">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Tu vehículo no está habilitado para viajes</p>
              <p className="text-sm text-muted-foreground">{eligibility.message}</p>
              {eligibility.vehicle && <p className="text-sm mt-1">Vehículo registrado: <b>{eligibility.vehicle}</b></p>}
              <p className="text-sm mt-2">Actualiza tu vehículo a carro/auto en tu perfil de domiciliario para ofertar viajes.</p>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-[1fr_380px] gap-6">
          <Card className="rounded-3xl shadow-glow">
            <CardHeader><CardTitle>Solicitudes abiertas</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {rides.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {eligibility?.eligible ? "No hay viajes disponibles ahora." : "Habilita tu vehículo tipo carro para ver solicitudes."}
                </p>
              )}
              {rides.map((ride) => (
                <div key={ride.id} className="rounded-2xl border p-4 space-y-3">
                  <div className="flex justify-between"><b>{ride.id}</b><span className="text-primary">{RIDE_STATUS_LABELS[ride.status] || ride.status}</span></div>
                  <p className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4" /> {ride.pickup_address} → {ride.dropoff_address}</p>
                  <p className="flex items-center gap-2 font-bold"><Wallet className="h-4 w-4" /> Cliente propone {formatCOP(Number(ride.requested_price || 0))}</p>
                  <p className="text-xs text-muted-foreground">{ride.passengers} pasajero(s) · {RIDE_PAYMENT_LABELS[ride.payment_method] || ride.payment_method}</p>
                  {eligibility?.eligible && (
                    <div className="grid grid-cols-[1fr_110px_auto] gap-2">
                      <Input
                        placeholder="Tu precio"
                        value={offer[ride.id]?.amount || ""}
                        onChange={(e) => setOffer((prev) => ({ ...prev, [ride.id]: { ...(prev[ride.id] || { eta: "" }), amount: e.target.value } }))}
                      />
                      <Input
                        placeholder="ETA min"
                        value={offer[ride.id]?.eta || ""}
                        onChange={(e) => setOffer((prev) => ({ ...prev, [ride.id]: { ...(prev[ride.id] || { amount: "" }), eta: e.target.value } }))}
                      />
                      <Button onClick={() => sendOffer(ride.id)}>Ofertar</Button>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-3xl shadow-card">
            <CardHeader><CardTitle>Mis viajes asignados</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {myRides.length === 0 && <p className="text-sm text-muted-foreground">No tienes viajes asignados.</p>}
              {myRides.map((ride) => (
                <div key={ride.id} className="rounded-2xl border p-3 space-y-2">
                  <div className="flex justify-between"><b>{ride.id}</b><span>{RIDE_STATUS_LABELS[ride.status] || ride.status}</span></div>
                  <p className="text-sm text-muted-foreground">{ride.pickup_address} → {ride.dropoff_address}</p>
                  <p className="font-bold">{formatCOP(Number(ride.accepted_price || 0))}</p>
                  <div className="flex flex-wrap gap-2">
                    {ride.status === "accepted" && (
                      <Button size="sm" onClick={() => updateStatus(ride.id, "driver_arriving")} className="rounded-xl">
                        <Clock className="h-4 w-4 mr-1" /> Voy en camino
                      </Button>
                    )}
                    {ride.status === "driver_arriving" && (
                      <Button size="sm" onClick={() => updateStatus(ride.id, "in_progress")} className="rounded-xl">Iniciar viaje</Button>
                    )}
                    {ride.status === "in_progress" && (
                      <Button size="sm" onClick={() => updateStatus(ride.id, "completed")} className="rounded-xl">Finalizar viaje</Button>
                    )}
                  </div>
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
