import { Hammer, Clock, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";

const MaintenancePage = () => {
  return (
    <div className="min-h-screen bg-gradient-warm flex flex-col items-center justify-center p-6 text-center">
      <div className="w-24 h-24 bg-primary/10 rounded-3xl flex items-center justify-center mb-8 animate-bounce">
        <Hammer className="h-12 w-12 text-primary" />
      </div>
      
      <h1 className="text-4xl font-display font-bold tracking-tight mb-4">Plataforma en Mantenimiento</h1>
      <p className="text-muted-foreground max-w-md mb-8">
        Estamos trabajando para mejorar tu experiencia. Volveremos a estar en línea muy pronto. 
        ¡Gracias por tu paciencia!
      </p>

      <div className="grid gap-4 w-full max-w-sm">
        <div className="bg-card border border-border/60 p-4 rounded-2xl flex items-center gap-4">
          <Clock className="h-5 w-5 text-primary" />
          <div className="text-left">
            <p className="text-sm font-bold">Tiempo estimado</p>
            <p className="text-xs text-muted-foreground">30 - 60 minutos</p>
          </div>
        </div>
        
        <div className="bg-card border border-border/60 p-4 rounded-2xl flex items-center gap-4">
          <Phone className="h-5 w-5 text-primary" />
          <div className="text-left">
            <p className="text-sm font-bold">Soporte técnico</p>
            <p className="text-xs text-muted-foreground">Escríbenos si tienes un pedido en curso.</p>
          </div>
        </div>
      </div>

      <Button 
        variant="hero" 
        className="mt-10"
        onClick={() => window.location.reload()}
      >
        Reintentar conexión
      </Button>

      <p className="mt-12 text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
        © 2026 Fasty - Rapidito Delivery
      </p>
    </div>
  );
};

export default MaintenancePage;
