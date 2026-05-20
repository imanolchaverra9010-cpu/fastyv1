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
  Check,
  AlertTriangle,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";
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
    url: "/negocios"
  },
  {
    name: "Alerta Domicilios Gratis 🛵",
    title: "¡Domicilios GRATIS en Fasty! 🎉",
    body: "Por las próximas 2 horas, todos tus pedidos tienen costo de entrega $0. ¡Aprovecha!",
    url: "/negocios"
  },
  {
    name: "Mantenimiento Técnico 🛠️",
    title: "Mantenimiento programado de Fasty ⚙️",
    body: "Estaremos realizando mejoras en el servidor hoy de 2:00 AM a 4:00 AM. ¡Gracias por tu paciencia!",
    url: "/"
  },
  {
    name: "Nueva Versión de la App ✨",
    title: "¡Nueva versión disponible! 🔥",
    body: "Hemos mejorado el rastreo en tiempo real y corregido errores. Actualiza ahora.",
    url: "/"
  }
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
        const data = await response.json();
        setHistory(data);
      } else {
        console.error("Error al obtener el historial de notificaciones masivas");
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

  const handleApplyTemplate = (tpl: typeof templates[0]) => {
    setTitle(tpl.title);
    setBody(tpl.body);
    setRedirectUrl(tpl.url);
    toast({
      title: "Plantilla aplicada",
      description: `Se cargó la plantilla "${tpl.name}".`
    });
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      toast({
        title: "Campos requeridos",
        description: "Por favor, completa el título y el cuerpo del mensaje.",
        variant: "destructive"
      });
      return;
    }

    setIsSending(true);
    try {
      const response = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title,
          body,
          redirect_url: redirectUrl
        })
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Notificación Masiva Enviada",
          description: "La notificación se ha encolado para su transmisión vía Web Push y WebSockets."
        });
        setTitle("");
        setBody("");
        setRedirectUrl("/");
        fetchHistory(); // Recargar el historial
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Error al transmitir la notificación");
      }
    } catch (err: any) {
      toast({
        title: "Error al enviar",
        description: err.message || "Ocurrió un error de red al contactar con el backend.",
        variant: "destructive"
      });
    } finally {
      setIsSending(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString("es-CO", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-gradient-warm">
        <AdminSidebar />
        <SidebarInset className="flex-1">
          {/* Header */}
          <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-border/60 bg-background/75 backdrop-blur-xl px-4 md:px-6">
            <SidebarTrigger className="-ml-1" />
            <div className="h-4 w-px bg-border/60 mx-2" />
            <h2 className="text-sm font-semibold text-muted-foreground">Notificaciones</h2>
          </header>

          <main className="p-4 md:p-8 max-w-7xl mx-auto w-full space-y-8">
            {/* Page Title & Header */}
            <div>
              <p className="text-xs md:text-sm text-primary font-semibold">Administración</p>
              <h1 className="text-2xl md:text-4xl font-display font-bold tracking-tight">Notificaciones Masivas</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Envía alertas push en tiempo real y notificaciones Web Push PWA a todos los usuarios de la plataforma en cuestión de segundos.
              </p>
            </div>

            <div className="grid lg:grid-cols-12 gap-8">
              {/* Left Column: Form & Presets */}
              <div className="lg:col-span-7 space-y-6">
                {/* Templates Panel */}
                <div className="rounded-3xl bg-card border border-border/60 p-6 shadow-card space-y-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
                      Plantillas Rápidas
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Selecciona una plantilla preestablecida para rellenar automáticamente los campos y acelerar la comunicación de novedades importantes.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    {templates.map((tpl, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleApplyTemplate(tpl)}
                        className="flex flex-col text-left p-3.5 rounded-2xl border border-border/40 hover:border-primary/40 hover:bg-primary/5 transition-all text-xs font-semibold gap-1 group"
                      >
                        <span className="text-foreground font-bold group-hover:text-primary transition-colors">{tpl.name}</span>
                        <span className="text-muted-foreground font-normal text-[11px] line-clamp-1">{tpl.title}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Composer Form Card */}
                <form onSubmit={handleSend} className="rounded-3xl bg-card border border-border/60 p-6 shadow-card space-y-5">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Bell className="h-5 w-5 text-primary" />
                    Redactar Notificación
                  </h3>

                  <div className="space-y-4">
                    {/* Title */}
                    <div className="space-y-2">
                      <label htmlFor="title-input" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        Título de la Notificación *
                      </label>
                      <Input
                        id="title-input"
                        placeholder="Ej. ¡Descuento del 15% hoy! 🚀"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        maxLength={80}
                        required
                        className="rounded-xl h-11 border-border/60 focus-visible:ring-primary/20"
                      />
                      <div className="text-[10px] text-right text-muted-foreground">
                        {title.length}/80 caracteres recomendados
                      </div>
                    </div>

                    {/* Message Body */}
                    <div className="space-y-2">
                      <label htmlFor="body-input" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        Cuerpo del Mensaje *
                      </label>
                      <textarea
                        id="body-input"
                        placeholder="Escribe el cuerpo del mensaje que verán los usuarios en su dispositivo..."
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        rows={3}
                        maxLength={200}
                        required
                        className="w-full rounded-xl border border-border/60 bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                      <div className="text-[10px] text-right text-muted-foreground">
                        {body.length}/200 caracteres recomendados
                      </div>
                    </div>

                    {/* Redirection Link */}
                    <div className="grid md:grid-cols-2 gap-4">
                      {/* Presets Select */}
                      <div className="space-y-2">
                        <label htmlFor="preset-select" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                          Enlaces Rápidos
                        </label>
                        <select
                          id="preset-select"
                          value={redirectUrl}
                          onChange={(e) => setRedirectUrl(e.target.value)}
                          className="flex h-11 w-full rounded-xl border border-border/60 bg-transparent px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
                        >
                          <option value="" disabled className="text-muted-foreground">Seleccionar ruta</option>
                          {urlPresets.map((preset) => (
                            <option key={preset.value} value={preset.value}>
                              {preset.label} ({preset.value})
                            </option>
                          ))}
                          <option value="custom">Ruta Personalizada...</option>
                        </select>
                      </div>

                      {/* Custom Redirect Path */}
                      <div className="space-y-2">
                        <label htmlFor="url-input" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                          Ruta o URL de Destino
                        </label>
                        <Input
                          id="url-input"
                          placeholder="Ej. /negocios o /pedido-abierto"
                          value={redirectUrl}
                          onChange={(e) => setRedirectUrl(e.target.value)}
                          className="rounded-xl h-11 border-border/60 focus-visible:ring-primary/20"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Info alert block */}
                  <div className="rounded-2xl bg-primary/5 border border-primary/20 p-4 flex gap-3 text-xs text-primary/80">
                    <Info className="h-5 w-5 shrink-0 text-primary mt-0.5" />
                    <div>
                      <p className="font-semibold">Información del Envío:</p>
                      <p className="mt-1 leading-relaxed">
                        Esta notificación masiva se enviará a todos los dispositivos registrados con tokens Web Push e igualmente en tiempo real por WebSockets a todos los clientes, restaurantes y repartidores que estén en línea.
                      </p>
                    </div>
                  </div>

                  {/* Send Button */}
                  <Button
                    type="submit"
                    disabled={isSending}
                    className="w-full rounded-2xl h-12 gap-2 text-sm font-bold shadow-glow hover:scale-[1.01] active:scale-[0.99] transition-transform"
                  >
                    {isSending ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {isSending ? "Transmitiendo notificación..." : "Enviar Notificación Masiva"}
                  </Button>
                </form>
              </div>

              {/* Right Column: iOS / Android Push Simulation Mockup */}
              <div className="lg:col-span-5 space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                    <Smartphone className="h-4 w-4" /> Previsualización en Vivo
                  </h3>
                  <div className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full text-emerald-600 font-semibold flex items-center gap-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    PWA Web Push
                  </div>
                </div>

                {/* Device Shell */}
                <div className="rounded-3xl border border-border/60 bg-muted/20 p-5 md:p-6 shadow-glow relative overflow-hidden backdrop-blur-sm min-h-[400px] flex flex-col justify-between">
                  {/* Abstract colorful background of mockup */}
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(249,115,22,0.06),transparent_60%)] pointer-events-none" />
                  
                  {/* Smartphone Lockscreen Simulation */}
                  <div className="w-full max-w-[320px] mx-auto bg-slate-950/80 backdrop-blur-md rounded-[32px] border-4 border-slate-800 shadow-2xl aspect-[9/18] overflow-hidden flex flex-col justify-between p-4 relative font-sans text-white">
                    {/* Notch */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-4 bg-slate-800 rounded-b-xl flex items-center justify-center">
                      <div className="w-3 h-3 rounded-full bg-slate-900 absolute right-6" />
                      <div className="w-10 h-1 bg-slate-900 rounded-full" />
                    </div>

                    {/* Top status bar */}
                    <div className="flex justify-between items-center text-[10px] opacity-80 pt-1 px-2 select-none">
                      <span>9:41 AM</span>
                      <div className="flex items-center gap-1">
                        <span>5G</span>
                        <div className="w-4 h-2.5 border border-white/50 rounded-[2px] p-[1px] flex items-center">
                          <div className="w-full h-full bg-white rounded-[1px]" />
                        </div>
                      </div>
                    </div>

                    {/* Clock Widget */}
                    <div className="text-center pt-8 space-y-1 select-none">
                      <span className="text-3xl font-display font-light tracking-wide text-white/90">Miércoles, 20</span>
                      <p className="text-[11px] uppercase tracking-widest text-white/60">Mayo</p>
                    </div>

                    {/* iOS Notification Banner Simulation */}
                    <div className="w-full flex-1 flex flex-col justify-center items-center py-4">
                      <div className="w-full bg-white/10 backdrop-blur-xl border border-white/10 rounded-2xl p-3.5 shadow-2xl flex flex-col gap-1.5 animate-bounce-short">
                        {/* Banner Header */}
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-1.5">
                            <div className="h-5 w-5 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-black text-[10px] shadow-sm select-none">
                              F
                            </div>
                            <span className="text-[10px] font-bold tracking-wide uppercase text-white/80">FASTY</span>
                          </div>
                          <span className="text-[9px] text-white/50">ahora</span>
                        </div>
                        {/* Banner Body */}
                        <div className="text-left">
                          <p className="text-xs font-bold text-white/90 leading-snug break-words">
                            {title.trim() || "¡Ejemplo de título masivo! 🛵"}
                          </p>
                          <p className="text-[10px] text-white/70 leading-normal mt-0.5 break-words line-clamp-3">
                            {body.trim() || "Escribe el cuerpo del mensaje a la izquierda para ver cómo se visualizará en la pantalla del dispositivo del cliente..."}
                          </p>
                        </div>
                        {/* URL badge inside mockup */}
                        {redirectUrl && (
                          <div className="flex items-center gap-1 text-[8px] bg-white/10 text-primary-foreground px-2 py-0.5 rounded-full self-start border border-white/5">
                            <ExternalLink className="h-2 w-2" />
                            <span>Abrir: {redirectUrl}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Swipe to open prompt */}
                    <div className="text-center pb-2 select-none">
                      <div className="w-24 h-1 bg-white/40 rounded-full mx-auto" />
                      <p className="text-[8px] text-white/40 mt-1.5 font-medium tracking-widest uppercase">Deslizar para abrir</p>
                    </div>
                  </div>

                  {/* Visual Mockup Tips */}
                  <div className="rounded-xl bg-background/50 border border-border/40 p-3.5 text-xs text-muted-foreground space-y-1.5 mt-2">
                    <p className="font-semibold text-foreground flex items-center gap-1">
                      <HelpCircle className="h-4 w-4 text-primary" /> Consejos para el Éxito:
                    </p>
                    <ul className="list-disc pl-4 space-y-1 text-[11px]">
                      <li>Usa emojis divertidos (🚀, 🍕, 🛵, 🎉) para aumentar la tasa de clics.</li>
                      <li>Mantén el título corto y directo para que no se recorte.</li>
                      <li>Asegúrate de enlazar a una sección existente de la plataforma.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Section: Broadcast Logs History */}
            <div className="rounded-3xl bg-card border border-border/60 p-6 shadow-card space-y-5">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-2">
                  <History className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-bold text-foreground">Historial de Notificaciones Masivas</h3>
                </div>
                <Button
                  onClick={fetchHistory}
                  variant="outline"
                  size="sm"
                  className="rounded-xl gap-1.5 text-xs h-9 border-border/60 hover:bg-muted/50"
                  disabled={isLoadingHistory}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isLoadingHistory ? 'animate-spin' : ''}`} />
                  Actualizar
                </Button>
              </div>

              {isLoadingHistory && history.length === 0 ? (
                <div className="h-32 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-7 w-7 animate-spin text-primary" />
                  <span className="text-xs">Cargando el registro histórico...</span>
                </div>
              ) : history.length === 0 ? (
                <div className="border border-dashed border-border/80 rounded-2xl p-8 text-center text-muted-foreground space-y-2">
                  <Bell className="h-8 w-8 text-muted-foreground/60 mx-auto" />
                  <p className="font-semibold text-sm">No hay registros de envío</p>
                  <p className="text-xs text-muted-foreground/80">
                    Aún no se ha realizado ninguna transmisión de notificaciones masivas desde este panel de administración.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-border/40 rounded-2xl">
                  <table className="w-full text-left border-collapse text-xs md:text-sm">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border/40 text-muted-foreground font-semibold">
                        <th className="p-3 w-16 text-center">ID</th>
                        <th className="p-3 w-48">Título</th>
                        <th className="p-3">Mensaje / Cuerpo</th>
                        <th className="p-3 w-36">Destino</th>
                        <th className="p-3 w-48 text-right">Fecha de Envío (Bogotá)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30 bg-card">
                      {history.map((notif) => (
                        <tr key={notif.id} className="hover:bg-muted/20 transition-colors">
                          <td className="p-3 text-center font-mono font-bold text-muted-foreground">#{notif.id}</td>
                          <td className="p-3 font-semibold text-foreground">{notif.title}</td>
                          <td className="p-3 text-muted-foreground leading-normal max-w-xs truncate md:max-w-md">{notif.body}</td>
                          <td className="p-3 font-mono text-[11px] text-primary">
                            <span className="bg-primary/5 px-2.5 py-0.5 rounded-full border border-primary/10 inline-flex items-center gap-1 select-all">
                              {notif.redirect_url || "/"}
                            </span>
                          </td>
                          <td className="p-3 text-right text-muted-foreground text-xs whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <Clock className="h-3 w-3" />
                              <span>{formatDate(notif.created_at)}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
