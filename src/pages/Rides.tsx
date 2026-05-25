import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Car, MapPin, Users, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { formatCOP } from "@/data/mock";

const Rides = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [rides, setRides] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/rides/me").then((res) => res.ok ? res.json() : []).then(setRides).catch(() => undefined);
  }, []);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    const formData = new FormData(event.currentTarget);
    const payload = {
      pickup_address: String(formData.get("pickup_address") || ""),
      dropoff_address: String(formData.get("dropoff_address") || ""),
      passengers: Number(formData.get("passengers") || 1),
      requested_price: Number(formData.get("requested_price") || 0) || null,
      payment_method: String(formData.get("payment_method") || "cash"),
      notes: String(formData.get("notes") || ""),
    };
    try {
      const response = await fetch("/api/rides", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).detail || "No se pudo solicitar el viaje");
      const data = await response.json();
      toast({ title: "Viaje solicitado", description: "Los conductores podrán enviarte ofertas." });
      navigate(`/viajes/${data.id}`);
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "No se pudo solicitar el viaje", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-warm pb-20">
      <main className="container max-w-5xl pt-8 space-y-6">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Volver</Link>
        <div className="grid lg:grid-cols-[1fr_380px] gap-6">
          <Card className="rounded-3xl shadow-glow">
            <CardHeader><CardTitle className="flex items-center gap-2 text-2xl"><Car className="h-7 w-7 text-primary" /> Solicitar viaje compartido</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-2"><Label className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Punto de recogida</Label><Input name="pickup_address" required placeholder="Ej: Parque principal" className="rounded-xl" /></div>
                <div className="space-y-2"><Label>Destino</Label><Input name="dropoff_address" required placeholder="Ej: Centro comercial" className="rounded-xl" /></div>
                <div className="grid sm:grid-cols-3 gap-4"><div className="space-y-2"><Label className="flex items-center gap-2"><Users className="h-4 w-4" /> Pasajeros</Label><Input name="passengers" type="number" min="1" max="6" defaultValue="1" className="rounded-xl" /></div><div className="space-y-2"><Label className="flex items-center gap-2"><Wallet className="h-4 w-4" /> Precio sugerido</Label><Input name="requested_price" type="number" min="0" placeholder="12000" className="rounded-xl" /></div><div className="space-y-2"><Label>Pago</Label><Input name="payment_method" defaultValue="cash" className="rounded-xl" /></div></div>
                <div className="space-y-2"><Label>Notas</Label><Textarea name="notes" placeholder="Equipaje, punto exacto, referencias..." className="rounded-xl" /></div>
                <Button disabled={loading} className="w-full rounded-xl">{loading ? "Solicitando..." : "Pedir viaje"}</Button>
              </form>
            </CardContent>
          </Card>
          <Card className="rounded-3xl shadow-card">
            <CardHeader><CardTitle>Mis viajes recientes</CardTitle></CardHeader>
            <CardContent className="space-y-3 max-h-[520px] overflow-auto">
              {rides.length === 0 && <p className="text-sm text-muted-foreground">Aún no tienes viajes.</p>}
              {rides.map((ride) => <Link key={ride.id} to={`/viajes/${ride.id}`} className="block rounded-2xl border p-3 hover:bg-muted/40"><div className="flex justify-between"><b>{ride.id}</b><span className="capitalize text-primary">{ride.status}</span></div><p className="text-sm text-muted-foreground">{ride.pickup_address} → {ride.dropoff_address}</p><p className="font-bold">{formatCOP(Number(ride.accepted_price || ride.requested_price || 0))}</p></Link>)}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Rides;
