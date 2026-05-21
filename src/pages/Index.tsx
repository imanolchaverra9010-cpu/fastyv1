import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Bike,
  Clock,
  MapPin,
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
  Gamepad2,
  Plus as PlusIcon,
  Compass,
  Laptop as LaptopIcon,
  Wrench,
  Smartphone,
  Sofa,
  Dog,
  Menu
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useCart } from "@/context/CartContext";
import PromoModal from "@/components/PromoModal";
import logo from "@/assets/logo.png";

const Index = () => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { count } = useCart();

  // Cargar banners activos del backend
  const { data: activeBanners } = useQuery<any[]>({
    queryKey: ["activeBanners"],
    queryFn: async () => {
      const response = await fetch("/api/banners/active");
      if (!response.ok) {
        throw new Error("Error fetching banners");
      }
      return response.json();
    },
  });

  // Carrusel sliding indexes
  const [leftIndex, setLeftIndex] = useState(0);
  const [rightTopIndex, setRightTopIndex] = useState(0);
  const [rightBottomIndex, setRightBottomIndex] = useState(0);

  // Auto slide timers
  useEffect(() => {
    const leftBanners = activeBanners?.filter(b => b.slot_position === 'left') || [];
    if (leftBanners.length > 1) {
      const interval = setInterval(() => {
        setLeftIndex((prev) => (prev + 1) % leftBanners.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [activeBanners]);

  useEffect(() => {
    const topBanners = activeBanners?.filter(b => b.slot_position === 'right_top') || [];
    if (topBanners.length > 1) {
      const interval = setInterval(() => {
        setRightTopIndex((prev) => (prev + 1) % topBanners.length);
      }, 6000);
      return () => clearInterval(interval);
    }
  }, [activeBanners]);

  useEffect(() => {
    const bottomBanners = activeBanners?.filter(b => b.slot_position === 'right_bottom') || [];
    if (bottomBanners.length > 1) {
      const interval = setInterval(() => {
        setRightBottomIndex((prev) => (prev + 1) % bottomBanners.length);
      }, 7000);
      return () => clearInterval(interval);
    }
  }, [activeBanners]);

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

  const scroll = (direction: 'left' | 'right') => {
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
      
      {/* 2. Hero Section con Banners Dinámicos */}
      <section className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Banner Principal Izquierdo */}
          {activeBanners?.filter(b => b.slot_position === 'left').length ? (() => {
            const leftBanners = activeBanners.filter(b => b.slot_position === 'left');
            const currentLeft = leftBanners[leftIndex % leftBanners.length];
            return (
              <div 
                key={`left-banner-${currentLeft.id}`}
                className={`lg:col-span-2 relative overflow-hidden rounded-[2rem] ${currentLeft.text_color || "text-white"} min-h-[350px] lg:min-h-[420px] shadow-lg flex flex-col justify-between p-8 md:p-12 group hover:shadow-xl transition-all duration-300 animate-in fade-in duration-500 ${
                  (currentLeft.bg_gradient && !currentLeft.bg_gradient.startsWith('#') && !currentLeft.bg_gradient.startsWith('rgb') && !currentLeft.bg_gradient.startsWith('linear-gradient')) 
                    ? currentLeft.bg_gradient 
                    : !currentLeft.bg_gradient 
                    ? "bg-gradient-to-r from-sky-400 via-sky-300 to-blue-400" 
                    : ""
                }`}
                style={currentLeft.bg_gradient && (currentLeft.bg_gradient.startsWith('#') || currentLeft.bg_gradient.startsWith('rgb') || currentLeft.bg_gradient.startsWith('linear-gradient')) ? { background: currentLeft.bg_gradient } : undefined}
              >
                {currentLeft.image_url && (
                  <div className="absolute top-4 right-4 bottom-4 w-1/2 opacity-95 transition-transform group-hover:scale-105 duration-700 pointer-events-none flex items-center justify-end">
                    <img
                      src={currentLeft.image_url}
                      alt={currentLeft.title}
                      className="h-full w-full object-contain filter drop-shadow-2xl"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "https://placehold.co/400x400/000000/000000?text=";
                      }}
                    />
                  </div>
                )}
                
                <div className="relative z-10 max-w-[55%] flex flex-col justify-between h-full items-start">
                  <div>
                    {currentLeft.tag && (
                      <span className="inline-block bg-white/20 backdrop-blur-md text-inherit text-xs px-3.5 py-1.5 rounded-full font-bold uppercase tracking-wider mb-4 border border-white/10">
                        {currentLeft.tag}
                      </span>
                    )}
                    <h2 className="text-3xl md:text-5xl font-black tracking-tight leading-none mb-3 uppercase drop-shadow-sm">
                      {currentLeft.title}
                    </h2>
                    {currentLeft.subtitle && (
                      <p className="text-base md:text-lg font-medium opacity-90 mb-6 leading-tight">
                        {currentLeft.subtitle}
                      </p>
                    )}
                  </div>
                  
                  {currentLeft.button_text && (
                    <button
                      onClick={() => {
                        if (currentLeft.redirect_url) {
                          navigate(currentLeft.redirect_url);
                        }
                      }}
                      className="bg-[#ffd200] hover:bg-[#ffe34d] text-slate-900 font-extrabold px-8 py-3.5 rounded-2xl transition-all duration-300 shadow-md transform hover:-translate-y-0.5"
                    >
                      {currentLeft.button_text}
                    </button>
                  )}
                </div>

                {leftBanners.length > 1 && (
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-20">
                    {leftBanners.map((_, dotIdx) => (
                      <button
                        key={dotIdx}
                        onClick={(e) => {
                          e.stopPropagation();
                          setLeftIndex(dotIdx);
                        }}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          (leftIndex % leftBanners.length) === dotIdx ? "w-6 bg-white" : "w-2 bg-white/40 hover:bg-white/60"
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })() : (
            <div className="lg:col-span-2 relative overflow-hidden rounded-[2rem] bg-gradient-to-r from-sky-400 via-sky-300 to-blue-400 text-white min-h-[350px] lg:min-h-[420px] shadow-lg flex flex-col justify-between p-8 md:p-12 group hover:shadow-xl transition-all duration-300">
              <div className="absolute top-0 right-0 w-1/2 h-full opacity-90 lg:opacity-100 transition-transform group-hover:scale-105 duration-700 pointer-events-none flex items-center justify-end">
                <img
                  src="https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=800&auto=format&fit=crop&q=80"
                  alt="Teléfono Samsung"
                  className="h-full w-full object-cover object-left rounded-r-[2rem]"
                />
              </div>
              
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
            </div>
          )}

          {/* Columna Derecha con Dos Tarjetas Apiladas */}
          <div className="flex flex-col gap-6">
            
            {/* Tarjeta Superior */}
            {activeBanners?.filter(b => b.slot_position === 'right_top').length ? (() => {
              const topBanners = activeBanners.filter(b => b.slot_position === 'right_top');
              const currentTop = topBanners[rightTopIndex % topBanners.length];
              return (
                <div
                  key={`top-banner-${currentTop.id}`}
                  className={`relative overflow-hidden rounded-[2rem] ${currentTop.text_color || "text-white"} min-h-[190px] lg:min-h-[200px] shadow-md flex flex-col justify-between p-6 group hover:shadow-lg transition-all duration-300 animate-in fade-in duration-500 ${
                    (currentTop.bg_gradient && !currentTop.bg_gradient.startsWith('#') && !currentTop.bg_gradient.startsWith('rgb') && !currentTop.bg_gradient.startsWith('linear-gradient')) 
                      ? currentTop.bg_gradient 
                      : !currentTop.bg_gradient 
                      ? "bg-[#0c0f1d]" 
                      : ""
                  }`}
                  style={currentTop.bg_gradient && (currentTop.bg_gradient.startsWith('#') || currentTop.bg_gradient.startsWith('rgb') || currentTop.bg_gradient.startsWith('linear-gradient')) ? { background: currentTop.bg_gradient } : undefined}
                >
                  {currentTop.image_url && (
                    <div className="absolute top-2 right-2 bottom-2 w-[40%] opacity-90 pointer-events-none flex items-center justify-end">
                      <img
                        src={currentTop.image_url}
                        alt={currentTop.title}
                        className="max-h-full max-w-full object-contain filter drop-shadow-2xl"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "https://placehold.co/200x200/000000/000000?text=";
                        }}
                      />
                    </div>
                  )}

                  <div className="relative z-10 flex flex-col justify-between h-full items-start max-w-[60%]">
                    <div>
                      {currentTop.tag && (
                        <span className="text-[10px] text-cyan-400 font-black tracking-widest uppercase">
                          {currentTop.tag}
                        </span>
                      )}
                      <h3 className="text-base md:text-lg font-bold tracking-tight mt-1 leading-tight">
                        {currentTop.title}
                      </h3>
                      {currentTop.subtitle && (
                        <p className="text-[11px] opacity-80 mt-1 line-clamp-2 leading-tight">
                          {currentTop.subtitle}
                        </p>
                      )}
                    </div>
                    {currentTop.button_text && (
                      <button
                        onClick={() => {
                          if (currentTop.redirect_url) {
                            navigate(currentTop.redirect_url);
                          }
                        }}
                        className="bg-[#ffd200] hover:bg-[#ffe34d] text-slate-900 font-black text-[10px] px-4 py-2 rounded-xl transition-all duration-300 shadow-sm mt-3"
                      >
                        {currentTop.button_text}
                      </button>
                    )}
                  </div>

                  {topBanners.length > 1 && (
                    <div className="absolute bottom-3 left-6 flex gap-1 z-20">
                      {topBanners.map((_, dotIdx) => (
                        <button
                          key={dotIdx}
                          onClick={(e) => {
                            e.stopPropagation();
                            setRightTopIndex(dotIdx);
                          }}
                          className={`h-1 rounded-full transition-all duration-300 ${
                            (rightTopIndex % topBanners.length) === dotIdx ? "w-4 bg-white" : "w-1.5 bg-white/40 hover:bg-white/60"
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })() : (
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
            )}

            {/* Tarjeta Inferior */}
            {activeBanners?.filter(b => b.slot_position === 'right_bottom').length ? (() => {
              const bottomBanners = activeBanners.filter(b => b.slot_position === 'right_bottom');
              const currentBottom = bottomBanners[rightBottomIndex % bottomBanners.length];
              return (
                <div
                  key={`bottom-banner-${currentBottom.id}`}
                  className={`relative overflow-hidden rounded-[2rem] ${currentBottom.text_color || "text-slate-800"} min-h-[190px] lg:min-h-[200px] shadow-md flex flex-col justify-between p-6 group hover:shadow-lg transition-all duration-300 animate-in fade-in duration-500 ${
                    (currentBottom.bg_gradient && !currentBottom.bg_gradient.startsWith('#') && !currentBottom.bg_gradient.startsWith('rgb') && !currentBottom.bg_gradient.startsWith('linear-gradient')) 
                      ? currentBottom.bg_gradient 
                      : !currentBottom.bg_gradient 
                      ? "bg-gradient-to-br from-[#fcfaf7] to-[#f3ebd9]" 
                      : ""
                  }`}
                  style={currentBottom.bg_gradient && (currentBottom.bg_gradient.startsWith('#') || currentBottom.bg_gradient.startsWith('rgb') || currentBottom.bg_gradient.startsWith('linear-gradient')) ? { background: currentBottom.bg_gradient } : undefined}
                >
                  {currentBottom.image_url && (
                    <div className="absolute top-2 right-2 bottom-2 w-[40%] opacity-90 pointer-events-none flex items-center justify-end">
                      <img
                        src={currentBottom.image_url}
                        alt={currentBottom.title}
                        className="max-h-full max-w-full object-contain filter drop-shadow-2xl"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "https://placehold.co/200x200/000000/000000?text=";
                        }}
                      />
                    </div>
                  )}

                  <div className="relative z-10 flex flex-col justify-between h-full items-start max-w-[60%]">
                    <div>
                      {currentBottom.tag && (
                        <span className="text-[10px] text-primary font-black tracking-widest uppercase">
                          {currentBottom.tag}
                        </span>
                      )}
                      <h3 className="text-base md:text-lg font-bold tracking-tight mt-1 leading-tight">
                        {currentBottom.title}
                      </h3>
                      {currentBottom.subtitle && (
                        <p className="text-[11px] opacity-80 mt-1 line-clamp-2 leading-tight">
                          {currentBottom.subtitle}
                        </p>
                      )}
                    </div>
                    {currentBottom.button_text && (
                      <button
                        onClick={() => {
                          if (currentBottom.redirect_url) {
                            navigate(currentBottom.redirect_url);
                          }
                        }}
                        className="bg-[#ffd200] hover:bg-[#ffe34d] text-slate-900 font-bold text-[10px] px-5 py-2 rounded-xl transition-all duration-300 shadow-sm mt-3"
                      >
                        {currentBottom.button_text}
                      </button>
                    )}
                  </div>

                  {bottomBanners.length > 1 && (
                    <div className="absolute bottom-3 left-6 flex gap-1 z-20">
                      {bottomBanners.map((_, dotIdx) => (
                        <button
                          key={dotIdx}
                          onClick={(e) => {
                            e.stopPropagation();
                            setRightBottomIndex(dotIdx);
                          }}
                          className={`h-1 rounded-full transition-all duration-300 ${
                            (rightBottomIndex % bottomBanners.length) === dotIdx ? "w-4 bg-slate-800" : "w-1.5 bg-slate-800/40 hover:bg-slate-800/60"
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })() : (
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
                    <span className="text-[10px] text-primary font-black tracking-widest uppercase">
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
            )}

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
                  <span className="text-xs md:text-sm font-bold text-slate-700 group-hover:text-primary transition-colors text-center w-20 line-clamp-2 leading-tight">
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
            <p className="text-sm text-slate-500 mt-1">Los favoritos de nuestra comunidad en Fasty</p>
          </div>
          
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full px-6 font-bold shadow-sm hidden md:flex border-slate-200 text-slate-700 hover:bg-slate-50 group transition-all"
              onClick={() => navigate('/negocios')}
            >
              Ver todos <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform text-primary" />
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
                  <div className="relative h-32 w-32 md:h-40 md:w-40 rounded-full bg-white border-2 border-slate-100 shadow-sm flex items-center justify-center group-hover:shadow-md group-hover:border-primary group-hover:scale-105 transition-all p-2 overflow-hidden">
                    {b.image_url ? (
                      <img
                        src={b.image_url.startsWith("http") ? b.image_url : `/api/media${b.image_url}`}
                        alt={b.name}
                        className="h-full w-full object-cover rounded-full"
                      />
                    ) : (
                      <div className="h-full w-full bg-gradient-hero flex items-center justify-center text-white rounded-full">
                        <Store className="h-16 w-16" />
                      </div>
                    )}
                    
                    <div className="absolute top-2 right-2 h-9 w-9 rounded-full bg-white border border-slate-100 shadow flex items-center justify-center text-xs font-bold gap-0.5 z-10">
                      <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                      <span className="text-slate-800">{b.rating}</span>
                    </div>
                  </div>
                  
                  <h3 className="font-bold text-center text-sm md:text-base text-slate-700 group-hover:text-primary transition-colors truncate w-full px-2">
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
        <div className="bg-gradient-hero rounded-[2.5rem] p-8 md:p-12 text-white relative overflow-hidden shadow-glow">
          <div className="relative z-10 grid lg:grid-cols-2 gap-8 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-6 border border-white/10">
                <Sparkles className="h-4 w-4" /> ¿No está en Fasty?
              </div>
              
              <h2 className="text-3xl md:text-5xl font-display font-black leading-tight mb-4">
                ¿No encuentras lo que buscas?
              </h2>
              
              <p className="text-base text-white/95 mb-8 leading-relaxed max-w-lg">
                Si la tienda no está en nuestra plataforma, ¡no te preocupes! Dinos qué necesitas y de dónde, y nosotros lo compramos por ti.
              </p>
              
              <Button
                size="lg"
                className="bg-white text-primary hover:bg-white/95 px-8 py-4 rounded-xl text-md font-bold shadow-md hover:shadow-lg transition-all group"
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
      <footer className="bg-slate-900 py-12 text-white border-t border-slate-800 transition-colors duration-300">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex flex-col items-center md:items-start gap-2">
              <Link to="/" className="flex items-center gap-2 group shrink-0 mb-1">
                <img src={logo} alt="Fasty Logo" className="h-9 w-auto transition-transform group-hover:scale-105" />
              </Link>
              <p className="text-slate-400 text-sm">Tu ciudad a un clic de distancia.</p>
            </div>
            
            <div className="flex gap-8 text-sm font-semibold">
              <Link to="/negocios" className="hover:text-primary transition-colors">Negocios</Link>
              <Link to="/domiciliario" className="hover:text-primary transition-colors">Domiciliarios</Link>
              <Link to="/admin" className="hover:text-primary transition-colors">Administración</Link>
            </div>
          </div>
          
          <div className="mt-12 pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <p>© {new Date().getFullYear()} Fasty · Todos los derechos reservados.</p>
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