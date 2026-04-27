import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Clock, Plus, Star, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCOP } from "@/data/mock"; // Mantener solo formatCOP si es necesario
import { useCart } from "@/context/CartContext";
import { toast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

interface Business {
  id: string;
  name: string;
  description: string;
  category: string;
  address: string;
  phone: string;
  rating: number;
  emoji: string;
  image_url: string;
  delivery_fee: number;
  eta: string;
  status: string;
  created_at: string;
}

interface MenuItem {
  id: number;
  business_id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image_url: string;
  emoji: string;
  is_active: boolean;
}

interface Promotion {
  id: number;
  business_id: string;
  title: string;
  description: string;
  discount_percent: number;
  promo_code: string;
  emoji: string;
}

const BusinessDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { add } = useCart();

  const { data: business, isLoading: isLoadingBusiness, error: errorBusiness } = useQuery<Business>({
    queryKey: ["business", id],
    queryFn: async () => {
      const response = await fetch(`/api/businesses/${id}`);
      if (!response.ok) {
        throw new Error("Error fetching business details");
      }
      return response.json();
    },
    enabled: !!id,
  });

  const { data: menuItems, isLoading: isLoadingMenuItems, error: errorMenuItems } = useQuery<MenuItem[]>({
    queryKey: ["menuItems", id],
    queryFn: async () => {
      const response = await fetch(`/api/businesses/${id}/menu`);
      if (!response.ok) {
        throw new Error("Error fetching menu items");
      }
      return response.json();
    },
    enabled: !!id,
  });

  const { data: promotions, isLoading: isLoadingPromos } = useQuery<Promotion[]>({
    queryKey: ["promotions", id],
    queryFn: async () => {
      const response = await fetch(`/api/promotions/${id}`);
      if (!response.ok) {
        throw new Error("Error fetching promotions");
      }
      return response.json();
    },
    enabled: !!id,
  });

  const handleAdd = (item: MenuItem) => {
    if (!business) return;
    add(item, business.name);
    toast({ title: "Añadido al carrito", description: item.name });
  };

  if (isLoadingBusiness || isLoadingMenuItems) {
    return (
      <div className="min-h-screen bg-gradient-warm">
        <div className="container py-20 text-center">
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  if (errorBusiness || !business) {
    toast({ title: "Error", description: "No se pudo cargar el negocio o no existe.", variant: "destructive" });
    return (
      <div className="min-h-screen bg-gradient-warm">
        <div className="container py-20 text-center">
          <p className="text-muted-foreground">Negocio no encontrado.</p>
          <Button asChild variant="soft" className="mt-4"><Link to="/negocios">Volver</Link></Button>
        </div>
      </div>
    );
  }

  if (errorMenuItems) {
    toast({ title: "Error", description: "No se pudieron cargar los items del menú.", variant: "destructive" });
  }

  return (
    <div className="min-h-screen bg-gradient-warm">
      <main className="container py-8">
        <Link to="/negocios" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> Todos los negocios
        </Link>

        <div className="relative rounded-3xl overflow-hidden shadow-glow min-h-[300px] flex items-end">
          {/* Background Image with Overlay */}
          <div className="absolute inset-0 z-0">
            {business.image_url ? (
              <img
                src={business.image_url.startsWith("http") ? business.image_url : (business.image_url.startsWith("/api") ? business.image_url : `/api${business.image_url}`)}
                alt={business.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-hero" />
            )}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          </div>

          {/* Content Overlay */}
          <div className="relative z-10 p-8 md:p-12 flex flex-col md:flex-row items-center gap-8 w-full text-white">
            <div className="h-32 w-32 md:h-40 md:w-40 rounded-full bg-white border-4 border-white/30 overflow-hidden shadow-soft shrink-0 p-2 flex items-center justify-center">
              {business.image_url ? (
                <img src={business.image_url.startsWith("http") ? business.image_url : (business.image_url.startsWith("/api") ? business.image_url : `/api${business.image_url}`)} alt={business.name} className="h-full w-full object-contain" />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-white/10 rounded-full">
                  <Store className="h-16 w-16 text-white" />
                </div>
              )}
            </div>
            <div className="text-center md:text-left flex-1">
              <p className="text-sm opacity-90 uppercase tracking-widest font-bold text-primary-foreground drop-shadow-sm">
                {business.category}
              </p>
              <h1 className="text-4xl md:text-6xl font-display font-bold mt-2 drop-shadow-md">
                {business.name}
              </h1>
              <div className="mt-6 flex flex-wrap justify-center md:justify-start items-center gap-4 text-sm font-medium">
                <span className="flex items-center gap-1.5 bg-white/20 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10 shadow-soft">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  {business.rating}
                </span>
                <span className="flex items-center gap-1.5 bg-white/20 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10 shadow-soft">
                  <Clock className="h-4 w-4" />
                  {business.eta}
                </span>
                <span className="bg-primary/80 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10 shadow-soft font-bold">
                  Envío {formatCOP(business.delivery_fee)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <h2 className="mt-10 mb-4 text-2xl font-display font-bold">Menú</h2>
        {isLoadingMenuItems ? (
          <p className="text-muted-foreground">Cargando menú...</p>
        ) : (menuItems || []).length > 0 ? (
          <div className="grid md:grid-cols-2 gap-4">
            {menuItems.map((m) => (
              <div key={m.id} className="rounded-2xl bg-card border border-border/60 p-5 shadow-card flex items-center gap-4">
                <div className="text-5xl">{m.emoji}</div>
                <div className="flex-1">
                  <h3 className="font-bold">{m.name}</h3>
                  <p className="text-sm text-muted-foreground">{m.description}</p>
                  <p className="mt-2 font-display font-bold text-primary">{formatCOP(m.price)}</p>
                </div>
                <Button size="icon" variant="hero" onClick={() => handleAdd(m)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">Este negocio aún no tiene productos.</p>
        )}
      </main>
    </div>
  );
};

export default BusinessDetail;
