import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Car, MapPin, Search, Users, Clock, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCOP } from "@/data/mock";
import { useAuth } from "@/context/AuthContext";
import { RIDE_STATUS_LABELS, RIDE_PAYMENT_LABELS, formatDeparture } from "@/constants/rides";

const Rides = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rides, setRides] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const load = () => {
    setLoading(true);
    const query = debouncedSearch ? `?q=${encodeURIComponent(debouncedSearch)}` : "";
    Promise.all([
      fetch(`/api/rides${query}`).then((res) => (res.ok ? res.json() : [])),
      user ? fetch("/api/rides/my-bookings").then((res) => (res.ok ? res.json() : [])) : Promise.resolve([]),
    ])
      .then(([published, myBookings]) => {
        setRides(published);
        setBookings(myBookings);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 20000);
    return () => clearInterval(timer);
  }, [user, debouncedSearch]);

  return (
    <div className="min-h-screen bg-gradient-warm pb-20">
      <main className="container max-w-5xl pt-8 space-y-6">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>

        <div className="rounded-3xl bg-primary/10 border border-primary/20 p-6">
          <h1 className="text-3xl font-display font-bold flex items-center gap-2">
            <Car className="h-8 w-8 text-primary" /> Viajes compartidos
          </h1>
          <p className="text-muted-foreground mt-2">
            Elige un viaje publicado por un conductor. Tú no propones la ruta: reservas el cupo que más te sirva.
          </p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por origen o destino (ej: parque, universidad...)"
            className="pl-10 rounded-2xl h-12"
          />
        </div>

        <div className="grid lg:grid-cols-[1fr_340px] gap-6">
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Viajes disponibles</h2>
            {loading && <p className="text-sm text-muted-foreground">Cargando viajes...</p>}
            {!loading && rides.length === 0 && (
              <Card className="rounded-3xl"><CardContent className="p-8 text-center text-muted-foreground">No hay viajes publicados ahora. Vuelve pronto.</CardContent></Card>
            )}
            {rides.map((ride) => (
              <Card key={ride.id} className="rounded-3xl shadow-card hover:shadow-glow transition-shadow">
                <CardContent className="p-5 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-lg flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary" />
                        {ride.pickup_address} → {ride.dropoff_address}
                      </p>
                      <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                        <Clock className="h-4 w-4" /> {formatDeparture(ride.departure_at)}
                      </p>
                    </div>
                    <span className="text-xs font-bold uppercase px-2 py-1 rounded-full bg-primary/10 text-primary">
                      {RIDE_STATUS_LABELS[ride.status] || ride.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <span className="flex items-center gap-1"><Users className="h-4 w-4" /> {ride.seats_available} cupo(s)</span>
                    <span className="font-bold text-primary">{formatCOP(Number(ride.price_per_seat))} / cupo</span>
                    <span>{RIDE_PAYMENT_LABELS[ride.payment_method] || ride.payment_method}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 pt-2 border-t">
                    <div className="text-sm">
                      <p className="font-semibold">{ride.driver_name || "Conductor"}</p>
                      <p className="text-muted-foreground flex items-center gap-1">
                        {ride.driver_vehicle || "Carro"} · <Star className="h-3 w-3 fill-warning text-warning" /> {Number(ride.driver_rating || 5).toFixed(1)}
                      </p>
                    </div>
                    {ride.user_has_booking ? (
                      <Button variant="outline" className="rounded-xl" onClick={() => navigate(`/viajes/${ride.id}`)}>Ver reserva</Button>
                    ) : (
                      <Button className="rounded-xl" onClick={() => {
                        if (!user) {
                          navigate("/login", { state: { from: { pathname: `/viajes/${ride.id}` } } });
                          return;
                        }
                        navigate(`/viajes/${ride.id}`);
                      }}>
                        Reservar cupo
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="rounded-3xl shadow-card h-fit">
            <CardHeader><CardTitle>Mis reservas</CardTitle></CardHeader>
            <CardContent className="space-y-3 max-h-[600px] overflow-auto">
              {!user && <p className="text-sm text-muted-foreground">Inicia sesión para reservar cupos.</p>}
              {user && bookings.length === 0 && <p className="text-sm text-muted-foreground">Aún no tienes reservas.</p>}
              {bookings.map((booking) => (
                <Link key={booking.id} to={`/viajes/${booking.ride_id}`} className="block rounded-2xl border p-3 hover:bg-muted/40">
                  <p className="font-semibold text-sm">{booking.pickup_address} → {booking.dropoff_address}</p>
                  <p className="text-xs text-muted-foreground">{formatDeparture(booking.departure_at)}</p>
                  <p className="text-sm font-bold mt-1">{formatCOP(Number(booking.price_per_seat) * Number(booking.seats))}</p>
                  <p className="text-xs capitalize text-primary">{RIDE_STATUS_LABELS[booking.ride_status] || booking.ride_status}</p>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Rides;
