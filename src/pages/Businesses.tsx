import { Link, useSearchParams } from "react-router-dom";
import { Clock, Plus, Star, Loader2, Store, Filter, Heart, MapPin } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import SearchInput from "@/components/SearchInput";
import { CATEGORIES } from "@/constants/categories";
import { useAuth } from "@/context/AuthContext";
import { cachedFetch, CACHE_TTL } from "@/lib/clientCache";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Businesses = () => {
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryFilter = searchParams.get("category");
  const queryFilter = searchParams.get("q");
  const [openFilter, setOpenFilter] = useState<"all" | "open" | "closed">("all");
  const [distanceFilter, setDistanceFilter] = useState<"all" | "near">("all");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("fasty_favorite_businesses") || "[]");
    } catch {
      return [];
    }
  });

  useEffect(() => {
    setLoading(true);
    const url = new URL("/api/businesses", window.location.origin);
    url.searchParams.append("status_filter", "active");
    if (categoryFilter) {
      url.searchParams.append("category", categoryFilter);
    }
    if (queryFilter) {
      url.searchParams.append("q", queryFilter);
    }

    cachedFetch<any[]>(url.toString(), { ttlMs: CACHE_TTL.businesses, persist: true })
      .then((data) => {
        setBusinesses(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Businesses fetch error:", err);
        setBusinesses([]);
        setLoading(false);
      });
  }, [categoryFilter, queryFilter]);

  useEffect(() => {
    if (!user) return;
    fetch("/api/businesses/favorites/me")
      .then((res) => res.ok ? res.json() : [])
      .then((data) => {
        if (Array.isArray(data)) {
          const ids = data.map((business: any) => String(business.id));
          setFavorites(ids);
          localStorage.setItem("fasty_favorite_businesses", JSON.stringify(ids));
        }
      })
      .catch(() => undefined);
  }, [user]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => undefined,
      { maximumAge: 1000 * 60 * 10, timeout: 5000 }
    );
  }, []);

  const isBusinessOpen = (business: any) => {
    if (business.status && business.status !== "active") return false;
    if (!business.opening_time || !business.closing_time) return true;
    const bogotaNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Bogota" }));
    const currentTime = bogotaNow.getHours() * 100 + bogotaNow.getMinutes();
    const [openH, openM] = business.opening_time.split(":").map(Number);
    const [closeH, closeM] = business.closing_time.split(":").map(Number);
    const openTime = openH * 100 + openM;
    const closeTime = closeH * 100 + closeM;
    return closeTime < openTime ? currentTime >= openTime || currentTime <= closeTime : currentTime >= openTime && currentTime <= closeTime;
  };

  const getDistanceKm = (business: any) => {
    if (!userLocation || !business.latitude || !business.longitude) return null;
    const R = 6371;
    const dLat = (Number(business.latitude) - userLocation.lat) * Math.PI / 180;
    const dLon = (Number(business.longitude) - userLocation.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(userLocation.lat * Math.PI / 180) * Math.cos(Number(business.latitude) * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  };

  const toggleFavorite = async (id: string) => {
    const next = favorites.includes(id) ? favorites.filter((fav) => fav !== id) : [...favorites, id];
    setFavorites(next);
    localStorage.setItem("fasty_favorite_businesses", JSON.stringify(next));
    if (user) {
      await fetch(`/api/businesses/${id}/favorite`, {
        method: favorites.includes(id) ? "DELETE" : "POST",
      }).catch(() => undefined);
    }
  };

  const visibleBusinesses = (businesses || [])
    .filter((business) => openFilter === "all" || (openFilter === "open" ? isBusinessOpen(business) : !isBusinessOpen(business)))
    .filter((business) => distanceFilter === "all" || (getDistanceKm(business) !== null && Number(getDistanceKm(business)) <= 5))
    .sort((a, b) => Number(favorites.includes(String(b.id))) - Number(favorites.includes(String(a.id))));

  const openBusinessesCount = (businesses || []).filter(isBusinessOpen).length;

  const handleCategorySelect = (category: string | null) => {
    if (category) {
      setSearchParams({ category });
    } else {
      searchParams.delete("category");
      setSearchParams(searchParams);
    }
  };

  const playClickSound = () => {
    const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3");
    audio.volume = 0.3;
    audio.play().catch((e) => {
      if (e?.name !== "AbortError" && e?.name !== "NotAllowedError") {
        console.debug("Notification sound skipped:", e?.name || e);
      }
    });
  };

  return (
    <div className="min-h-screen bg-gradient-warm">
      <main className="container py-10">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10">
          <div>
            <h1 className="text-4xl font-display font-bold tracking-tight">Explora negocios</h1>
            <p className="text-muted-foreground mt-2">Descubre los mejores sabores cerca de ti</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-center flex-1 max-w-2xl lg:justify-end">
            <div className="flex-1 w-full">
              <SearchInput placeholder="Busca pizza, sushi, hamburguesas…" className="max-w-none" />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="soft" size="xl" className="h-14 px-6 rounded-2xl border-border/60 bg-card/50 backdrop-blur-sm shadow-card hover:shadow-glow transition-all shrink-0">
                  <Filter className="h-5 w-5 mr-2 text-primary" />
                  {categoryFilter || "Todas las categorías"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-xl border-border/60 shadow-glow backdrop-blur-xl">
                <DropdownMenuLabel>Filtrar por categoría</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleCategorySelect(null)}>
                  Todas las categorías
                </DropdownMenuItem>
                {CATEGORIES.map((cat) => (
                  <DropdownMenuItem key={cat.name} onClick={() => handleCategorySelect(cat.name)}>
                    <span className="mr-2">{cat.emoji}</span>
                    {cat.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="mb-8 flex flex-wrap gap-3">
          {[
            { value: "all", label: "Todos" },
            { value: "open", label: "Abiertos ahora" },
            { value: "closed", label: "Cerrados" },
          ].map((option) => (
            <Button key={option.value} variant={openFilter === option.value ? "hero" : "soft"} size="sm" className="rounded-full" onClick={() => setOpenFilter(option.value as any)}>
              {option.label}
            </Button>
          ))}
          <Button variant={distanceFilter === "near" ? "hero" : "soft"} size="sm" className="rounded-full gap-2" onClick={() => setDistanceFilter(distanceFilter === "near" ? "all" : "near")} disabled={!userLocation}>
            <MapPin className="h-4 w-4" /> Cerca de mí
          </Button>
        </div>

        {!loading && businesses.length > 0 && openBusinessesCount === 0 && (
          <div className="mb-8 rounded-3xl border border-warning/20 bg-warning/10 p-5 text-sm">
            <h3 className="font-bold text-warning">No hay negocios abiertos en este momento</h3>
            <p className="text-muted-foreground mt-1">Puedes explorar el menú de negocios cerrados y volver cuando estén disponibles.</p>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <p className="text-muted-foreground font-medium">Buscando los mejores sabores...</p>
          </div>
        ) : visibleBusinesses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center">
              <Store className="h-10 w-10 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-xl font-bold">No hay negocios para este filtro</h3>
              <p className="text-muted-foreground mt-1">Cambia la categoría, distancia o estado abierto/cerrado.</p>
            </div>
            <Button variant="soft" onClick={() => handleCategorySelect(null)}>Ver todos los negocios</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {visibleBusinesses.map((b) => (
              <Link
                to={`/negocios/${b.id}`}
                key={b.id}
                onClick={playClickSound}
                className="group relative aspect-[4/3.2] rounded-[2rem] bg-white border border-border/40 overflow-hidden shadow-card hover:shadow-glow hover:-translate-y-1.5 active:scale-95 transition-all duration-500"
              >
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    toggleFavorite(String(b.id));
                  }}
                  className="absolute top-4 left-4 z-30 bg-white/90 backdrop-blur-md p-2 rounded-full shadow-soft border border-border/40"
                >
                  <Heart className={`h-4 w-4 ${favorites.includes(String(b.id)) ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
                </button>
                {/* Background/Image Container */}
                <div className="absolute inset-0 w-full h-full p-6 pb-20 bg-white">
                  {b.image_url ? (
                    <img
                      src={b.image_url.startsWith("http") ? b.image_url : (b.image_url.startsWith("/api") ? b.image_url : `/api${b.image_url}`)}
                      alt={b.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-warm rounded-2xl text-7xl">
                      <span className="group-hover:scale-110 transition-transform duration-700">{b.emoji || "🏪"}</span>
                    </div>
                  )}
                </div>

                {/* Rating Badge */}
                <div className="absolute top-4 right-4 z-20 bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-full flex items-center gap-1.5 text-xs font-bold shadow-soft border border-border/40">
                  <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                  {b.rating}
                </div>

                {/* Info Overlay at Bottom */}
                <div className="absolute inset-x-0 bottom-0 z-10 p-5 pt-10 bg-gradient-to-t from-white via-white/95 to-transparent">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display font-bold text-xl leading-tight group-hover:text-primary transition-colors line-clamp-1">
                      {b.name}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 text-sm text-muted-foreground">
                    <span className="inline-block w-2 h-2 rounded-full bg-primary/60 shrink-0"></span>
                    <span className="truncate font-medium">{b.category}</span>
                  </div>

                  <div className="mt-4 flex items-center justify-between text-xs border-t border-border/60 pt-4">
                    <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
                      <Clock className="h-4 w-4 text-primary/70" />
                      {getDistanceKm(b) ? `${b.eta} · ${Number(getDistanceKm(b)).toFixed(1)} km` : b.eta}
                    </div>
                    <div className="font-bold text-primary flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      Ver menú <Plus className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Businesses;
