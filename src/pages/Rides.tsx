import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Car, MapPin, Users, Wallet, LocateFixed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { formatCOP } from "@/data/mock";
import { useAuth } from "@/context/AuthContext";
import LocationPicker from "@/components/LocationPicker";
import { getPreciseCurrentPosition, getPositionErrorMessage } from "@/utils/geolocation";
import { RIDE_STATUS_LABELS, RIDE_PAYMENT_LABELS } from "@/constants/rides";

type CoordField = "pickup" | "dropoff" | null;

const Rides = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [rides, setRides] = useState<any[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [pickerField, setPickerField] = useState<CoordField>(null);
  const [pickup, setPickup] = useState({ address: "", lat: null as number | null, lng: null as number | null });
  const [dropoff, setDropoff] = useState({ address: "", lat: null as number | null, lng: null as number | null });

  useEffect(() => {
    if (!user) return;
    fetch("/api/rides/me")
      .then((res) => (res.ok ? res.json() : []))
      .then(setRides)
      .catch(() => undefined);
  }, [user]);

  const useMyLocation = async (target: "pickup" | "dropoff") => {
    try {
      const pos = await getPreciseCurrentPosition();
      const setter = target === "pickup" ? setPickup : setDropoff;
      setter((prev) => ({ ...prev, lat: pos.latitude, lng: pos.longitude }));
      toast({ title: "Ubicación obtenida", description: "Coordenadas listas para el viaje." });
    } catch (error) {
      toast({
        title: "No se pudo obtener ubicación",
        description: getPositionErrorMessage(error as GeolocationPositionError),
        variant: "destructive",
      });
    }
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) {
      navigate("/login", { state: { from: { pathname: "/viajes" } } });
      return;
    }
    setLoading(true);
    const formData = new FormData(event.currentTarget);
    const payload = {
      pickup_address: pickup.address || String(formData.get("pickup_address") || ""),
      pickup_lat: pickup.lat,
      pickup_lng: pickup.lng,
      dropoff_address: dropoff.address || String(formData.get("dropoff_address") || ""),
      dropoff_lat: dropoff.lat,
      dropoff_lng: dropoff.lng,
      passengers: Number(formData.get("passengers") || 1),
      requested_price: Number(formData.get("requested_price") || 0) || null,
      payment_method: paymentMethod,
      notes: String(formData.get("notes") || ""),
    };
    try {
      const response = await fetch("/api/rides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || "No se pudo solicitar el viaje");
      }
      const data = await response.json();
      toast({ title: "Viaje solicitado", description: "Los conductores en carro podrán enviarte ofertas." });
      navigate(`/viajes/${data.id}`);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo solicitar el viaje",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-warm pb-20">
      <main className="container max-w-5xl pt-8 space-y-6">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>

        <div className="rounded-3xl bg-primary/10 border border-primary/20 p-6">
          <h1 className="text-3xl font-display font-bold flex items-center gap-2">
            <Car className="h-8 w-8 text-primary" /> Fasty Viajes
          </h1>
          <p className="text-muted-foreground mt-2">
            Solicita un viaje, recibe ofertas de conductores verificados y elige la que prefieras. Pago en efectivo o transferencia.
          </p>
        </div>

        <div className="grid lg:grid-cols-[1fr_380px] gap-6">
          <Card className="rounded-3xl shadow-glow">
            <CardHeader>
              <CardTitle className="text-xl">Nuevo viaje</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Punto de recogida</Label>
                  <Input
                    name="pickup_address"
                    required
                    placeholder="Ej: Parque principal"
                    className="rounded-xl"
                    value={pickup.address}
                    onChange={(e) => setPickup((p) => ({ ...p, address: e.target.value }))}
                  />
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => useMyLocation("pickup")}>
                      <LocateFixed className="h-4 w-4 mr-1" /> Mi ubicación
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => setPickerField("pickup")}>
                      Elegir en mapa
                    </Button>
                  </div>
                  {pickup.lat != null && <p className="text-xs text-muted-foreground">GPS: {pickup.lat.toFixed(5)}, {pickup.lng?.toFixed(5)}</p>}
                </div>

                <div className="space-y-2">
                  <Label>Destino</Label>
                  <Input
                    name="dropoff_address"
                    required
                    placeholder="Ej: Centro comercial"
                    className="rounded-xl"
                    value={dropoff.address}
                    onChange={(e) => setDropoff((p) => ({ ...p, address: e.target.value }))}
                  />
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => useMyLocation("dropoff")}>
                      <LocateFixed className="h-4 w-4 mr-1" /> Mi ubicación
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => setPickerField("dropoff")}>
                      Elegir en mapa
                    </Button>
                  </div>
                  {dropoff.lat != null && <p className="text-xs text-muted-foreground">GPS: {dropoff.lat.toFixed(5)}, {dropoff.lng?.toFixed(5)}</p>}
                </div>

                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2"><Users className="h-4 w-4" /> Pasajeros</Label>
                    <Input name="passengers" type="number" min="1" max="6" defaultValue="1" className="rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2"><Wallet className="h-4 w-4" /> Precio sugerido</Label>
                    <Input name="requested_price" type="number" min="0" placeholder="12000" className="rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Label>Forma de pago</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Efectivo</SelectItem>
                        <SelectItem value="transfer">Transferencia</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Notas</Label>
                  <Textarea name="notes" placeholder="Equipaje, punto exacto, referencias..." className="rounded-xl" />
                </div>

                <Button disabled={loading} className="w-full rounded-xl">
                  {loading ? "Solicitando..." : user ? "Pedir viaje" : "Inicia sesión para pedir viaje"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="rounded-3xl shadow-card">
            <CardHeader><CardTitle>Mis viajes recientes</CardTitle></CardHeader>
            <CardContent className="space-y-3 max-h-[520px] overflow-auto">
              {!user && <p className="text-sm text-muted-foreground">Inicia sesión para ver tu historial.</p>}
              {user && rides.length === 0 && <p className="text-sm text-muted-foreground">Aún no tienes viajes.</p>}
              {rides.map((ride) => (
                <Link key={ride.id} to={`/viajes/${ride.id}`} className="block rounded-2xl border p-3 hover:bg-muted/40">
                  <div className="flex justify-between"><b>{ride.id}</b><span className="text-primary">{RIDE_STATUS_LABELS[ride.status] || ride.status}</span></div>
                  <p className="text-sm text-muted-foreground">{ride.pickup_address} → {ride.dropoff_address}</p>
                  <p className="font-bold">{formatCOP(Number(ride.accepted_price || ride.requested_price || 0))}</p>
                  <p className="text-xs text-muted-foreground">{RIDE_PAYMENT_LABELS[ride.payment_method] || ride.payment_method}</p>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </main>

      {pickerField && (
        <LocationPicker
          initialPos={{
            lat: (pickerField === "pickup" ? pickup.lat : dropoff.lat) ?? 5.691,
            lng: (pickerField === "pickup" ? pickup.lng : dropoff.lng) ?? -76.658,
          }}
          onCancel={() => setPickerField(null)}
          onConfirm={(pos) => {
            if (pickerField === "pickup") setPickup((p) => ({ ...p, lat: pos.lat, lng: pos.lng }));
            else setDropoff((p) => ({ ...p, lat: pos.lat, lng: pos.lng }));
            setPickerField(null);
          }}
        />
      )}
    </div>
  );
};

export default Rides;
