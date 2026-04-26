import { useState, useEffect } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { registerPush } from "@/lib/push";
import { useAuth } from "@/context/AuthContext";
import { toast } from "@/hooks/use-toast";

export const NotificationPrompt = () => {
  const { user } = useAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!user) return;
    
    // Only show if permissions haven't been granted or denied yet
    if (Notification.permission === "default") {
      // Small delay before showing the prompt
      const timer = setTimeout(() => setShow(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [user]);

  const handleEnable = async () => {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      const success = await registerPush(user!.id);
      if (success) {
        toast({
          title: "¡Listo!",
          description: "Recibirás notificaciones de tus pedidos.",
        });
      }
    }
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 md:left-auto md:right-8 md:w-80 bg-card border border-border shadow-2xl rounded-2xl p-5 animate-in slide-in-from-bottom-10 z-50">
      <button 
        onClick={() => setShow(false)}
        className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
      
      <div className="flex items-start gap-4">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
          <Bell className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <p className="font-bold text-sm">¿Quieres recibir avisos?</p>
          <p className="text-xs text-muted-foreground">Te notificaremos cuando el estado de tu pedido cambie o haya novedades.</p>
          <div className="pt-2 flex gap-2">
            <Button size="sm" className="h-8 rounded-lg text-xs" onClick={handleEnable}>
              Activar
            </Button>
            <Button size="sm" variant="ghost" className="h-8 rounded-lg text-xs" onClick={() => setShow(false)}>
              Después
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
