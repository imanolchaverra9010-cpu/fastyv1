import { useState, useEffect } from "react";
import { Search, Bike, Phone, Star, User, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

export const CouriersTab = () => {
  const [couriers, setCouriers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchCouriers = async () => {
    setLoading(true);
    try {
      // Reutilizamos el endpoint de listado de domiciliarios
      const response = await fetch("/api/admin/couriers");
      if (response.ok) {
        const data = await response.json();
        setCouriers(data);
      }
    } catch (error) {
      console.error("Error fetching couriers:", error);
      toast({ title: "Error", description: "No se pudieron cargar los domiciliarios.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCouriers();
  }, []);

  const filteredCouriers = (couriers || []).filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.vehicle.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-bold">Repartidores Disponibles</h2>
          <p className="text-sm text-muted-foreground">Consulta el equipo de domiciliarios de la plataforma.</p>
        </div>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o vehículo…"
            className="pl-9 h-10 rounded-xl"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          Array(6).fill(0).map((_, i) => (
            <div key={i} className="h-32 rounded-2xl bg-muted animate-pulse" />
          ))
        ) : filteredCouriers.map((c) => (
          <div key={c.id} className="bg-card border border-border/60 rounded-2xl p-5 shadow-card hover:shadow-glow transition-all group relative overflow-hidden">
            <div className="flex items-start gap-4">
              <div className="h-16 w-16 rounded-2xl bg-gradient-hero flex items-center justify-center text-white font-bold text-xl shadow-soft shrink-0 overflow-hidden">
                {c.image_url ? (
                  <img 
                    src={c.image_url.startsWith("http") ? c.image_url : `/api${c.image_url}`} 
                    alt={c.name} 
                    className="h-full w-full object-cover"
                  />
                ) : (
                  c.name.split(" ").map((n: any) => n[0]).join("").slice(0, 2)
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold truncate text-base">{c.name}</h3>
                  <div className="flex items-center gap-1 bg-warning/10 text-warning px-2 py-0.5 rounded-full text-[10px] font-bold">
                    <Star className="h-3 w-3 fill-warning" />
                    {c.rating?.toFixed(1) || "5.0"}
                  </div>
                </div>
                
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Bike className="h-3.5 w-3.5 text-primary" /> {c.vehicle}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5 text-primary" /> {c.deliveries || 0} entregas
                  </p>
                </div>
                
                <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-primary" /> {c.phone}
                </p>

                <div className="mt-4 flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    c.status === "online" ? "bg-success/10 text-success" :
                    c.status === "busy" ? "bg-warning/15 text-warning-foreground" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${
                      c.status === "online" ? "bg-success animate-pulse" :
                      c.status === "busy" ? "bg-warning" : "bg-muted-foreground"
                    }`} />
                    {c.status === "online" ? "Libre" : c.status === "busy" ? "En pedido" : "Offline"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {!loading && filteredCouriers.length === 0 && (
        <div className="text-center py-12">
          <User className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground">No se encontraron domiciliarios.</p>
        </div>
      )}
    </div>
  );
};
