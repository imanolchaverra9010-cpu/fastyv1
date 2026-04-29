import { Link, useSearchParams } from "react-router-dom";
import { Clock, Plus, Star, Loader2, Store, Filter } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import SearchInput from "@/components/SearchInput";
import { CATEGORIES } from "@/constants/categories";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Businesses = () => {
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryFilter = searchParams.get("category");
  const queryFilter = searchParams.get("q");

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

    fetch(url.toString())
      .then(res => res.json())
      .then(data => {
        setBusinesses(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [categoryFilter, queryFilter]);

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
    audio.play().catch(e => console.log("Error playing sound:", e));
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
                    <span className="mr-2">{cat.icon && <cat.icon className="h-4 w-4" />}</span>
                    {cat.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <p className="text-muted-foreground font-medium">Buscando los mejores sabores...</p>
          </div>
        ) : (businesses || []).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center">
              <Store className="h-10 w-10 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-xl font-bold">No se encontraron negocios</h3>
              <p className="text-muted-foreground mt-1">Intenta con otra búsqueda o categoría.</p>
            </div>
            <Button variant="soft" onClick={() => handleCategorySelect(null)}>Ver todos los negocios</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {(businesses || []).map((b) => (
              <Link
                to={`/negocios/${b.id}`}
                key={b.id}
                onClick={playClickSound}
                className="group relative aspect-[4/3.2] rounded-[2rem] bg-white border border-border/40 overflow-hidden shadow-card hover:shadow-glow hover:-translate-y-1.5 active:scale-95 transition-all duration-500"
              >
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
                      {b.eta}
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
