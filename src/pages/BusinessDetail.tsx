import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Clock, Plus, Star, Store, ChevronDown, ChevronUp, Info } from "lucide-react";
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



const BusinessDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { add } = useCart();
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const toggleItem = (itemId: number) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

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

  const groupedItems = (menuItems || []).reduce((acc: any, item) => {
    const cat = item.category || "General";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

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
            <div className="h-32 w-32 md:h-40 md:w-40 rounded-full bg-white border-4 border-white/30 overflow-hidden shadow-soft shrink-0 flex items-center justify-center">
              {business.image_url ? (
                <img src={business.image_url.startsWith("http") ? business.image_url : (business.image_url.startsWith("/api") ? business.image_url : `/api${business.image_url}`)} alt={business.name} className="h-full w-full object-cover" />
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
              </div>
            </div>
          </div>
        </div>

        <h2 className="mt-10 mb-6 text-3xl font-display font-bold">Menú</h2>
        {isLoadingMenuItems ? (
          <p className="text-muted-foreground">Cargando menú...</p>
        ) : (menuItems || []).length > 0 ? (
          <div className="space-y-4">
            {Object.entries(groupedItems).map(([category, items]: [string, any]) => {
              const isExpanded = expandedCategories.has(category);
              return (
                <div key={category} className="rounded-2xl bg-card border border-border/60 shadow-soft overflow-hidden">
                  <button 
                    onClick={() => toggleCategory(category)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-1.5 h-6 bg-primary rounded-full"></span>
                      <h3 className="text-xl font-bold uppercase">{category}</h3>
                      <span className="text-xs font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        {items.length}
                      </span>
                    </div>
                    {isExpanded ? <ChevronUp className="h-5 w-5 text-primary" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                  </button>
                  
                  {isExpanded && (
                    <div className="px-6 pb-6 pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="grid md:grid-cols-2 gap-4">
                        {items.map((m: any) => (
                          <div key={m.id} className="rounded-2xl bg-muted/20 border border-border/40 p-4 hover:border-primary/20 transition-all shadow-sm group">
                            <div className="flex gap-3">
                              {/* Texto del producto */}
                              <div className="flex-1 min-w-0 flex flex-col justify-between">
                                <div>
                                  <h3 className="font-bold text-sm md:text-base uppercase leading-tight line-clamp-2 text-foreground/90">
                                    {m.name}
                                  </h3>
                                  {m.description && !expandedItems.has(m.id) && (
                                    <p className="text-[10px] text-muted-foreground line-clamp-1 mt-1">
                                      {m.description}
                                    </p>
                                  )}
                                </div>
                                <p className="mt-2 font-display font-bold text-primary text-base">
                                  {formatCOP(m.price)}
                                </p>
                              </div>

                              {/* Acciones */}
                              <div className="flex flex-col items-center justify-center gap-2 shrink-0">
                                <Button 
                                  size="icon" 
                                  variant="hero" 
                                  onClick={() => handleAdd(m)} 
                                  className="h-12 w-12 rounded-xl shadow-lg active:scale-90 transition-transform bg-primary text-white"
                                >
                                  <Plus className="h-6 w-6" />
                                </Button>
                                {m.description && (
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleItem(m.id);
                                    }}
                                    className="p-1 text-muted-foreground hover:text-primary transition-colors"
                                  >
                                    {expandedItems.has(m.id) ? (
                                      <ChevronUp className="h-4 w-4" />
                                    ) : (
                                      <div className="flex items-center gap-1">
                                        <span className="text-[10px] font-bold">INFO</span>
                                        <Info className="h-3.5 w-3.5" />
                                      </div>
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Descripción expandida */}
                            {m.description && expandedItems.has(m.id) && (
                              <div className="mt-3 text-xs text-muted-foreground bg-white/60 backdrop-blur-sm p-3 rounded-xl border border-primary/10 animate-in fade-in zoom-in-95 duration-200">
                                <p className="font-bold text-[10px] text-primary uppercase mb-1">Descripción:</p>
                                {m.description}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-muted-foreground">Este negocio aún no tiene productos.</p>
        )}
      </main>
    </div>
  );
};

export default BusinessDetail;
