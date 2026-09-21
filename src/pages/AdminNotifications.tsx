import { useState, useEffect } from "react";
import {
  Send,
  Bell,
  Clock,
  Sparkles,
  History,
  Info,
  Smartphone,
  HelpCircle,
  ExternalLink,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { toast } from "@/hooks/use-toast";

interface BroadcastNotification {
  id: number;
  title: string;
  body: string;
  redirect_url: string;
  created_at: string;
}

const templates = [
  {
    name: "Cupón Descuento 🏷️",
    title: "¡Descuento del 15% hoy! 🚀",
    body: "Usa el cupón RAPIDO15 y obtén envío gratis + descuento en tus restaurantes favoritos.",
    url: "/negocios",
  },
  {
    name: "Alerta Domicilios Gratis 🛵",
    title: "¡Domicilios GRATIS en Fasty! 🎉",
    body: "Por las próximas 2 horas, todos tus pedidos tienen costo de entrega $0. ¡Aprovecha!",
    url: "/negocios",
  },
  {
    name: "Mantenimiento Técnico 🛠️",
    title: "Mantenimiento programado de Fasty ⚙️",
    body: "Estaremos realizando mejoras en el servidor hoy de 2:00 AM a 4:00 AM. ¡Gracias por tu paciencia!",
    url: "/",
  },
  {
    name: "Nueva Versión de la App ✨",
    title: "¡Nueva versión disponible! 🔥",
    body: "Hemos mejorado el rastreo en tiempo real y corregido errores. Actualiza ahora.",
    url: "/",
  },
  {
    name: "Fasty de vuelta 🧡",
    title: "Fasty está de vuelta",
    body: "Ya puedes pedir de nuevo. ¡Bienvenido de regreso a Fasty!",
    url: "/",
  },
];

const urlPresets = [
  { label: "Inicio (Home)", value: "/" },
  { label: "Lista de Negocios", value: "/negocios" },
  { label: "Rastreo de Pedidos", value: "/rastreo" },
  { label: "Pedido Abierto", value: "/pedido-abierto" },
  { label: "Mi Perfil", value: "/perfil" },
];

export default function AdminNotifications() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [redirectUrl, setRedirectUrl] = useState("/");
  const [isSending, setIsSending] = useState(false);
  const [history, setHistory] = useState<BroadcastNotification[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const response = await fetch("/api/admin/broadcasts");
      if (response.ok) {
        setHistory(await response.json());
      }
    } catch (err) {
      console.error("Fallo al conectar con el backend:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleApplyTemplate = (tpl: (typeof templates)[0]) => {
    setTitle(tpl.title);
    setBody(tpl.body);
    setRedirectUrl(tpl.url);
    toast({
      title: "Plantilla aplicada",
      description: `Se cargó la plantilla "${tpl.name}".`,
    });
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      toast({
        title: "Campos requeridos",
        description: "Completa el título y el cuerpo del mensaje.",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    try {
      const response = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          body,
          redirect_url: redirectUrl,
        }),
      });

      if (response.ok) {
        toast({
          title: "Notificación enviada",
          description: "Se transmitió vía Web Push y WebSockets.",
        });
        setTitle("");
        setBody("");
        setRedirectUrl("/");
        fetchHistory();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Error al transmitir la notificación");
      }
    } catch (err: any) {
      toast({
        title: "Error al enviar",
        description: err.message || "Ocurrió un error de red.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString("es-CO", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <AdminLayout
      breadcrumb="Notificaciones"
      eyebrow="Administración"
      title="Notificaciones masivas"
      description="Envía alertas push en tiempo real a usuarios de la plataforma."
    >
      <div className="min-w-0 space-y-6 sm:space-y-8">
        <div className="grid min-w-0 gap-6 lg:grid-cols-12 lg:gap-8">
          {/* Left: form */}
          <div className="min-w-0 space-y-5 lg:col-span-7">
            <div className="space-y-4 overflow-hidden rounded-2xl border border-border/60 bg-card p-4 shadow-card sm:rounded-3xl sm:p-6">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 shrink-0 text-primary" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground sm:text-sm">
                  Plantillas rápidas
                </h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Selecciona una plantilla para rellenar título, mensaje y destino.
              </p>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
                {templates.map((tpl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleApplyTemplate(tpl)}
                    className="group flex min-w-0 flex-col gap-1 rounded-2xl border border-border/40 p-3.5 text-left text-xs font-semibold transition-all hover:border-primary/40 hover:bg-primary/5"
                  >
                    <span className="truncate font-bold text-foreground transition-colors group-hover:text-primary">
                      {tpl.name}
                    </span>
                    <span className="line-clamp-1 text-[11px] font-normal text-muted-foreground">
                      {tpl.title}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <form
              onSubmit={handleSend}
              className="space-y-5 overflow-hidden rounded-2xl border border-border/60 bg-card p-4 shadow-card sm:rounded-3xl sm:p-6"
            >
              <h3 className="flex items-center gap-2 text-base font-bold sm:text-lg">
                <Bell className="h-5 w-5 shrink-0 text-primary" />
                Redactar notificación
              </h3>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="title-input" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Título *
                  </label>
                  <Input
                    id="title-input"
                    placeholder="Ej. ¡Descuento del 15% hoy! 🚀"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={80}
                    required
                    className="h-11 rounded-xl border-border/60 focus-visible:ring-primary/20"
                  />
                  <div className="text-right text-[10px] text-muted-foreground">{title.length}/80</div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="body-input" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Mensaje *
                  </label>
                  <textarea
                    id="body-input"
                    placeholder="Escribe el cuerpo del mensaje..."
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={3}
                    maxLength={200}
                    required
                    className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2"
                  />
                  <div className="text-right text-[10px] text-muted-foreground">{body.length}/200</div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="min-w-0 space-y-2">
                    <label htmlFor="preset-select" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Enlaces rápidos
                    </label>
                    <select
                      id="preset-select"
                      value={urlPresets.some((p) => p.value === redirectUrl) ? redirectUrl : "custom"}
                      onChange={(e) => {
                        if (e.target.value !== "custom") setRedirectUrl(e.target.value);
                      }}
                      className="flex h-11 w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      {urlPresets.map((preset) => (
                        <option key={preset.value} value={preset.value}>
                          {preset.label}
                        </option>
                      ))}
                      <option value="custom">Ruta personalizada...</option>
                    </select>
                  </div>

                  <div className="min-w-0 space-y-2">
                    <label htmlFor="url-input" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Ruta de destino
                    </label>
                    <Input
                      id="url-input"
                      placeholder="Ej. /negocios"
                      value={redirectUrl}
                      onChange={(e) => setRedirectUrl(e.target.value)}
                      className="h-11 rounded-xl border-border/60 focus-visible:ring-primary/20"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-3 text-xs text-primary/90 sm:p-4">
                <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <p className="min-w-0 leading-relaxed">
                  Se enviará a dispositivos con Web Push y a usuarios conectados por WebSocket.
                </p>
              </div>

              <Button
                type="submit"
                disabled={isSending}
                className="h-12 w-full gap-2 rounded-2xl text-sm font-bold shadow-glow"
              >
                {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-4 w-4" />}
                {isSending ? "Transmitiendo..." : "Enviar notificación masiva"}
              </Button>
            </form>
          </div>

          {/* Right: preview */}
          <div className="min-w-0 space-y-4 lg:col-span-5">
            <div className="flex items-center justify-between gap-2 px-1">
              <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground sm:text-sm">
                <Smartphone className="h-4 w-4 shrink-0" /> Previsualización
              </h3>
              <div className="flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-600">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Web Push
              </div>
            </div>

            <div className="relative min-w-0 overflow-hidden rounded-2xl border border-border/60 bg-muted/20 p-4 shadow-card sm:rounded-3xl sm:p-6">
              <div className="relative mx-auto flex w-full max-w-[280px] flex-col justify-between overflow-hidden rounded-[28px] border-4 border-slate-800 bg-slate-950/90 p-3.5 font-sans text-white shadow-2xl aspect-[9/16] sm:max-w-[300px]">
                <div className="absolute left-1/2 top-0 h-3.5 w-28 -translate-x-1/2 rounded-b-xl bg-slate-800" />

                <div className="flex items-center justify-between px-1 pt-1 text-[10px] opacity-80">
                  <span>9:41</span>
                  <span>5G ▮▮▮</span>
                </div>

                <div className="space-y-1 pt-6 text-center">
                  <span className="font-display text-2xl font-light tracking-wide text-white/90 sm:text-3xl">
                    Hoy
                  </span>
                  <p className="text-[10px] uppercase tracking-widest text-white/60">Fasty</p>
                </div>

                <div className="flex flex-1 flex-col items-center justify-center py-3">
                  <div className="flex w-full flex-col gap-1.5 rounded-2xl border border-white/10 bg-white/10 p-3 shadow-2xl backdrop-blur-xl">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary text-[10px] font-black text-primary-foreground">
                          F
                        </div>
                        <span className="truncate text-[10px] font-bold uppercase tracking-wide text-white/80">
                          FASTY
                        </span>
                      </div>
                      <span className="shrink-0 text-[9px] text-white/50">ahora</span>
                    </div>
                    <div className="min-w-0 text-left">
                      <p className="break-words text-xs font-bold leading-snug text-white/90">
                        {title.trim() || "¡Ejemplo de título masivo! 🛵"}
                      </p>
                      <p className="mt-0.5 line-clamp-3 break-words text-[10px] leading-normal text-white/70">
                        {body.trim() ||
                          "Escribe el mensaje a la izquierda para ver cómo se verá en el dispositivo..."}
                      </p>
                    </div>
                    {redirectUrl && (
                      <div className="flex max-w-full items-center gap-1 self-start truncate rounded-full border border-white/5 bg-white/10 px-2 py-0.5 text-[8px] text-white/80">
                        <ExternalLink className="h-2 w-2 shrink-0" />
                        <span className="truncate">Abrir: {redirectUrl}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pb-1 text-center">
                  <div className="mx-auto h-1 w-20 rounded-full bg-white/40" />
                </div>
              </div>

              <div className="mt-4 space-y-1.5 rounded-xl border border-border/40 bg-background/60 p-3 text-xs text-muted-foreground">
                <p className="flex items-center gap-1 font-semibold text-foreground">
                  <HelpCircle className="h-4 w-4 shrink-0 text-primary" /> Consejos
                </p>
                <ul className="list-disc space-y-1 pl-4 text-[11px]">
                  <li>Usa emojis para mejorar la tasa de clics.</li>
                  <li>Mantén el título corto para que no se recorte.</li>
                  <li>Enlaza a una ruta existente de la app.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* History */}
        <div className="min-w-0 space-y-4 overflow-hidden rounded-2xl border border-border/60 bg-card p-4 shadow-card sm:rounded-3xl sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <History className="h-5 w-5 shrink-0 text-primary" />
              <h3 className="truncate text-base font-bold sm:text-lg">Historial</h3>
            </div>
            <Button
              onClick={fetchHistory}
              variant="outline"
              size="sm"
              className="h-10 w-full gap-1.5 rounded-xl border-border/60 text-xs sm:h-9 sm:w-auto"
              disabled={isLoadingHistory}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoadingHistory ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
          </div>

          {isLoadingHistory && history.length === 0 ? (
            <div className="flex h-28 flex-col items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
              <span className="text-xs">Cargando historial...</span>
            </div>
          ) : history.length === 0 ? (
            <div className="space-y-2 rounded-2xl border border-dashed border-border/80 p-8 text-center text-muted-foreground">
              <Bell className="mx-auto h-8 w-8 text-muted-foreground/60" />
              <p className="text-sm font-semibold">No hay envíos aún</p>
              <p className="text-xs">Cuando envíes una notificación masiva aparecerá aquí.</p>
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="space-y-2.5 md:hidden">
                {history.map((notif) => (
                  <div key={notif.id} className="min-w-0 rounded-2xl border border-border/40 bg-muted/20 p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 flex-1 break-words text-sm font-semibold">{notif.title}</p>
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">#{notif.id}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 break-words text-xs text-muted-foreground">{notif.body}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                      <span className="max-w-full truncate rounded-full border border-primary/10 bg-primary/5 px-2 py-0.5 font-mono text-primary">
                        {notif.redirect_url || "/"}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(notif.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden overflow-x-auto rounded-2xl border border-border/40 md:block">
                <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-border/40 bg-muted/40 font-semibold text-muted-foreground">
                      <th className="w-16 p-3 text-center">ID</th>
                      <th className="w-48 p-3">Título</th>
                      <th className="p-3">Mensaje</th>
                      <th className="w-36 p-3">Destino</th>
                      <th className="w-44 p-3 text-right">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30 bg-card">
                    {history.map((notif) => (
                      <tr key={notif.id} className="transition-colors hover:bg-muted/20">
                        <td className="p-3 text-center font-mono font-bold text-muted-foreground">#{notif.id}</td>
                        <td className="max-w-[12rem] truncate p-3 font-semibold">{notif.title}</td>
                        <td className="max-w-md truncate p-3 text-muted-foreground">{notif.body}</td>
                        <td className="p-3 font-mono text-[11px] text-primary">
                          <span className="inline-flex max-w-[8rem] truncate rounded-full border border-primary/10 bg-primary/5 px-2.5 py-0.5">
                            {notif.redirect_url || "/"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap p-3 text-right text-xs text-muted-foreground">
                          <span className="inline-flex items-center justify-end gap-1.5">
                            <Clock className="h-3 w-3" />
                            {formatDate(notif.created_at)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
