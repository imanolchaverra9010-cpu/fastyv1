import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import IndexPrincipal from "./Indexprincipal";
import IndexSecundario from "./Indexsecundario";

/**
 * Home inteligente:
 * - Con banners/promociones activas → Indexsecundario (marketplace con banners)
 * - Sin banners → Indexprincipal (home clásica)
 */
const Index = () => {
  const { data: banners, isLoading, isError } = useQuery<any[]>({
    queryKey: ["activeBanners"],
    queryFn: async () => {
      const response = await fetch("/api/banners/active");
      if (!response.ok) throw new Error("Error fetching banners");
      return response.json();
    },
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-warm">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasActivePromotions = !isError && Array.isArray(banners) && banners.length > 0;

  return hasActivePromotions ? <IndexSecundario /> : <IndexPrincipal />;
};

export default Index;
