import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Car, CheckCircle, Clock, MapPin, Phone, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCOP } from "@/data/mock";
import { toast } from "@/hooks/use-toast";

const RideDetail = () => {
  const { rideId } = useParams();
  const [ride, setRide] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!rideId) return;
    setLoading(true);
    fetch(`/api/rides/${rideId}`).then((res) => res.ok ? res.json() : null).then(setRide).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [rideId]);

  const acceptOffer = async (offerId: number) => {
    const response = await fetch(`/api/rides/${rideId}/offers/${offerId}/accept`, { method: "POST" });
    if (!response.ok) {
      toast({ title: "No se pudo aceptar", description: (await response.json().catch(() => ({}))).detail || "Intenta de nuevo", variant: "destructive" });
      return;
    }
    toast({ title: "Oferta aceptada", description: "Tu conductor fue asignado." });
    load();
  };

  const updateStatus = async (status: string) => {
    await fetch(`/api/rides/${rideId}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    load();
  };

  if (loading) return <div className="min-h-screen bg-gradient-warm flex items-center justify-center">Cargando viaje...</div>;
  if (!ride) return <div className="min-h-screen bg-gradient-warm flex items-center justify-center">Viaje no encontrado</div>;

  const acceptedOffer = (ride.offers || []).find((offer: any) => offer.status === "accepted");

  return (
    <div className="min-h-screen bg-gradient-warm pb-20">
      <main className="container max-w-5xl pt-8 space-y-6">
        <Link to="/viajes" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Volver a viajes</Link>
        <div className="grid lg:grid-cols-[1fr_380px] gap-6">
          <Card className="rounded-3xl shadow-glow">
            <CardHeader><CardTitle className="flex items-center gap-2"><Car className="h-6 w-6 text-primary" /> Viaje {ride.id}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border p-4 space-y-3"><p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> <b>Origen:</b> {ride.pickup_address}</p><p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> <b>Destino:</b> {ride.dropoff_address}</p><p className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> Estado: <span className="font-bold capitalize text-primary">{ride.status}</span></p></div>
              {acceptedOffer && <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4"><h3 className="font-bold flex items-center gap-2"><User className="h-4 w-4" /> Conductor asignado</h3><p>{acceptedOffer.driver_name || "Conductor"} · {acceptedOffer.vehicle || "Vehículo"}</p><p className="font-bold">{formatCOP(Number(acceptedOffer.amount))}</p>{acceptedOffer.phone && <a href={`tel:${acceptedOffer.phone}`} className="text-primary inline-flex items-center gap-2 mt-2"><Phone className="h-4 w-4" /> Llamar</a>}</div>}
              {ride.status === "accepted" && <div className="flex flex-wrap gap-2"><Button onClick={() => updateStatus("driver_arriving")} className="rounded-xl">Conductor en camino</Button><Button onClick={() => updateStatus("cancelled")} variant="outline" className="rounded-xl">Cancelar</Button></div>}
              {ride.status === "driver_arriving" && <Button onClick={() => updateStatus("in_progress")} className="rounded-xl">Iniciar viaje</Button>}
              {ride.status === "in_progress" && <Button onClick={() => updateStatus("completed")} className="rounded-xl gap-2"><CheckCircle className="h-4 w-4" /> Finalizar viaje</Button>}
            </CardContent>
          </Card>
          <Card className="rounded-3xl shadow-card">
            <CardHeader><CardTitle>Ofertas de conductores</CardTitle></CardHeader>
            <CardContent className="space-y-3 max-h-[520px] overflow-auto">
              {(ride.offers || []).length === 0 && <p className="text-sm text-muted-foreground">Aún no hay ofertas.</p>}
              {(ride.offers || []).map((offer: any) => <div key={offer.id} className="rounded-2xl border p-3"><div className="flex justify-between"><b>{offer.driver_name || "Conductor"}</b><span className="capitalize">{offer.status}</span></div><p className="text-sm text-muted-foreground">{offer.vehicle || "Carro"} · {offer.rating || 5} ⭐ · {offer.eta_minutes || "--"} min</p><p className="text-xl font-bold">{formatCOP(Number(offer.amount))}</p>{ride.status !== "accepted" && offer.status === "pending" && <Button onClick={() => acceptOffer(offer.id)} size="sm" className="rounded-xl mt-2">Aceptar oferta</Button>}</div>)}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default RideDetail;
