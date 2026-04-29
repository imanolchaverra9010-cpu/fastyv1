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
        <div className="absolute top-40 -left-32 h-[400px] w-[400px] rounded-full bg-accent/15 blur-3xl" aria-hidden />

        <div className="container relative grid lg:grid-cols-2 gap-12 items-center py-16 lg:py-24">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
              <Sparkles className="h-3.5 w-3.5" /> Plataforma todo-en-uno
            </span>
            <h1 className="mt-5 text-5xl lg:text-7xl font-display font-bold tracking-tight text-balance leading-[1.05]">
              Domicilios en un click.
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl text-balance">
              Conectamos negocios, domiciliarios y clientes en una sola plataforma. Pedidos en tiempo real, menús dinámicos y un panel pensado para que todo fluya.
            </p>

            <div className="mt-10">
              <SearchInput />
            </div>

            <div className="mt-10 flex items-center gap-8 text-sm">
              <div>
                <p className="text-2xl font-display font-bold">+1.2k</p>
                <p className="text-muted-foreground">Negocios</p>
              </div>
              <div className="h-8 w-px bg-border" />
              <div>
                <p className="text-2xl font-display font-bold">25 min</p>
                <p className="text-muted-foreground">Entrega prom.</p>
              </div>
              <div className="h-8 w-px bg-border" />
              <div>
                <p className="text-2xl font-display font-bold">4.9★</p>
                <p className="text-muted-foreground">Calificación</p>
              </div>
            </div>
          </div>

          <div className="relative animate-fade-up" style={{ animationDelay: "150ms" }}>
            <div className="relative rounded-[2rem] overflow-hidden shadow-glow border border-border/40">
              <video
                src="/PixVerse_V6_Image_Text_360P_al_final_quiero_qu.mp4"
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-auto object-cover"
              />
            </div>

            <div className="absolute -bottom-6 -left-6 bg-card rounded-2xl shadow-card p-4 border border-border/60 animate-float">
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
      <section className="container py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-display font-bold tracking-tight">¿Qué se te antoja hoy?</h2>
            <p className="text-sm text-muted-foreground mt-1">Explora las categorías más populares</p>
          </div>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar -mx-4 px-4 md:mx-0 md:px-0 md:grid md:grid-cols-4 lg:grid-cols-6">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.name}
              to={`/negocios?category=${cat.name}`}
              className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-card border border-border/60 shadow-sm hover:shadow-glow hover:-translate-y-1 transition-all min-w-[100px] group"
            >
              <div className="h-16 w-16 rounded-2xl bg-gradient-warm grid place-items-center text-4xl group-hover:scale-110 transition-transform">
                {cat.emoji}
              </div>
              <span className="text-sm font-bold text-center">{cat.name}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured businesses */}
      <section className="container py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-display font-bold tracking-tight">Mejor calificados</h2>
            <p className="text-sm text-muted-foreground mt-1">Los favoritos de la comunidad</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              className="rounded-full h-10 w-10 shadow-sm"
              onClick={() => scroll('left')}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="rounded-full h-10 w-10 shadow-sm"
              onClick={() => scroll('right')}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex gap-8 overflow-x-auto pb-8 no-scrollbar snap-x snap-mandatory"
        >
          {isLoadingBusinesses ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-4 animate-pulse min-w-[150px] md:min-w-[200px]">
                <div className="h-32 w-32 md:h-40 md:w-40 rounded-full bg-card border border-border/60 shadow-sm" />
                <div className="h-4 w-24 bg-card rounded-full" />
              </div>
            ))
          ) : businesses && businesses.length > 0 ? (
            businesses.map((b) => (
              <Link
                key={b.id}
                to={`/negocios/${b.id}`}
                className="flex flex-col items-center gap-4 group transition-all snap-start min-w-[150px] md:min-w-[200px] pt-4"
              >
                <div className="relative h-32 w-32 md:h-40 md:w-40 rounded-full bg-white border-2 border-border/40 shadow-card flex items-center justify-center group-hover:shadow-glow group-hover:border-primary group-hover:scale-105 transition-all p-2">
                  {b.image_url ? (
                    <img src={b.image_url.startsWith("http") ? b.image_url : `/api/media${b.image_url}`} alt={b.name} className="h-full w-full object-cover rounded-full" />
                  ) : (
                    <div className="h-full w-full bg-gradient-hero flex items-center justify-center text-white rounded-full">
                      <Store className="h-16 w-16" />
                    </div>
                  )}
                  {/* Calificación en la parte superior derecha, sobresaliendo */}
                  <div className="absolute -top-2 -right-2 h-11 w-11 rounded-full bg-white border-2 border-primary/20 shadow-glow flex items-center justify-center text-xs font-bold gap-0.5 z-10 animate-float">
                    <Star className="h-3.5 w-3.5 text-warning fill-warning" />
                    <span className="text-foreground">{b.rating}</span>
                  </div>
                </div>
                <h3 className="font-display font-bold text-center text-lg group-hover:text-primary transition-colors truncate w-full px-2">{b.name}</h3>
              </Link>
            ))
          ) : (
            <div className="w-full py-20 text-center">
              <p className="text-muted-foreground">No se encontraron negocios destacados.</p>
            </div>
          )}
        </div>
      </section>

      {/* Open Order CTA */}
      <section className="container py-16">
        <div className="bg-gradient-hero rounded-[3rem] p-8 md:p-16 text-white relative overflow-hidden shadow-glow">
          <div className="relative z-10 grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider mb-6 border border-white/20">
                <Sparkles className="h-4 w-4" /> Nuevo Servicio
              </div>
              <h2 className="text-4xl md:text-6xl font-display font-bold leading-tight mb-6">
                ¿No encuentras lo que buscas?
              </h2>
              <p className="text-lg md:text-xl text-white/90 mb-10 leading-relaxed max-w-xl">
                Si la tienda no está en nuestra plataforma, ¡no te preocupes! Dinos qué necesitas y de dónde, y nosotros lo compramos por ti.
              </p>
              <Button
                size="xl"
                variant="hero"
                className="bg-white text-primary hover:bg-white/90 h-16 px-10 rounded-2xl text-lg font-bold shadow-xl shadow-black/10 group"
                onClick={() => navigate('/pedido-abierto')}
              >
                Hacer Pedido Abierto <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
            <div className="hidden lg:flex justify-center relative">
              <div className="absolute inset-0 bg-white/10 rounded-full blur-3xl animate-pulse" />
              <div className="relative bg-white/10 backdrop-blur-xl border border-white/20 rounded-[2.5rem] p-8 shadow-2xl rotate-3 hover:rotate-0 transition-transform duration-700">
                <div className="flex items-center gap-4 mb-8">
                  <div className="h-14 w-14 rounded-2xl bg-white/20 flex items-center justify-center">
                    <ShoppingCart className="h-8 w-8" />
                  </div>
                  <div>
                    <div className="h-3 w-32 bg-white/20 rounded-full mb-2" />
                    <div className="h-3 w-20 bg-white/10 rounded-full" />
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="h-4 w-full bg-white/20 rounded-lg" />
                  <div className="h-4 w-full bg-white/20 rounded-lg" />
                  <div className="h-4 w-[60%] bg-white/10 rounded-lg" />
                </div>
              </div>
            </div>
          </div>

          {/* Decorative Elements */}
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-white/10 rounded-full blur-[100px]" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-black/10 rounded-full blur-[100px]" />
        </div>
      </section>

      <footer className="bg-orange-500 py-12 text-white">
        <div className="container">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex flex-col items-center md:items-start gap-2">
              <p className="font-display font-bold text-2xl tracking-tight">Fasty<span className="text-white/80">.</span></p>
              <p className="text-orange-50/90 text-sm">Tu ciudad a un clic de distancia.</p>
            </div>
            <div className="flex gap-8 text-sm font-medium">
              <Link to="/negocios" className="hover:text-white/80 transition-colors">Negocios</Link>
              <Link to="/domiciliario" className="hover:text-white/80 transition-colors">Domiciliarios</Link>
              <Link to="/admin" className="hover:text-white/80 transition-colors">Administración</Link>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-orange-100/60">
            <p>© {new Date().getFullYear()} Fasty · Todos los derechos reservados.</p>
            <p>Hecho con 🧡 para barrios hambrientos.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;