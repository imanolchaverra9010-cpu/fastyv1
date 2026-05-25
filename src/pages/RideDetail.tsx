import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertTriangle, ArrowLeft, Car, CheckCircle, Clock, MapPin, Phone, Share2,
  Shield, ShieldCheck, Star, User, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { formatCOP } from "@/data/mock";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { getPreciseCurrentPosition, isUsablePosition } from "@/utils/geolocation";
import MapboxDeliveryMap from "@/components/MapboxDeliveryMap";
import {
  RIDE_STATUS_LABELS, RIDE_PAYMENT_LABELS, RIDE_REPORT_LABELS,
  formatDeparture, formatVehicleInfo,
} from "@/constants/rides";

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
  const [startPin, setStartPin] = useState("");
  const [startingTrip, setStartingTrip] = useState(false);
  const [reportCategory, setReportCategory] = useState("other");
  const [reportText, setReportText] = useState("");
  const [showReport, setShowReport] = useState(false);
  const [sendingSos, setSendingSos] = useState(false);

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
  const isActiveTrip = ride && ["driver_arriving", "in_progress"].includes(ride.status);
  const hasBookingAccess = myBooking || isDriver;

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
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).detail || "No se pudo reservar");
      const data = await response.json();
      toast({ title: "Reserva confirmada", description: `Total: ${formatCOP(Number(data.total))}` });
      load();
    } catch (error) {
      toast({ title: "Error al reservar", description: error instanceof Error ? error.message : "Intenta de nuevo", variant: "destructive" });
    } finally {
      setBooking(false);
    }
  };

  const cancelBooking = async () => {
    const response = await fetch(`/api/rides/${rideId}/book/cancel`, { method: "POST" });
    if (!response.ok) {
      toast({ title: "No se pudo cancelar", description: (await response.json().catch(() => ({}))).detail || "Intenta de nuevo", variant: "destructive" });
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
      toast({ title: "No se pudo actualizar", description: (await response.json().catch(() => ({}))).detail || "Intenta de nuevo", variant: "destructive" });
      return;
    }
    toast({ title: status === "driver_arriving" ? "En camino" : "Estado actualizado" });
    load();
  };

  const startWithPin = async () => {
    setStartingTrip(true);
    try {
      const response = await fetch(`/api/rides/${rideId}/start-with-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: startPin }),
      });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).detail || "PIN incorrecto");
      toast({ title: "Viaje iniciado", description: "PIN verificado correctamente." });
      setStartPin("");
      load();
    } catch (error) {
      toast({ title: "No se pudo iniciar", description: error instanceof Error ? error.message : "Intenta de nuevo", variant: "destructive" });
    } finally {
      setStartingTrip(false);
    }
  };

  const shareTrip = async () => {
    const token = myBooking?.share_token;
    if (!token) {
      toast({ title: "Sin enlace", description: "Reserva el viaje primero para compartir.", variant: "destructive" });
      return;
    }
    const url = `${window.location.origin}/viajes/seguir/${token}`;
    try {
      await navigator.share?.({ title: "Seguimiento de viaje Fasty", text: "Sigue mi viaje en tiempo real", url });
    } catch {
      await navigator.clipboard.writeText(url);
      toast({ title: "Enlace copiado", description: "Compártelo con alguien de confianza." });
    }
  };

  const triggerSos = async () => {
    if (!confirm("¿Activar alerta SOS? Notificaremos al equipo de Fasty de inmediato.")) return;
    setSendingSos(true);
    try {
      let lat: number | undefined;
      let lng: number | undefined;
      try {
        const pos = await getPreciseCurrentPosition({ timeout: 6000 });
        if (isUsablePosition(pos)) {
          lat = pos.latitude;
          lng = pos.longitude;
        }
      } catch { /* ignore */ }
      const response = await fetch(`/api/rides/${rideId}/sos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng }),
      });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).detail || "Error SOS");
      toast({ title: "SOS activado", description: (await response.json()).message, variant: "destructive" });
      load();
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "No se pudo enviar SOS", variant: "destructive" });
    } finally {
      setSendingSos(false);
    }
  };

  const submitReport = async () => {
    if (reportText.trim().length < 10) {
      toast({ title: "Describe el problema", description: "Mínimo 10 caracteres.", variant: "destructive" });
      return;
    }
    const response = await fetch(`/api/rides/${rideId}/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: reportCategory, description: reportText.trim(), target: "driver" }),
    });
    if (!response.ok) {
      toast({ title: "Error", description: (await response.json().catch(() => ({}))).detail || "No se pudo enviar", variant: "destructive" });
      return;
    }
    toast({ title: "Reporte enviado", description: "Lo revisaremos pronto." });
    setShowReport(false);
    setReportText("");
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
      toast({ title: "Error", description: error instanceof Error ? error.message : "No se pudo calificar", variant: "destructive" });
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
  const passengerPin = ride.passenger_pin;

  return (
    <div className="min-h-screen bg-gradient-warm pb-20">
      <main className="container max-w-5xl pt-8 space-y-6">
        <Link to={isDriver ? "/conductor/viajes" : "/viajes"} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>

        {isActiveTrip && hasBookingAccess && (
          <div className="flex flex-wrap gap-2">
            {myBooking?.share_token && (
              <Button variant="outline" className="rounded-xl" onClick={shareTrip}>
                <Share2 className="h-4 w-4 mr-2" /> Compartir viaje
              </Button>
            )}
            <Button variant="destructive" className="rounded-xl" onClick={triggerSos} disabled={sendingSos}>
              <AlertTriangle className="h-4 w-4 mr-2" /> {sendingSos ? "Enviando..." : "SOS"}
            </Button>
            {!isDriver && (
              <Button variant="outline" className="rounded-xl" onClick={() => setShowReport((v) => !v)}>
                Reportar problema
              </Button>
            )}
          </div>
        )}

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
                  <p className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> <b>Cupos:</b> {ride.seats_available} de {ride.seats_total}</p>
                  <p><b>Estado:</b> <span className="font-bold text-primary">{RIDE_STATUS_LABELS[ride.status] || ride.status}</span></p>
                  <p><b>Pago:</b> {RIDE_PAYMENT_LABELS[ride.payment_method] || ride.payment_method}</p>
                  <p><b>Precio por cupo:</b> {formatCOP(Number(ride.price_per_seat))}</p>
                </div>

                {ride.driver_name && (
                  <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-2">
                    <h3 className="font-bold flex items-center gap-2">
                      <User className="h-4 w-4" /> Conductor
                      {ride.driver_verified && (
                        <span className="text-xs font-normal inline-flex items-center gap-1 text-success bg-success/10 px-2 py-0.5 rounded-full">
                          <ShieldCheck className="h-3 w-3" /> Verificado
                        </span>
                      )}
                    </h3>
                    <p>{ride.driver_name} · {Number(ride.driver_rating || 5).toFixed(1)} ⭐</p>
                    <p className="text-sm">{formatVehicleInfo(ride)}</p>
                    {ride.driver_phone && isActiveTrip && myBooking && (
                      <a href={`tel:${ride.driver_phone}`} className="text-primary inline-flex items-center gap-2">
                        <Phone className="h-4 w-4" /> Llamar conductor
                      </a>
                    )}
                  </div>
                )}

                {passengerPin && myBooking && ride.status === "driver_arriving" && (
                  <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 text-center">
                    <p className="text-sm text-muted-foreground flex items-center justify-center gap-2"><Shield className="h-4 w-4" /> PIN de seguridad</p>
                    <p className="text-4xl font-display font-bold tracking-[0.3em] text-primary mt-2">{passengerPin}</p>
                    <p className="text-xs text-muted-foreground mt-2">Dáselo al conductor solo cuando estés en el vehículo correcto.</p>
                  </div>
                )}

                {canBook && (
                  <div className="rounded-2xl border p-4 space-y-3">
                    <h3 className="font-bold">Reservar cupo</h3>
                    <div className="flex gap-3 items-end">
                      <div className="flex-1">
                        <label className="text-sm text-muted-foreground">Cupos</label>
                        <Input type="number" min={1} max={Math.min(6, ride.seats_available)} value={seats} onChange={(e) => setSeats(e.target.value)} className="rounded-xl mt-1" />
                      </div>
                      <p className="font-bold text-primary pb-2">{formatCOP(totalPrice)}</p>
                    </div>
                    <Textarea value={passengerNote} onChange={(e) => setPassengerNote(e.target.value)} placeholder="Nota para el conductor (opcional)" className="rounded-xl" />
                    <Button onClick={bookSeats} disabled={booking} className="rounded-xl w-full">{booking ? "Reservando..." : "Confirmar reserva"}</Button>
                  </div>
                )}

                {myBooking && (
                  <div className="rounded-2xl border border-success/30 bg-success/5 p-4 space-y-2">
                    <p className="font-bold text-success">Tu reserva: {myBooking.seats} cupo(s)</p>
                    <p className="text-sm">Total: {formatCOP(Number(ride.price_per_seat) * Number(myBooking.seats))}</p>
                    {canCancelBooking && <Button variant="outline" onClick={cancelBooking} className="rounded-xl">Cancelar reserva</Button>}
                  </div>
                )}

                {showReport && (
                  <div className="rounded-2xl border p-4 space-y-3">
                    <h3 className="font-bold">Reportar problema</h3>
                    <select value={reportCategory} onChange={(e) => setReportCategory(e.target.value)} className="w-full rounded-xl border bg-background px-3 h-10">
                      {Object.entries(RIDE_REPORT_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                    <Textarea value={reportText} onChange={(e) => setReportText(e.target.value)} placeholder="Describe qué ocurrió..." className="rounded-xl" />
                    <Button onClick={submitReport} className="rounded-xl">Enviar reporte</Button>
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
                    <Button onClick={submitRating} disabled={submittingRating} className="rounded-xl">{submittingRating ? "Enviando..." : "Enviar calificación"}</Button>
                  </div>
                )}

                {myBooking?.is_rated && (
                  <div className="rounded-2xl border border-success/30 bg-success/5 p-4 flex items-center gap-2 text-success">
                    <CheckCircle className="h-5 w-5" /> Viaje calificado. ¡Gracias!
                  </div>
                )}

                {isDriver && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {ride.status === "published" && (ride.bookings || []).length > 0 && (
                        <Button onClick={() => updateStatus("driver_arriving")} className="rounded-xl"><Clock className="h-4 w-4 mr-1" /> Voy en camino</Button>
                      )}
                      {ride.status === "full" && (
                        <Button onClick={() => updateStatus("driver_arriving")} className="rounded-xl">Cupos llenos — salir</Button>
                      )}
                      {ride.status === "in_progress" && (
                        <Button onClick={() => updateStatus("completed")} className="rounded-xl">Finalizar viaje</Button>
                      )}
                      {["published", "full"].includes(ride.status) && (
                        <Button variant="outline" onClick={() => updateStatus("cancelled")} className="rounded-xl">Cancelar viaje</Button>
                      )}
                    </div>
                    {ride.status === "driver_arriving" && (
                      <div className="rounded-2xl border p-4 space-y-3">
                        <p className="text-sm font-semibold">Iniciar viaje con PIN del pasajero</p>
                        <div className="flex gap-2">
                          <Input value={startPin} onChange={(e) => setStartPin(e.target.value)} placeholder="0000" maxLength={4} className="rounded-xl font-mono text-lg tracking-widest" />
                          <Button onClick={startWithPin} disabled={startingTrip || startPin.length < 4} className="rounded-xl">{startingTrip ? "..." : "Verificar PIN"}</Button>
                        </div>
                      </div>
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
                </CardContent>
              </Card>
            )}
          </div>

          <Card className="rounded-3xl shadow-card">
            <CardHeader><CardTitle>{isDriver ? "Pasajeros" : "Seguridad"}</CardTitle></CardHeader>
            <CardContent className="space-y-3 max-h-[520px] overflow-auto">
              {isDriver ? (
                (ride.bookings || []).map((b: any) => (
                  <div key={b.id} className="rounded-2xl border p-3">
                    <p className="font-bold">{b.passenger_name || "Pasajero"}</p>
                    <p className="text-sm">{b.seats} cupo(s)</p>
                    {b.passenger_note && <p className="text-xs text-muted-foreground mt-1">{b.passenger_note}</p>}
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground space-y-2">
                  <p>• Verifica placa y modelo del vehículo antes de subir.</p>
                  <p>• Usa el PIN cuando el conductor llegue.</p>
                  <p>• Comparte tu viaje con alguien de confianza.</p>
                  <p>• Activa SOS si te sientes en peligro.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default RideDetail;
