import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Car, MapPin, Search, Users, Clock, Star, ShieldCheck, History, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCOP } from "@/data/mock";
import { useAuth } from "@/context/AuthContext";
import { RIDE_STATUS_LABELS, RIDE_PAYMENT_LABELS, formatDeparture, formatVehicleInfo } from "@/constants/rides";

const Rides = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState<"available" | "history" | "ranking">("available");
  const [rides, setRides] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [ranking, setRanking] = useState<any[]>([]);
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
    const tasks: Promise<any>[] = [
      fetch(`/api/rides${query}`).then((res) => (res.ok ? res.json() : [])),
      user ? fetch("/api/rides/my-bookings").then((res) => (res.ok ? res.json() : [])) : Promise.resolve([]),
      fetch("/api/rides/drivers/ranking?limit=20").then((res) => (res.ok ? res.json() : [])),
    ];
    if (user) {
      tasks.push(fetch("/api/rides/history").then((res) => (res.ok ? res.json() : { as_passenger: [] })));
    }
    Promise.all(tasks)
      .then((results) => {
        const published = results[0];
        const myBookings = results[1];
        const rankList = results[2];
        const hist = user ? results[3] : null;
        setRides(published);
        setBookings(myBookings);
        setRanking(rankList);
        setHistory(hist?.as_passenger || []);
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
            Elige un viaje publicado por un conductor verificado. Reserva el cupo que más te sirva.
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant={tab === "available" ? "default" : "outline"} className="rounded-xl" onClick={() => setTab("available")}>Disponibles</Button>
          <Button variant={tab === "ranking" ? "default" : "outline"} className="rounded-xl" onClick={() => setTab("ranking")}>
            <Trophy className="h-4 w-4 mr-2" /> Ranking
          </Button>
          {user && (
            <Button variant={tab === "history" ? "default" : "outline"} className="rounded-xl" onClick={() => setTab("history")}>
              <History className="h-4 w-4 mr-2" /> Historial
            </Button>
          )}
        </div>

        {tab === "available" && (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por origen o destino..." className="pl-10 rounded-2xl h-12" />
            </div>

            <div className="grid lg:grid-cols-[1fr_340px] gap-6">
              <div className="space-y-4">
                {loading && <p className="text-sm text-muted-foreground">Cargando viajes...</p>}
                {!loading && rides.length === 0 && (
                  <Card className="rounded-3xl"><CardContent className="p-8 text-center text-muted-foreground">No hay viajes publicados ahora.</CardContent></Card>
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
                      </div>
                      <div className="flex items-center justify-between gap-3 pt-2 border-t">
                        <div className="text-sm">
                          <p className="font-semibold flex items-center gap-1">
                            {ride.driver_name || "Conductor"}
                            {ride.driver_verified && <ShieldCheck className="h-4 w-4 text-success" />}
                          </p>
                          <p className="text-muted-foreground text-xs">{formatVehicleInfo(ride)}</p>
                          <p className="text-muted-foreground flex items-center gap-1">
                            <Star className="h-3 w-3 fill-warning text-warning" /> {Number(ride.driver_rating || 5).toFixed(1)}
                          </p>
                        </div>
                        <Button className="rounded-xl" onClick={() => {
                          if (!user) { navigate("/login", { state: { from: { pathname: `/viajes/${ride.id}` } } }); return; }
                          navigate(`/viajes/${ride.id}`);
                        }}>
                          {ride.user_has_booking ? "Ver reserva" : "Reservar cupo"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card className="rounded-3xl shadow-card h-fit">
                <CardHeader><CardTitle>Mis reservas activas</CardTitle></CardHeader>
                <CardContent className="space-y-3 max-h-[600px] overflow-auto">
                  {!user && <p className="text-sm text-muted-foreground">Inicia sesión para reservar.</p>}
                  {user && bookings.filter((b) => !["completed", "cancelled"].includes(b.ride_status)).length === 0 && (
                    <p className="text-sm text-muted-foreground">Sin reservas activas.</p>
                  )}
                  {bookings.filter((b) => !["completed", "cancelled"].includes(b.ride_status)).map((booking) => (
                    <Link key={booking.id} to={`/viajes/${booking.ride_id}`} className="block rounded-2xl border p-3 hover:bg-muted/40">
                      <p className="font-semibold text-sm">{booking.pickup_address} → {booking.dropoff_address}</p>
                      <p className="text-xs text-muted-foreground">{formatDeparture(booking.departure_at)}</p>
                      <p className="text-xs capitalize text-primary">{RIDE_STATUS_LABELS[booking.ride_status] || booking.ride_status}</p>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {tab === "ranking" && (
          <Card className="rounded-3xl shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-warning" /> Mejores conductores</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">Ranking por calificación, viajes completados y penalizaciones (últimos 90 días).</p>
              {ranking.length === 0 && <p className="text-sm text-muted-foreground">Aún no hay conductores en el ranking.</p>}
              {ranking.map((driver) => (
                <div key={driver.driver_id} className="flex items-center gap-4 rounded-2xl border p-4">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-lg shrink-0 ${driver.rank <= 3 ? "bg-warning/20 text-warning" : "bg-muted"}`}>
                    #{driver.rank}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold flex items-center gap-1 truncate">
                      {driver.name}
                      {driver.verified && <ShieldCheck className="h-4 w-4 text-success shrink-0" />}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{driver.vehicle_model || driver.vehicle || "Carro"}</p>
                  </div>
                  <div className="text-right text-sm shrink-0">
                    <p className="flex items-center justify-end gap-1 font-bold"><Star className="h-3 w-3 fill-warning text-warning" /> {driver.avg_rating}</p>
                    <p className="text-xs text-muted-foreground">{driver.completed_rides} viajes</p>
                    <p className="text-xs text-primary font-semibold">{driver.rank_score} pts</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {tab === "history" && user && (
          <Card className="rounded-3xl shadow-card">
            <CardHeader><CardTitle>Historial completo</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {history.length === 0 && <p className="text-sm text-muted-foreground">Aún no tienes viajes en tu historial.</p>}
              {history.map((item) => (
                <Link key={item.id} to={`/viajes/${item.ride_id}`} className="block rounded-2xl border p-4 hover:bg-muted/40">
                  <p className="font-semibold">{item.pickup_address} → {item.dropoff_address}</p>
                  <p className="text-sm text-muted-foreground">{formatDeparture(item.departure_at)} · {item.seats} cupo(s)</p>
                  <p className="text-sm">{formatCOP(Number(item.price_per_seat) * Number(item.seats))} · {RIDE_STATUS_LABELS[item.ride_status || item.status] || item.ride_status || item.status}</p>
                </Link>
              ))}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default Rides;
