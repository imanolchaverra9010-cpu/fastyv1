import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { registerPush } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { toast } from "@/hooks/use-toast";

export const AdminPushSetup = () => {
  const { user } = useAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (user?.role !== "admin" || !user?.id) return;

    if (typeof Notification === "undefined") return;

    if (Notification.permission === "granted") {
      registerPush(user.id);
      return;
    }

    if (Notification.permission === "default") {
      const dismissed = sessionStorage.getItem("admin_push_prompt_dismissed");
      if (!dismissed) {
        const timer = setTimeout(() => setShow(true), 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [user?.id, user?.role]);

  const handleEnable = async () => {
    if (typeof Notification === "undefined" || !user?.id) return;
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      const success = await registerPush(user.id);
      toast({
        title: success ? "Alertas admin activadas" : "Permiso concedido",
        description: success
          ? "Recibirás push de SOS, pedidos sin asignar y alertas Wompi."
          : "Activa las notificaciones en configuración del navegador si no llegan.",
      });
    }
    setShow(false);
  };

  const handleDismiss = () => {
    sessionStorage.setItem("admin_push_prompt_dismissed", "1");
    setShow(false);
  };

  if (!show || user?.role !== "admin") return null;

  return (
    <div className="fixed bottom-6 left-4 right-4 md:left-auto md:right-8 md:w-96 bg-zinc-900 border border-primary/30 shadow-2xl rounded-2xl p-5 animate-in slide-in-from-bottom-10 z-50 text-white">
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 text-zinc-400 hover:text-white"
        type="button"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-4">
        <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0">
          <Bell className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <p className="font-bold text-sm">Alertas operativas para admin</p>
          <p className="text-xs text-zinc-400">
            SOS en viajes, pedidos sin asignar, domiciliarios offline y problemas Wompi.
          </p>
          <div className="pt-2 flex gap-2">
            <Button size="sm" className="h-8 rounded-lg text-xs" onClick={handleEnable}>
              Activar push
            </Button>
            <Button size="sm" variant="ghost" className="h-8 rounded-lg text-xs text-zinc-400" onClick={handleDismiss}>
              Después
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
