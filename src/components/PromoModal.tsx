import { useState, useEffect } from "react";
import { X, Gift, ChevronRight, ChevronLeft, ArrowRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useCart } from "@/context/CartContext";
import { toast } from "@/hooks/use-toast";

interface Promotion {
  id: number;
  business_id: string;
  title: string;
  description: string;
  discount_percent?: number;
  promo_code?: string;
  emoji?: string;
}

interface PromoModalProps {
  promotions: Promotion[];
}

const PromoModal = ({ promotions = [] }: PromoModalProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const { applyPromo } = useCart();

  useEffect(() => {
    if (promotions.length > 0) {
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 1500); // Aparece después de 1.5 segundos
      return () => clearTimeout(timer);
    }
  }, [promotions]);

  if (!isOpen || promotions.length === 0) return null;

  const currentPromo = promotions[currentIndex];

  const nextPromo = () => {
    setCurrentIndex((prev) => (prev + 1) % promotions.length);
  };

  const prevPromo = () => {
    setCurrentIndex((prev) => (prev - 1 + promotions.length) % promotions.length);
  };

  const handleApply = () => {
    applyPromo(currentPromo.promo_code || "PROMO", currentPromo.discount_percent || 0);
    toast({ 
      title: "Promoción aplicada", 
      description: `Se ha aplicado el código ${currentPromo.promo_code} a tu carrito.` 
    });
    setIsOpen(false);
  };

  const promoColors = [
    "from-blue-600 to-blue-400",
    "from-orange-600 to-orange-400",
    "from-green-600 to-green-400",
    "from-purple-600 to-purple-400",
    "from-red-600 to-red-400",
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500">
        {/* Header con gradiente */}
        <div className={`h-48 bg-gradient-to-br ${promoColors[currentIndex % promoColors.length]} p-8 relative overflow-hidden`}>
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -mr-24 -mt-24" />
          <div className="relative z-10 flex flex-col h-full justify-between">
            <div className="flex justify-between items-start">
              <div className="h-12 w-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                <Gift className="h-6 w-6 text-white" />
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-full bg-black/20 hover:bg-black/40 text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div>
              <h2 className="text-white text-3xl font-display font-bold leading-tight">
                ¡Oferta Exclusiva!
              </h2>
            </div>
          </div>
        </div>

        {/* Contenido */}
        <div className="p-8">
          <div className="flex items-center gap-6 mb-8">
            <div className="text-6xl animate-bounce-slow">
              {currentPromo.emoji || "🎁"}
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-bold leading-tight mb-2">
                {currentPromo.title}
              </h3>
              <p className="text-muted-foreground text-sm font-medium leading-relaxed">
                {currentPromo.description}
              </p>
            </div>
          </div>

          <div className="bg-muted/40 rounded-2xl p-4 flex items-center justify-between mb-8 border border-border/50">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Código</span>
              <span className="font-mono font-bold text-lg text-primary">{currentPromo.promo_code || "SIN CÓDIGO"}</span>
            </div>
            {currentPromo.discount_percent && (
              <div className="bg-primary text-white font-bold px-4 py-2 rounded-xl shadow-lg shadow-primary/20">
                {currentPromo.discount_percent}% OFF
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button 
              className="flex-1 h-14 rounded-2xl font-bold text-lg shadow-glow" 
              variant="hero"
              onClick={handleApply}
            >
              Aplicar ahora
            </Button>
            <Button 
              asChild
              className="flex-1 h-14 rounded-2xl font-bold text-lg" 
              variant="soft"
            >
              <Link to={`/negocios/${currentPromo.business_id}`} onClick={() => setIsOpen(false)}>
                Ver negocio
              </Link>
            </Button>
          </div>

          {/* Navegación entre promos */}
          {promotions.length > 1 && (
            <div className="mt-8 flex items-center justify-center gap-4">
              <button 
                onClick={prevPromo}
                className="p-2 rounded-full hover:bg-muted text-muted-foreground transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="flex gap-1.5">
                {promotions.map((_, i) => (
                  <div 
                    key={i} 
                    className={`h-1.5 rounded-full transition-all duration-300 ${i === currentIndex ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/30'}`} 
                  />
                ))}
              </div>
              <button 
                onClick={nextPromo}
                className="p-2 rounded-full hover:bg-muted text-muted-foreground transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PromoModal;
