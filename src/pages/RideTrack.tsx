import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Car, Clock, MapPin, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import MapboxDeliveryMap from "@/components/MapboxDeliveryMap";
import { RIDE_STATUS_LABELS, formatDeparture } from "@/constants/rides";

const RideTrack = () => {
  const { token } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    const load = () => {
      fetch(`/api/rides/track/${token}`)
        .then((res) => (res.ok ? res.json() : null))
        .then(setData)
        .finally(() => setLoading(false));
    };
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [token]);

  if (loading) return <div className="min-h-screen bg-gradient-warm flex items-center justify-center">Cargando seguimiento...</div>;
  if (!data) return <div className="min-h-screen bg-gradient-warm flex items-center justify-center">Enlace no válido o expirado</div>;

  const isActive = ["driver_arriving", "in_progress"].includes(data.status);
  const hasMap = data.pickup_lat != null && data.dropoff_lat != null;
  const courierPos = data.driver_lat != null && data.driver_lng != null
    ? { lat: Number(data.driver_lat), lng: Number(data.driver_lng), label: data.driver_first_name || "Conductor", emoji: "🚗" }
    : undefined;

  return (
    <div className="min-h-screen bg-gradient-warm pb-20">
      <main className="container max-w-3xl pt-8 space-y-6">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Fasty
        </Link>

        <Card className="rounded-3xl shadow-glow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Car className="h-6 w-6 text-primary" /> Seguimiento de viaje compartido
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Compartido contigo por un pasajero de Fasty Viajes.</p>
            <div className="rounded-2xl border p-4 space-y-2">
              <p><MapPin className="inline h-4 w-4 text-primary mr-1" />{data.pickup_address} → {data.dropoff_address}</p>
              <p><Clock className="inline h-4 w-4 text-primary mr-1" />{formatDeparture(data.departure_at)}</p>
              <p><b>Estado:</b> {RIDE_STATUS_LABELS[data.status] || data.status}</p>
              <p><b>Conductor:</b> {data.driver_first_name} {data.driver_verified && <ShieldCheck className="inline h-4 w-4 text-success" />}</p>
              {(data.driver_vehicle_model || data.driver_vehicle_color) && (
                <p className="text-sm text-muted-foreground">{[data.driver_vehicle_model, data.driver_vehicle_color].filter(Boolean).join(" · ")}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {hasMap && (
          <Card className="rounded-3xl overflow-hidden">
            <CardContent className="p-0">
              <div className="h-[360px] w-full">
                <MapboxDeliveryMap
                  pickup={{ lat: Number(data.pickup_lat), lng: Number(data.pickup_lng), label: "Recogida", emoji: "📍" }}
                  dropoff={{ lat: Number(data.dropoff_lat), lng: Number(data.dropoff_lng), label: "Destino", emoji: "🏁" }}
                  courier={isActive ? courierPos : undefined}
                />
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default RideTrack;
