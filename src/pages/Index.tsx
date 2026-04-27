import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Bike, Clock, MapPin, Search, ShieldCheck, Sparkles, Star, Store, Loader2, ChevronLeft, ChevronRight, Percent, Tag, Gift, TrendingUp, Plus, ShoppingCart } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import SearchInput from "@/components/SearchInput";
import heroImg from "@/assets/hero-delivery.jpg";
import { useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useCart } from "@/context/CartContext";
import PromoModal from "@/components/PromoModal";
import { useAuth } from "@/context/AuthContext";

import { CATEGORIES } from "@/constants/categories";

const Index = () => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { data: businesses, isLoading: isLoadingBusinesses, error: errorBusinesses } = useQuery<any[]>({
    queryKey: ["featuredBusinesses"],
    queryFn: async () => {
      const response = await fetch("/api/businesses?status_filter=active");
      if (!response.ok) {
        throw new Error("Error fetching featured businesses");
      }
      const data = await response.json();
      return data.sort((a: any, b: any) => b.rating - a.rating).slice(0, 12);
    },
  });

  const { data: promotions, isLoading: isLoadingPromos } = useQuery<any[]>({
    queryKey: ["activePromotions"],
    queryFn: async () => {
      const response = await fetch("/api/promotions/");
      if (!response.ok) {
        throw new Error("Error fetching promotions");
      }
      return response.json();
    },
  });
  
  const { user } = useAuth();
  
  const { data: activeOrders } = useQuery<any[]>({
    queryKey: ["activeOrders", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const response = await fetch(`/api/orders/user/${user.id}`);
      if (!response.ok) throw new Error("Error fetching orders");
      const data = await response.json();
      return data.filter((o: any) => o.status !== "delivered" && o.status !== "cancelled");
    },
    enabled: !!user?.id,
    refetchInterval: 10000,
  });

  const latestActiveOrder = activeOrders?.[0];

  const calculateMinutesLeft = (estimatedTime: string) => {
    if (!estimatedTime) return null;
    const now = new Date();
    const eta = new Date(estimatedTime);
    const diffMs = eta.getTime() - now.getTime();
    const diffMins = Math.round(diffMs / 60000);
    return diffMins > 0 ? `${diffMins} min` : "Llegando";
  };

  useEffect(() => {
    if (errorBusinesses) {
      toast({ title: "Error", description: "No se pudieron cargar los negocios destacados.", variant: "destructive" });
    }
  }, [errorBusinesses]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollTo = direction === 'left' ? scrollLeft - clientWidth : scrollLeft + clientWidth;
      scrollRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-warm">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-primary/20 blur-3xl" aria-hidden />
        <div className="absolute top-20 -left-20 h-[300px] w-[300px] rounded-full bg-orange-200/20 blur-3xl" aria-hidden />
        
        <div className="container mx-auto px-4 pt-20 pb-24 md:pt-28 md:pb-32 flex flex-col md:flex-row items-center relative z-10">
          <div className="md:w-1/2 md:pr-12 mb-12 md:mb-0 animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Sparkles className="h-4 w-4" />
              <span>La mejor comida a tu puerta</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-6 tracking-tight">
              Tus antojos <br />
              <span className="text-primary bg-clip-text text-transparent bg-gradient-to-r from-primary to-orange-400">
                más rápido
              </span>
            </h1>
            <p className="text-lg text-muted-foreground mb-8 max-w-md leading-relaxed">
              Descubre los mejores restaurantes de tu ciudad y recibe tu pedido en minutos con Fasty.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <SearchInput className="w-full sm:w-96" />
              <Button size="lg" className="h-12 px-8 rounded-full shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/30 active:scale-95">
                Explorar
              </Button>
            </div>
            
            <div className="flex items-center gap-8">
              <div className="flex flex-col">
                <span className="text-2xl font-bold">120+</span>
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Negocios</span>
              </div>
              <div className="h-10 w-px bg-border" />
              <div className="flex flex-col">
                <span className="text-2xl font-bold">10k+</span>
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Clientes</span>
              </div>
              <div className="h-10 w-px bg-border" />
              <div className="flex flex-col">
                <span className="text-2xl font-bold">4.9/5</span>
                <div className="flex items-center gap-1">
                  <Star className="h-3 w-3 fill-warning text-warning" />
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Rating</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="md:w-1/2 relative animate-fade-in">
            <div className="relative rounded-3xl overflow-hidden shadow-2xl border-8 border-white/50 backdrop-blur-sm">
              <img 
                src={heroImg} 
                alt="Delivery Hero" 
                className="w-full h-auto object-cover"
              />
            </div>

            {latestActiveOrder && (
              <Link 
                to={`/rastreo/${latestActiveOrder.id}`}
                className="absolute -bottom-6 -left-6 bg-card rounded-2xl shadow-card p-4 border border-border/60 animate-float hover:scale-105 transition-transform"
              >
                <div className="flex items-center gap-3">
                  <div className="grid place-items-center h-10 w-10 rounded-xl bg-success/15 text-success">
                    <Bike className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Pedido #{latestActiveOrder.id}</p>
                    <p className="text-sm font-semibold capitalize">
                      {latestActiveOrder.status === 'pending' && 'Recibido'}
                      {latestActiveOrder.status === 'preparing' && 'Preparando'}
                      {latestActiveOrder.status === 'shipped' && 'En camino'}
                      {latestActiveOrder.status === 'in_transit' && 'Cerca de ti'}
                      {latestActiveOrder.status === 'delivered' && 'Entregado'}
                      {latestActiveOrder.status === 'cancelled' && 'Cancelado'}
                      {' · '}{calculateMinutesLeft(latestActiveOrder.estimated_delivery_time) || 'Pronto'}
                    </p>
                  </div>
                </div>
              </Link>
            )}

            {!latestActiveOrder && (
              <div className="absolute -bottom-6 -left-6 bg-card rounded-2xl shadow-card p-4 border border-border/60 animate-float opacity-80">
                <div className="flex items-center gap-3">
                  <div className="grid place-items-center h-10 w-10 rounded-xl bg-success/15 text-success">
                    <Bike className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Pedido #1042</p>
                    <p className="text-sm font-semibold">En camino · 8 min</p>
                  </div>
                </div>
              </div>
            )}

            <div className="absolute -top-4 -right-4 bg-card rounded-2xl shadow-card p-4 border border-border/60 animate-float" style={{ animationDelay: "1.5s" }}>
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 fill-warning text-warning" />
                <span className="text-sm font-semibold">+340 pedidos hoy</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-12 bg-white">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold">Categorías</h2>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="icon" 
                className="rounded-full h-8 w-8"
                onClick={() => scroll('left')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                size="icon" 
                className="rounded-full h-8 w-8"
                onClick={() => scroll('right')}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <div 
            ref={scrollRef}
            className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x"
          >
            {CATEGORIES.map((cat) => (
              <Link 
                key={cat.id} 
                to={`/negocios?category=${cat.id}`}
                className="flex-shrink-0 flex flex-col items-center gap-3 p-4 rounded-2xl border border-border hover:border-primary hover:bg-primary/5 transition-all snap-start min-w-[110px]"
              >
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  {cat.icon}
                </div>
                <span className="text-sm font-medium">{cat.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Promotions */}
      {promotions && promotions.length > 0 && (
        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-orange-100 flex items-center justify-center text-primary">
                  <Percent className="h-5 w-5" />
                </div>
                <h2 className="text-2xl font-bold">Ofertas Irresistibles</h2>
              </div>
              <Link to="/negocios" className="text-primary font-medium flex items-center gap-1 hover:underline">
                Ver todo <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {promotions.map((promo) => (
                <div key={promo.id} className="group relative bg-card rounded-3xl overflow-hidden border border-border/60 hover:shadow-xl transition-all">
                  <div className="aspect-[16/9] overflow-hidden">
                    <img 
                      src={promo.image_url.startsWith("http") ? promo.image_url : (promo.image_url.startsWith("/api") ? promo.image_url : `/api${promo.image_url}`)} 
                      alt={promo.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-4 left-4">
                      <div className="px-3 py-1 rounded-full bg-white/90 backdrop-blur-sm text-primary text-sm font-bold flex items-center gap-1 shadow-sm">
                        <Tag className="h-3 w-3" />
                        -{promo.discount_percent}% OFF
                      </div>
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">{promo.emoji}</span>
                      <h3 className="font-bold text-lg leading-tight">{promo.title}</h3>
                    </div>
                    <p className="text-muted-foreground text-sm mb-4 line-clamp-2">{promo.description}</p>
                    <Button 
                      className="w-full rounded-xl"
                      onClick={() => navigate(`/negocios/${promo.business_id}`)}
                    >
                      Aprovechar Oferta
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Featured Businesses */}
      <section className="py-16 bg-white/50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-orange-100 flex items-center justify-center text-primary">
                <TrendingUp className="h-5 w-5" />
              </div>
              <h2 className="text-2xl font-bold">Populares cerca de ti</h2>
            </div>
            <Link to="/negocios" className="text-primary font-medium flex items-center gap-1 hover:underline">
              Ver todos <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          
          {isLoadingBusinesses ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-80 rounded-3xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {businesses?.map((b) => (
                <Link 
                  key={b.id} 
                  to={`/negocios/${b.id}`}
                  className="group bg-card rounded-3xl overflow-hidden border border-border/60 hover:shadow-xl transition-all h-full flex flex-col"
                >
                  <div className="aspect-[4/3] overflow-hidden relative">
                    <img 
                      src={b.image_url.startsWith("http") ? b.image_url : (b.image_url.startsWith("/api") ? b.image_url : `/api${b.image_url}`)} 
                      alt={b.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-sm">
                      <Star className="h-4 w-4 fill-warning text-warning" />
                    </div>
                  </div>
                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">{b.emoji}</span>
                      <h3 className="font-bold text-lg leading-tight group-hover:text-primary transition-colors">{b.name}</h3>
                    </div>
                    <p className="text-muted-foreground text-sm mb-4 line-clamp-2 flex-1">{b.description}</p>
                    <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground pt-4 border-t border-border/40">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-primary" />
                        {b.eta}
                      </div>
                      <div className="flex items-center gap-1 text-success">
                        <MapPin className="h-3.5 w-3.5" />
                        Envío ${b.delivery_fee.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="bg-primary rounded-[3rem] p-8 md:p-16 relative overflow-hidden text-white shadow-2xl shadow-primary/30">
            <div className="absolute top-0 right-0 h-full w-1/3 bg-white/10 skew-x-[-20deg] translate-x-1/2" />
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-12">
              <div className="md:w-1/2">
                <h2 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">¿Tienes un negocio? <br /> Únete a Fasty</h2>
                <p className="text-primary-foreground/90 text-lg mb-8 max-w-md">
                  Haz crecer tus ventas y llega a miles de clientes nuevos en tu ciudad. Nosotros nos encargamos de la logística.
                </p>
                <div className="flex flex-wrap gap-4">
                  <Button 
                    size="lg" 
                    variant="secondary" 
                    className="rounded-full px-8 h-12 font-bold shadow-lg shadow-black/5"
                    onClick={() => navigate("/registro-negocio")}
                  >
                    Registrar mi negocio
                  </Button>
                  <Button 
                    size="lg" 
                    variant="outline" 
                    className="rounded-full px-8 h-12 font-bold border-white/30 text-white hover:bg-white/10"
                    onClick={() => navigate("/negocios")}
                  >
                    Saber más
                  </Button>
                </div>
              </div>
              <div className="md:w-1/3 grid grid-cols-2 gap-4">
                <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/20">
                  <Store className="h-8 w-8 mb-4" />
                  <p className="font-bold text-xl">+120</p>
                  <p className="text-sm text-primary-foreground/70">Aliados</p>
                </div>
                <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/20 mt-8">
                  <ArrowRight className="h-8 w-8 mb-4" />
                  <p className="font-bold text-xl">25%</p>
                  <p className="text-sm text-primary-foreground/70">Más ventas</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      <PromoModal />
    </div>
  );
};

export default Index;
