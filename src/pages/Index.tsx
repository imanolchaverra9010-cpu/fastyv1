import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Bike,
  Clock,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Percent,
  Tag,
  Gift,
  TrendingUp,
  Plus,
  ShoppingCart,
  Heart,
  User,
  Gamepad2,
  Laptop as LaptopIcon,
  Wrench,
  Smartphone,
  Sofa,
  Dog,
  Menu
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import SearchInput from "@/components/SearchInput";
import { useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useCart } from "@/context/CartContext";
import PromoModal from "@/components/PromoModal";
import { useAuth } from "@/context/AuthContext";

const Index = () => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { cart, clearCart } = useCart();
  const [searchVal, setSearchVal] = useState("");

  // Cargar negocios destacados del backend
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
      toast({
        title: "Error",
        description: "No se pudieron cargar los negocios destacados.",
        variant: "destructive"
      });
    }
  }, [errorBusinesses]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchVal.trim()) {
      navigate(`/negocios?search=${encodeURIComponent(searchVal.trim())}`);
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollTo = direction === 'left' ? scrollLeft - clientWidth : scrollLeft + clientWidth;
      scrollRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  // Categorías basadas en la captura de pantalla del usuario
  const customCategories = [
    { name: "Mascotas", label: "Mascotas", path: "/negocios?category=Mascotas", icon: Dog, bgColor: "bg-[#ffebe0]", iconColor: "text-[#e25c3d]" },
    { name: "Belleza", label: "Cuidado Personal y Belleza", path: "/negocios?category=Belleza", icon: Sparkles, bgColor: "bg-[#fff0f5]", iconColor: "text-[#db2777]" },
    { name: "Gaming", label: "Gaming", path: "/negocios?category=Tecnología", icon: Gamepad2, bgColor: "bg-[#eef2ff]", iconColor: "text-[#4f46e5]" },
    { name: "Laptop", label: "Laptop", path: "/negocios?category=Tecnología", icon: LaptopIcon, bgColor: "bg-[#ecfeff]", iconColor: "text-[#0891b2]" },
    { name: "Herramientas", label: "Herramientas", path: "/negocios?category=Mantenimiento", icon: Wrench, bgColor: "bg-[#f0fdf4]", iconColor: "text-[#16a34a]" },
    { name: "Telefonos", label: "Telefonos", path: "/negocios?category=Tecnología", icon: Smartphone, bgColor: "bg-[#fdf4ff]", iconColor: "text-[#c084fc]" },
    { name: "Muebles", label: "Muebles", path: "/negocios?category=Hogar", icon: Sofa, bgColor: "bg-[#fffbeb]", iconColor: "text-[#d97706]" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      
      {/* 1. Header Premium estilo Teal como el de KEMI en la captura */}
      <header className="bg-[#0d8496] text-white shadow-md sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-20 gap-4">
            
            {/* Logo */}
            <div className="flex items-center gap-2">
              <Link to="/" className="text-3xl font-display font-black tracking-wider text-white hover:opacity-90 transition-opacity">
                KEMI
              </Link>
            </div>

            {/* Barra de Búsqueda central */}
            <div className="flex-1 max-w-2xl hidden md:block">
              <form onSubmit={handleSearchSubmit} className="relative w-full">
                <input
                  type="text"
                  placeholder="Buscar productos..."
                  value={searchVal}
                  onChange={(e) => setSearchVal(e.target.value)}
                  className="w-full px-5 py-3 pr-12 rounded-full bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-300 shadow-inner transition-all placeholder:text-slate-400"
                />
                <button type="submit" className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#0d8496] transition-colors">
                  <Search className="h-5 w-5" />
                </button>
              </form>
            </div>

            {/* Iconos de la derecha */}
            <div className="flex items-center gap-6">
              <Link to="/negocios" className="hover:text-cyan-150 transition-colors hidden sm:block font-semibold text-sm">
                Explorar
              </Link>
              <button onClick={() => navigate('/perfil')} className="hover:scale-105 transition-transform" title="Favoritos">
                <Heart className="h-6 w-6 text-white hover:text-red-200 transition-colors" />
              </button>
              
              <div className="relative">
                {user ? (
                  <button 
                    onClick={() => navigate(user.role === 'customer' ? '/perfil' : '/admin')} 
                    className="flex items-center gap-2 bg-[#0b7282] hover:bg-[#095f6d] px-4 py-2 rounded-full border border-cyan-400/20 transition-all"
                  >
                    <User className="h-4 w-4" />
                    <span className="text-sm font-bold max-w-[100px] truncate">{user.username}</span>
                  </button>
                ) : (
                  <Link to="/login" className="hover:scale-105 transition-transform" title="Mi Cuenta">
                    <User className="h-6 w-6 text-white" />
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Sub-Header Row */}
          <div className="border-t border-cyan-400/20 py-2.5 flex items-center justify-between text-xs sm:text-sm font-medium">
            <div className="flex items-center gap-2 text-cyan-50">
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>+300 Clientes satisfechos</span>
            </div>
            <div className="flex items-center gap-6">
              <Link to="/admin" className="text-white hover:text-cyan-100 transition-colors hover:underline">
                Admin
              </Link>
              <Link to="/negocios/registro" className="text-white hover:text-cyan-100 transition-colors hover:underline">
                Vender
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Sección de Búsqueda para Móviles */}
      <div className="container mx-auto px-4 py-4 md:hidden">
        <form onSubmit={handleSearchSubmit} className="relative w-full">
          <input
            type="text"
            placeholder="Buscar productos..."
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            className="w-full px-5 py-3 pr-12 rounded-2xl bg-white border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0d8496] shadow-sm transition-all"
          />
          <button type="submit" className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
            <Search className="h-5 w-5" />
          </button>
        </form>
      </div>

      {/* 3. Hero/Banners Grid al estilo de la captura */}
      <section className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Banner Principal Izquierdo (Samsung) */}
          <div className="lg:col-span-2 relative overflow-hidden rounded-[2rem] bg-gradient-to-r from-sky-400 via-sky-300 to-blue-400 text-white min-h-[350px] lg:min-h-[420px] shadow-lg flex flex-col justify-between p-8 md:p-12 group hover:shadow-xl transition-all duration-300">
            <div className="absolute top-0 right-0 w-1/2 h-full opacity-90 lg:opacity-100 transition-transform group-hover:scale-105 duration-700 pointer-events-none flex items-center justify-end">
              <img
                src="https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=800&auto=format&fit=crop&q=80"
                alt="Teléfono Samsung"
                className="h-full w-full object-cover object-left rounded-r-[2rem]"
              />
            </div>
            
            {/* Contenido Izquierdo */}
            <div className="relative z-10 max-w-[60%] flex flex-col justify-between h-full items-start">
              <div>
                <span className="inline-block bg-white/25 backdrop-blur-md text-white text-xs px-3.5 py-1.5 rounded-full font-bold uppercase tracking-wider mb-4 border border-white/20">
                  Samsung Premium
                </span>
                <h2 className="text-4xl md:text-6xl font-black tracking-tight leading-none mb-3 text-white drop-shadow-sm font-sans uppercase">
                  OFERTA DE <br />VERANO
                </h2>
                <p className="text-lg md:text-xl font-medium text-sky-50 opacity-95 mb-6">
                  Teléfono Samsung
                </p>
              </div>
              
              <button
                onClick={() => navigate('/negocios?search=samsung')}
                className="bg-[#ffd200] hover:bg-[#ffe34d] text-slate-900 font-extrabold px-8 py-3.5 rounded-2xl transition-all duration-300 shadow-md transform hover:-translate-y-0.5"
              >
                Clic aquí
              </button>
            </div>

            {/* Dots de Carrusel Estéticos */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
              <span className="w-6 h-1.5 rounded-full bg-white"></span>
              <span className="w-2 h-1.5 rounded-full bg-white/40"></span>
              <span className="w-2 h-1.5 rounded-full bg-white/40"></span>
              <span className="w-2 h-1.5 rounded-full bg-white/40"></span>
            </div>
          </div>

          {/* Columna Derecha con Dos Tarjetas Apiladas */}
          <div className="flex flex-col gap-6">
            
            {/* Tarjeta Superior (Gaming Oferta de Verano) */}
            <div className="relative overflow-hidden rounded-[2rem] bg-[#0c0f1d] border border-blue-500/20 text-white min-h-[190px] lg:min-h-[200px] shadow-md flex flex-col justify-between p-6 group hover:shadow-lg transition-all duration-300">
              <div className="absolute top-0 right-0 w-2/5 h-full opacity-80 pointer-events-none">
                <img
                  src="https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&auto=format&fit=crop&q=80"
                  alt="Gaming headset"
                  className="h-full w-full object-cover object-center rounded-r-[2rem]"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-[#0c0f1d] via-transparent to-transparent"></div>
              </div>

              <div className="relative z-10 flex flex-col justify-between h-full items-start max-w-[65%]">
                <div>
                  <span className="text-[10px] text-cyan-400 font-black tracking-widest uppercase">
                    OFERTA DE VERANO
                  </span>
                  <h3 className="text-lg md:text-xl font-bold tracking-tight text-white mt-1 leading-tight">
                    Domina la arena, diseños exclusivos para este verano
                  </h3>
                </div>
                <button
                  onClick={() => navigate('/negocios?search=gaming')}
                  className="bg-[#ffd200] hover:bg-[#ffe34d] text-slate-900 font-black text-xs px-5 py-2.5 rounded-xl transition-all duration-300 shadow-sm mt-3"
                >
                  Comprar Ahora
                </button>
              </div>
            </div>

            {/* Tarjeta Inferior (Muebles de Diseño) */}
            <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#fcfaf7] to-[#f3ebd9] border border-amber-200/20 text-slate-800 min-h-[190px] lg:min-h-[200px] shadow-md flex flex-col justify-between p-6 group hover:shadow-lg transition-all duration-300">
              <div className="absolute top-0 right-0 w-2/5 h-full opacity-90 pointer-events-none">
                <img
                  src="https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&auto=format&fit=crop&q=80"
                  alt="Muebles premium"
                  className="h-full w-full object-cover object-center rounded-r-[2rem]"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-[#fcfaf7] via-transparent to-transparent"></div>
              </div>

              <div className="relative z-10 flex flex-col justify-between h-full items-start max-w-[65%]">
                <div>
                  <span className="text-[10px] text-[#0d8496] font-black tracking-widest uppercase">
                    Confort que Enamora
                  </span>
                  <h3 className="text-lg md:text-xl font-bold tracking-tight text-slate-800 mt-1 leading-tight">
                    Tu Sala, Tu Estilo
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                    Muebles de Diseño para el Hogar. Comodidad Superior.
                  </p>
                </div>
                <button
                  onClick={() => navigate('/negocios?category=Hogar')}
                  className="bg-[#ffd200] hover:bg-[#ffe34d] text-slate-900 font-bold text-xs px-5 py-2.5 rounded-xl transition-all duration-300 shadow-sm mt-3"
                >
                  Ver Oferta
                </button>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 4. Categorías Circulares Estilo Botón como en la Captura */}
      <section className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
          <div className="flex gap-6 md:gap-8 overflow-x-auto pb-2 no-scrollbar justify-start md:justify-around snap-x snap-mandatory">
            {customCategories.map((cat, i) => {
              const IconComp = cat.icon;
              return (
                <Link
                  key={cat.name}
                  to={cat.path}
                  className="flex flex-col items-center gap-3 snap-start group shrink-0"
                >
                  {/* Círculo de Categoría con fondo pastel y animación suave */}
                  <div className={`h-20 w-20 rounded-full ${cat.bgColor} flex items-center justify-center shadow-sm group-hover:scale-110 group-hover:shadow-md transition-all duration-300`}>
                    <IconComp className={`h-9 w-9 ${cat.iconColor} transition-transform group-hover:rotate-6 duration-300`} />
                  </div>
                  <span className="text-xs md:text-sm font-bold text-slate-700 group-hover:text-[#0d8496] transition-colors text-center w-20 line-clamp-2 leading-tight">
                    {cat.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Informative Banner / Note */}
      <div className="container mx-auto px-4 mb-6">
        <div className="bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-100 rounded-2xl p-4 text-sm text-teal-800 flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-teal-600 animate-pulse shrink-0" />
          <span>
            <strong>Diseño Fasty V2:</strong> Para alternar entre este diseño y el tradicional, simplemente renombra este archivo a <code>index.tsx</code> en la carpeta <code>src/pages</code> o edita el import principal en <code>src/App.tsx</code>.
          </span>
        </div>
      </div>

      {/* 5. Negocios Calificados (Dinámicos del Backend) */}
      <section className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-display font-black tracking-tight text-slate-800">
              Negocios Recomendados
            </h2>
            <p className="text-sm text-slate-500 mt-1">Los favoritos de nuestra comunidad en KEMI</p>
          </div>
          
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full px-6 font-bold shadow-sm hidden md:flex border-slate-200 text-slate-700 hover:bg-slate-50 group transition-all"
              onClick={() => navigate('/negocios')}
            >
              Ver todos <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform text-[#0d8496]" />
            </Button>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                className="rounded-full h-10 w-10 shadow-sm border-slate-200 bg-white"
                onClick={() => scroll('left')}
              >
                <ChevronLeft className="h-5 w-5 text-slate-600" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="rounded-full h-10 w-10 shadow-sm border-slate-200 bg-white"
                onClick={() => scroll('right')}
              >
                <ChevronRight className="h-5 w-5 text-slate-600" />
              </Button>
            </div>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex gap-6 overflow-x-auto pb-6 no-scrollbar snap-x snap-mandatory"
        >
          {isLoadingBusinesses ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-4 animate-pulse min-w-[160px] md:min-w-[200px]">
                <div className="h-32 w-32 md:h-40 md:w-40 rounded-full bg-slate-200 border border-slate-100 shadow-sm" />
                <div className="h-4 w-24 bg-slate-200 rounded-full" />
              </div>
            ))
          ) : businesses && businesses.length > 0 ? (
            <>
              {businesses.map((b) => (
                <Link
                  key={b.id}
                  to={`/negocios/${b.id}`}
                  className="flex flex-col items-center gap-4 group transition-all snap-start min-w-[160px] md:min-w-[200px] pt-2"
                >
                  <div className="relative h-32 w-32 md:h-40 md:w-40 rounded-full bg-white border-2 border-slate-100 shadow-sm flex items-center justify-center group-hover:shadow-md group-hover:border-[#0d8496] group-hover:scale-105 transition-all p-2 overflow-hidden">
                    {b.image_url ? (
                      <img
                        src={b.image_url.startsWith("http") ? b.image_url : `/api/media${b.image_url}`}
                        alt={b.name}
                        className="h-full w-full object-cover rounded-full"
                      />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-tr from-[#0d8496] to-cyan-400 flex items-center justify-center text-white rounded-full">
                        <Store className="h-16 w-16" />
                      </div>
                    )}
                    
                    <div className="absolute top-2 right-2 h-9 w-9 rounded-full bg-white border border-slate-100 shadow flex items-center justify-center text-xs font-bold gap-0.5 z-10">
                      <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                      <span className="text-slate-800">{b.rating}</span>
                    </div>
                  </div>
                  
                  <h3 className="font-bold text-center text-sm md:text-base text-slate-700 group-hover:text-[#0d8496] transition-colors truncate w-full px-2">
                    {b.name}
                  </h3>
                </Link>
              ))}
              
              <button
                onClick={() => navigate('/negocios')}
                className="flex flex-col items-center justify-center gap-4 group transition-all snap-start min-w-[160px] md:min-w-[200px] pt-2 md:hidden"
              >
                <div className="h-32 w-32 md:h-40 md:w-40 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center group-hover:bg-slate-200/50 transition-all text-slate-500">
                  <Plus className="h-8 w-8 mb-1" />
                  <span className="text-xs font-bold">Ver todos</span>
                </div>
                <h3 className="font-bold text-center text-sm">Más negocios</h3>
              </button>
            </>
          ) : (
            <div className="w-full py-16 text-center bg-white rounded-3xl border border-slate-100">
              <p className="text-slate-500 font-medium">No se encontraron negocios activos.</p>
            </div>
          )}
        </div>

        {/* Botón central para móvil */}
        <div className="mt-4 md:hidden">
          <Button
            variant="outline"
            size="lg"
            className="w-full rounded-2xl font-bold border-slate-200 text-slate-700 bg-white"
            onClick={() => navigate('/negocios')}
          >
            Ver todos los negocios
          </Button>
        </div>
      </section>

      {/* 6. Pedido Abierto CTA */}
      <section className="container mx-auto px-4 py-10">
        <div className="bg-gradient-to-r from-[#0d8496] to-cyan-500 rounded-[2.5rem] p-8 md:p-12 text-white relative overflow-hidden shadow-md">
          <div className="relative z-10 grid lg:grid-cols-2 gap-8 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-6 border border-white/10">
                <Sparkles className="h-4 w-4" /> ¿No está en Fasty?
              </div>
              
              <h2 className="text-3xl md:text-5xl font-display font-black leading-tight mb-4">
                ¿No encuentras lo que buscas?
              </h2>
              
              <p className="text-base text-cyan-50 mb-8 leading-relaxed max-w-lg">
                Si la tienda no está en nuestra plataforma, ¡no te preocupes! Dinos qué necesitas y de dónde, y nosotros lo compramos por ti.
              </p>
              
              <Button
                size="lg"
                className="bg-white text-[#0d8496] hover:bg-cyan-50 px-8 py-4 rounded-xl text-md font-bold shadow-md hover:shadow-lg transition-all group"
                onClick={() => navigate('/pedido-abierto')}
              >
                Hacer Pedido Abierto <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>

            <div className="hidden lg:flex justify-end pr-8">
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-[2rem] p-6 shadow-xl w-80 rotate-2 hover:rotate-0 transition-transform duration-500">
                <div className="flex items-center gap-4 mb-6">
                  <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
                    <ShoppingCart className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="h-3 w-28 bg-white/20 rounded-full mb-2" />
                    <div className="h-2 w-16 bg-white/10 rounded-full" />
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="h-3 w-full bg-white/20 rounded-full" />
                  <div className="h-3 w-full bg-white/20 rounded-full" />
                  <div className="h-3 w-[60%] bg-white/10 rounded-full" />
                </div>
              </div>
            </div>
          </div>

          {/* Elementos decorativos */}
          <div className="absolute -top-20 -left-20 w-80 h-80 bg-white/10 rounded-full blur-[80px]" />
          <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-black/10 rounded-full blur-[80px]" />
        </div>
      </section>

      {/* Footer Fasty/KEMI */}
      <footer className="bg-[#0b7282] py-12 text-white border-t border-cyan-800">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex flex-col items-center md:items-start gap-2">
              <p className="font-display font-black text-3xl tracking-wider text-white">
                KEMI<span className="text-cyan-300">.</span>
              </p>
              <p className="text-cyan-100 text-sm">Tu ciudad a un clic de distancia.</p>
            </div>
            
            <div className="flex gap-8 text-sm font-semibold">
              <Link to="/negocios" className="hover:text-cyan-200 transition-colors">Negocios</Link>
              <Link to="/domiciliario" className="hover:text-cyan-200 transition-colors">Domiciliarios</Link>
              <Link to="/admin" className="hover:text-cyan-200 transition-colors">Administración</Link>
            </div>
          </div>
          
          <div className="mt-12 pt-8 border-t border-cyan-700/50 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-cyan-200/70">
            <p>© {new Date().getFullYear()} KEMI & Fasty · Todos los derechos reservados.</p>
            <p>Hecho con 🩵 para tu confort y rapidez.</p>
          </div>
        </div>
      </footer>

      {/* Modal promocional */}
      <PromoModal />
    </div>
  );
};

export default Index;