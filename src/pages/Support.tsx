import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, LifeBuoy, Mail, MessageCircle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";

const Support = () => {
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      name: String(formData.get("name") || ""),
      phone: String(formData.get("phone") || ""),
      order_id: String(formData.get("orderId") || "") || null,
      message: String(formData.get("message") || ""),
    };

    try {
      const response = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: "No se pudo enviar la solicitud" }));
        throw new Error(error.detail || "No se pudo enviar la solicitud");
      }

      const ticket = await response.json();
      form.reset();
      toast({ title: "Solicitud recibida", description: `Tu caso ${ticket.id} quedó registrado.` });
    } catch (error) {
      const tickets = JSON.parse(localStorage.getItem("fasty_support_tickets") || "[]");
      const offlineTicket = {
        id: `SUP-LOCAL-${Date.now().toString(36).toUpperCase()}`,
        ...payload,
        status: "pending_sync",
        createdAt: new Date().toISOString(),
      };
      localStorage.setItem("fasty_support_tickets", JSON.stringify([offlineTicket, ...tickets].slice(0, 20)));
      toast({
        title: "Guardado temporalmente",
        description: error instanceof Error ? error.message : "Tu solicitud quedó guardada localmente para reintentar.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-warm pb-20">
      <main className="container max-w-4xl pt-10">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8"><ArrowLeft className="h-4 w-4" /> Volver al inicio</Link>
        <div className="grid lg:grid-cols-[1fr_360px] gap-6">
          <form onSubmit={submit} className="bg-card border rounded-3xl p-8 shadow-glow space-y-5">
            <div className="flex items-center gap-4 mb-4"><div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary"><LifeBuoy className="h-8 w-8" /></div><div><h1 className="text-3xl font-display font-bold">Soporte</h1><p className="text-muted-foreground">Cuéntanos qué pasó con tu pedido.</p></div></div>
            <div className="grid md:grid-cols-2 gap-4"><div className="space-y-2"><Label>Nombre</Label><Input name="name" required className="rounded-xl" /></div><div className="space-y-2"><Label>Teléfono</Label><Input name="phone" required className="rounded-xl" /></div></div>
            <div className="space-y-2"><Label>ID del pedido</Label><Input name="orderId" placeholder="Opcional" className="rounded-xl" /></div>
            <div className="space-y-2"><Label>Mensaje</Label><Textarea name="message" required placeholder="Describe tu problema, reclamo o solicitud..." className="rounded-xl min-h-36" /></div>
            <Button type="submit" disabled={loading} className="w-full rounded-xl">{loading ? "Enviando..." : "Enviar solicitud"}</Button>
          </form>
          <aside className="space-y-4">
            <div className="bg-card border rounded-3xl p-6 shadow-card"><h2 className="font-bold text-lg mb-3">Canales rápidos</h2><div className="space-y-3 text-sm"><a href="tel:+573000000000" className="flex items-center gap-3 text-muted-foreground hover:text-primary"><Phone className="h-4 w-4" /> Llamar soporte</a><a href="mailto:soporte@fasty.app" className="flex items-center gap-3 text-muted-foreground hover:text-primary"><Mail className="h-4 w-4" /> soporte@fasty.app</a><a href="https://wa.me/573000000000" target="_blank" rel="noreferrer" className="flex items-center gap-3 text-muted-foreground hover:text-primary"><MessageCircle className="h-4 w-4" /> WhatsApp</a></div></div>
            <div className="bg-primary/10 border border-primary/20 rounded-3xl p-6"><h2 className="font-bold text-primary">Prioridad alta</h2><p className="text-sm text-muted-foreground mt-2">Para pagos duplicados, pedidos cobrados no entregados o emergencias de entrega, usa WhatsApp o llamada.</p></div>
          </aside>
        </div>
      </main>
    </div>
  );
};

export default Support;
