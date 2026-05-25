import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Car, CheckCircle, Clock, MapPin, Phone, Star, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { formatCOP } from "@/data/mock";
import { toast } from "@/hooks/use-toast";
import MapboxDeliveryMap from "@/components/MapboxDeliveryMap";
import { RIDE_STATUS_LABELS, RIDE_PAYMENT_LABELS } from "@/constants/rides";

const RideDetail = () => {
  const { rideId } = useParams();
  const [ride, setRide] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submittingRating, setSubmittingRating] = useState(false);

  const load = async () => {
    if (!rideId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/rides/${rideId}`);
      if (res.ok) setRide(await res.json());
      else setRide(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, [rideId]);

  const acceptOffer = async (offerId: number) => {
    const response = await fetch(`/api/rides/${rideId}/offers/${offerId}/accept`, { method: "POST" });
    if (!response.ok) {
      toast({
        title: "No se pudo aceptar",
        description: (await response.json().catch(() => ({}))).detail || "Intenta de nuevo",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Oferta aceptada", description: "Tu conductor fue asignado." });
    load();
  };

  const updateStatus = async (status: string) => {
    await fetch(`/api/rides/${rideId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  };

  const submitRating = async () => {
    setSubmittingRating(true);
    try {
      const response = await fetch(`/api/rides/${rideId}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driver_rating: rating, comment }),
      });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).detail || "Error al calificar");
      toast({ title: "Gracias", description: "Tu calificación fue registrada." });
      load();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo calificar",
        variant: "destructive",
      });
    } finally {
      setSubmittingRating(false);
    }
  };

  if (loading && !ride) return <div className="min-h-screen bg-gradient-warm flex items-center justify-center">Cargando viaje...</div>;
  if (!ride) return <div className="min-h-screen bg-gradient-warm flex items-center justify-center">Viaje no encontrado</div>;

  const acceptedOffer = (ride.offers || []).find((offer: any) => offer.status === "accepted");
  const hasMap = ride.pickup_lat != null && ride.pickup_lng != null && ride.dropoff_lat != null && ride.dropoff_lng != null;
  const isActive = ["accepted", "driver_arriving", "in_progress"].includes(ride.status);
  const courierPos = ride.driver_lat != null && ride.driver_lng != null
    ? { lat: Number(ride.driver_lat), lng: Number(ride.driver_lng), label: "Conductor", emoji: "🚗" }
    : undefined;

  return (
    <div className="min-h-screen bg-gradient-warm pb-20">
      <main className="container max-w-5xl pt-8 space-y-6">
        <Link to="/viajes" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Volver a viajes
        </Link>

        <div className="grid lg:grid-cols-[1fr_380px] gap-6">
          <div className="space-y-6">
            <Card className="rounded-3xl shadow-glow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Car className="h-6 w-6 text-primary" /> Viaje {ride.id}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border p-4 space-y-3">
                  <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> <b>Origen:</b> {ride.pickup_address}</p>
                  <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> <b>Destino:</b> {ride.dropoff_address}</p>
                  <p className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> <b>Estado:</b> <span className="font-bold text-primary">{RIDE_STATUS_LABELS[ride.status] || ride.status}</span></p>
                  <p><b>Pago:</b> {RIDE_PAYMENT_LABELS[ride.payment_method] || ride.payment_method}</p>
                  <p><b>Precio:</b> {formatCOP(Number(ride.accepted_price || ride.requested_price || 0))}</p>
                </div>

                {acceptedOffer && (
                  <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                    <h3 className="font-bold flex items-center gap-2"><User className="h-4 w-4" /> Conductor asignado</h3>
                    <p>{acceptedOffer.driver_name || ride.driver_name || "Conductor"} · {acceptedOffer.vehicle || ride.driver_vehicle || "Carro"}</p>
                    <p className="font-bold">{formatCOP(Number(acceptedOffer.amount))}</p>
                    {(acceptedOffer.phone || ride.driver_phone) && (
                      <a href={`tel:${acceptedOffer.phone || ride.driver_phone}`} className="text-primary inline-flex items-center gap-2 mt-2">
                        <Phone className="h-4 w-4" /> Llamar conductor
                      </a>
                    )}
                  </div>
                )}

                {ride.status === "accepted" && (
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => updateStatus("cancelled")} variant="outline" className="rounded-xl">Cancelar</Button>
                  </div>
                )}

                {ride.status === "completed" && !ride.is_rated && (
                  <div className="rounded-2xl border p-4 space-y-3">
                    <h3 className="font-bold flex items-center gap-2"><Star className="h-4 w-4 text-warning" /> Califica tu viaje</h3>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((value) => (
                        <button key={value} type="button" onClick={() => setRating(value)} className={`text-2xl ${value <= rating ? "text-warning" : "text-muted-foreground/30"}`}>★</button>
                      ))}
                    </div>
                    <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comentario opcional..." className="rounded-xl" />
                    <Button onClick={submitRating} disabled={submittingRating} className="rounded-xl">
                      {submittingRating ? "Enviando..." : "Enviar calificación"}
                    </Button>
                  </div>
                )}

                {ride.status === "completed" && ride.is_rated && (
                  <div className="rounded-2xl border border-success/30 bg-success/5 p-4 flex items-center gap-2 text-success">
                    <CheckCircle className="h-5 w-5" /> Viaje calificado. ¡Gracias!
                  </div>
                )}
              </CardContent>
            </Card>

            {hasMap && (
              <Card className="rounded-3xl overflow-hidden">
                <CardHeader><CardTitle className="text-lg">Rastreo del viaje</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <div className="h-[360px] w-full">
                    <MapboxDeliveryMap
                      pickup={{ lat: Number(ride.pickup_lat), lng: Number(ride.pickup_lng), label: "Recogida", emoji: "📍" }}
                      dropoff={{ lat: Number(ride.dropoff_lat), lng: Number(ride.dropoff_lng), label: "Destino", emoji: "🏁" }}
                      courier={isActive ? courierPos : undefined}
                    />
                  </div>
                  {isActive && !courierPos && (
                    <p className="p-4 text-sm text-muted-foreground">Esperando ubicación del conductor...</p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          <Card className="rounded-3xl shadow-card">
            <CardHeader><CardTitle>Ofertas de conductores</CardTitle></CardHeader>
            <CardContent className="space-y-3 max-h-[520px] overflow-auto">
              {(ride.offers || []).length === 0 && <p className="text-sm text-muted-foreground">Aún no hay ofertas. Los conductores en carro verán tu solicitud.</p>}
              {(ride.offers || []).map((offer: any) => (
                <div key={offer.id} className="rounded-2xl border p-3">
                  <div className="flex justify-between"><b>{offer.driver_name || "Conductor"}</b><span>{offer.status}</span></div>
                  <p className="text-sm text-muted-foreground">{offer.vehicle || "Carro"} · {offer.rating || 5} ⭐ · {offer.eta_minutes || "--"} min</p>
                  <p className="text-xl font-bold">{formatCOP(Number(offer.amount))}</p>
                  {!["accepted", "cancelled", "completed"].includes(ride.status) && offer.status === "pending" && (
                    <Button onClick={() => acceptOffer(offer.id)} size="sm" className="rounded-xl mt-2">Aceptar oferta</Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default RideDetail;
