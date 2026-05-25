import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Car, Clock, MapPin, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCOP } from "@/data/mock";
import { toast } from "@/hooks/use-toast";

const DriverRides = () => {
  const [rides, setRides] = useState<any[]>([]);
  const [myRides, setMyRides] = useState<any[]>([]);
  const [offer, setOffer] = useState<Record<string, { amount: string; eta: string }>>({});

  const load = () => {
    fetch("/api/rides/available").then((res) => res.ok ? res.json() : []).then(setRides).catch(() => undefined);
    fetch("/api/rides/me").then((res) => res.ok ? res.json() : []).then(setMyRides).catch(() => undefined);
  };

  useEffect(() => { load(); const timer = setInterval(load, 20000); return () => clearInterval(timer); }, []);

  const sendOffer = async (rideId: string) => {
    const values = offer[rideId] || { amount: "", eta: "" };
    const response = await fetch(`/api/rides/${rideId}/offers`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: Number(values.amount), eta_minutes: Number(values.eta) || null }) });
    if (!response.ok) {
      toast({ title: "No se pudo ofertar", description: (await response.json().catch(() => ({}))).detail || "Intenta de nuevo", variant: "destructive" });
      return;
    }
    toast({ title: "Oferta enviada", description: "El cliente podrá aceptarla." });
    load();
  };

  const updateStatus = async (rideId: string, status: string) => {
    await fetch(`/api/rides/${rideId}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    load();
  };

  return (
    <div className="min-h-screen bg-gradient-warm pb-20">
      <main className="container max-w-6xl pt-8 space-y-6">
        <Link to="/domiciliario" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Volver al panel</Link>
        <h1 className="text-3xl font-display font-bold flex items-center gap-2"><Car className="h-8 w-8 text-primary" /> Viajes disponibles</h1>
        <div className="grid lg:grid-cols-[1fr_380px] gap-6">
          <Card className="rounded-3xl shadow-glow"><CardHeader><CardTitle>Solicitudes abiertas</CardTitle></CardHeader><CardContent className="space-y-3">{rides.length === 0 && <p className="text-sm text-muted-foreground">No hay viajes disponibles.</p>}{rides.map((ride) => <div key={ride.id} className="rounded-2xl border p-4 space-y-3"><div className="flex justify-between"><b>{ride.id}</b><span className="capitalize text-primary">{ride.status}</span></div><p className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4" /> {ride.pickup_address} → {ride.dropoff_address}</p><p className="flex items-center gap-2 font-bold"><Wallet className="h-4 w-4" /> Cliente propone {formatCOP(Number(ride.requested_price || 0))}</p><div className="grid grid-cols-[1fr_110px_auto] gap-2"><Input placeholder="Tu precio" value={offer[ride.id]?.amount || ""} onChange={(e) => setOffer((prev) => ({ ...prev, [ride.id]: { ...(prev[ride.id] || { eta: "" }), amount: e.target.value } }))} /><Input placeholder="ETA" value={offer[ride.id]?.eta || ""} onChange={(e) => setOffer((prev) => ({ ...prev, [ride.id]: { ...(prev[ride.id] || { amount: "" }), eta: e.target.value } }))} /><Button onClick={() => sendOffer(ride.id)}>Ofertar</Button></div></div>)}</CardContent></Card>
          <Card className="rounded-3xl shadow-card"><CardHeader><CardTitle>Mis viajes asignados</CardTitle></CardHeader><CardContent className="space-y-3">{myRides.length === 0 && <p className="text-sm text-muted-foreground">No tienes viajes asignados.</p>}{myRides.map((ride) => <div key={ride.id} className="rounded-2xl border p-3"><div className="flex justify-between"><b>{ride.id}</b><span className="capitalize">{ride.status}</span></div><p className="text-sm text-muted-foreground">{ride.pickup_address} → {ride.dropoff_address}</p><p className="font-bold">{formatCOP(Number(ride.accepted_price || 0))}</p><div className="flex flex-wrap gap-2 mt-2">{ride.status === "accepted" && <Button size="sm" onClick={() => updateStatus(ride.id, "driver_arriving")} className="rounded-xl"><Clock className="h-4 w-4 mr-1" /> En camino</Button>}{ride.status === "driver_arriving" && <Button size="sm" onClick={() => updateStatus(ride.id, "in_progress")} className="rounded-xl">Iniciar</Button>}{ride.status === "in_progress" && <Button size="sm" onClick={() => updateStatus(ride.id, "completed")} className="rounded-xl">Finalizar</Button>}</div></div>)}</CardContent></Card>
        </div>
      </main>
    </div>
  );
};

export default DriverRides;
