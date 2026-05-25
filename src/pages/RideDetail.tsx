import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Car, CheckCircle, Clock, MapPin, Phone, Star, User, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { formatCOP } from "@/data/mock";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import MapboxDeliveryMap from "@/components/MapboxDeliveryMap";
import { RIDE_STATUS_LABELS, RIDE_PAYMENT_LABELS, formatDeparture } from "@/constants/rides";

const RideDetail = () => {
  const { rideId } = useParams();
  const { user } = useAuth();
  const [ride, setRide] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [seats, setSeats] = useState("1");
  const [passengerNote, setPassengerNote] = useState("");
  const [booking, setBooking] = useState(false);
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

  const isDriver = user?.id === ride?.driver_user_id;
  const myBooking = ride?.my_booking;
  const canBook = !isDriver && ride && ["published", "full"].includes(ride.status) && !myBooking;
  const canCancelBooking = myBooking?.status === "confirmed" && ride && ["published", "full"].includes(ride.status);

  const bookSeats = async () => {
    setBooking(true);
    try {
      const response = await fetch(`/api/rides/${rideId}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seats: Number(seats) || 1,
          payment_method: ride.payment_method,
          passenger_note: passengerNote.trim() || null,
        }),
      });
      if (!response.ok) {
        throw new Error((await response.json().catch(() => ({}))).detail || "No se pudo reservar");
      }
      const data = await response.json();
      toast({ title: "Reserva confirmada", description: `Total: ${formatCOP(Number(data.total))}` });
      load();
    } catch (error) {
      toast({
        title: "Error al reservar",
        description: error instanceof Error ? error.message : "Intenta de nuevo",
        variant: "destructive",
      });
    } finally {
      setBooking(false);
    }
  };

  const cancelBooking = async () => {
    const response = await fetch(`/api/rides/${rideId}/book/cancel`, { method: "POST" });
    if (!response.ok) {
      toast({
        title: "No se pudo cancelar",
        description: (await response.json().catch(() => ({}))).detail || "Intenta de nuevo",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Reserva cancelada" });
    load();
  };

  const updateStatus = async (status: string) => {
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

  const hasMap = ride.pickup_lat != null && ride.pickup_lng != null && ride.dropoff_lat != null && ride.dropoff_lng != null;
  const isActive = ["driver_arriving", "in_progress"].includes(ride.status);
  const courierPos = ride.driver_lat != null && ride.driver_lng != null
    ? { lat: Number(ride.driver_lat), lng: Number(ride.driver_lng), label: "Conductor", emoji: "🚗" }
    : undefined;
  const totalPrice = Number(ride.price_per_seat) * (Number(myBooking?.seats) || Number(seats) || 1);

  return (
    <div className="min-h-screen bg-gradient-warm pb-20">
      <main className="container max-w-5xl pt-8 space-y-6">
        <Link to={isDriver ? "/conductor/viajes" : "/viajes"} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>

        <div className="grid lg:grid-cols-[1fr_380px] gap-6">
          <div className="space-y-6">
            <Card className="rounded-3xl shadow-glow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Car className="h-6 w-6 text-primary" /> {ride.pickup_address} → {ride.dropoff_address}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border p-4 space-y-3">
                  <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> <b>Origen:</b> {ride.pickup_address}</p>
                  <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> <b>Destino:</b> {ride.dropoff_address}</p>
                  <p className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> <b>Salida:</b> {formatDeparture(ride.departure_at)}</p>
                  <p className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> <b>Cupos:</b> {ride.seats_available} de {ride.seats_total} disponibles</p>
                  <p><b>Estado:</b> <span className="font-bold text-primary">{RIDE_STATUS_LABELS[ride.status] || ride.status}</span></p>
                  <p><b>Pago:</b> {RIDE_PAYMENT_LABELS[ride.payment_method] || ride.payment_method}</p>
                  <p><b>Precio por cupo:</b> {formatCOP(Number(ride.price_per_seat))}</p>
                  {ride.notes && <p className="text-sm text-muted-foreground"><b>Notas:</b> {ride.notes}</p>}
                </div>

                {ride.driver_name && (
                  <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                    <h3 className="font-bold flex items-center gap-2"><User className="h-4 w-4" /> Conductor</h3>
                    <p>{ride.driver_name} · {ride.driver_vehicle || "Carro"} · {Number(ride.driver_rating || 5).toFixed(1)} ⭐</p>
                    {ride.driver_phone && (
                      <a href={`tel:${ride.driver_phone}`} className="text-primary inline-flex items-center gap-2 mt-2">
                        <Phone className="h-4 w-4" /> Llamar conductor
                      </a>
                    )}
                  </div>
                )}

                {canBook && (
                  <div className="rounded-2xl border p-4 space-y-3">
                    <h3 className="font-bold">Reservar cupo</h3>
                    <div className="flex gap-3 items-end">
                      <div className="flex-1">
                        <label className="text-sm text-muted-foreground">Cupos</label>
                        <Input
                          type="number"
                          min={1}
                          max={Math.min(6, ride.seats_available)}
                          value={seats}
                          onChange={(e) => setSeats(e.target.value)}
                          className="rounded-xl mt-1"
                        />
                      </div>
                      <p className="font-bold text-primary pb-2">{formatCOP(totalPrice)}</p>
                    </div>
                    <Textarea
                      value={passengerNote}
                      onChange={(e) => setPassengerNote(e.target.value)}
                      placeholder="Nota para el conductor (opcional)"
                      className="rounded-xl"
                    />
                    <Button onClick={bookSeats} disabled={booking} className="rounded-xl w-full">
                      {booking ? "Reservando..." : "Confirmar reserva"}
                    </Button>
                  </div>
                )}

                {myBooking && (
                  <div className="rounded-2xl border border-success/30 bg-success/5 p-4 space-y-2">
                    <p className="font-bold text-success">Tu reserva: {myBooking.seats} cupo(s)</p>
                    <p className="text-sm">Total: {formatCOP(Number(ride.price_per_seat) * Number(myBooking.seats))}</p>
                    {canCancelBooking && (
                      <Button variant="outline" onClick={cancelBooking} className="rounded-xl">Cancelar reserva</Button>
                    )}
                  </div>
                )}

                {ride.status === "completed" && myBooking && !myBooking.is_rated && (
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

                {myBooking?.is_rated && (
                  <div className="rounded-2xl border border-success/30 bg-success/5 p-4 flex items-center gap-2 text-success">
                    <CheckCircle className="h-5 w-5" /> Viaje calificado. ¡Gracias!
                  </div>
                )}

                {isDriver && (
                  <div className="flex flex-wrap gap-2">
                    {ride.status === "published" && (ride.bookings || []).length > 0 && (
                      <Button onClick={() => updateStatus("driver_arriving")} className="rounded-xl">
                        <Clock className="h-4 w-4 mr-1" /> Voy en camino
                      </Button>
                    )}
                    {ride.status === "full" && (
                      <Button onClick={() => updateStatus("driver_arriving")} className="rounded-xl">Cupos llenos — salir</Button>
                    )}
                    {ride.status === "driver_arriving" && (
                      <Button onClick={() => updateStatus("in_progress")} className="rounded-xl">Iniciar viaje</Button>
                    )}
                    {ride.status === "in_progress" && (
                      <Button onClick={() => updateStatus("completed")} className="rounded-xl">Finalizar viaje</Button>
                    )}
                    {["published", "full"].includes(ride.status) && (
                      <Button variant="outline" onClick={() => updateStatus("cancelled")} className="rounded-xl">Cancelar viaje</Button>
                    )}
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
            <CardHeader>
              <CardTitle>{isDriver ? "Pasajeros" : "Detalle del viaje"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[520px] overflow-auto">
              {isDriver ? (
                <>
                  {(ride.bookings || []).length === 0 && (
                    <p className="text-sm text-muted-foreground">Aún no hay pasajeros. Comparte tu viaje publicado.</p>
                  )}
                  {(ride.bookings || []).map((b: any) => (
                    <div key={b.id} className="rounded-2xl border p-3">
                      <p className="font-bold">{b.passenger_name || "Pasajero"}</p>
                      <p className="text-sm">{b.seats} cupo(s) · {RIDE_PAYMENT_LABELS[b.payment_method] || b.payment_method}</p>
                      {b.passenger_note && <p className="text-xs text-muted-foreground mt-1">{b.passenger_note}</p>}
                    </div>
                  ))}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Este viaje fue publicado por el conductor. Solo puedes reservar los cupos disponibles; no puedes proponer otra ruta.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default RideDetail;
