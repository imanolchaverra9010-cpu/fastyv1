import { Link } from "react-router-dom";
import { ArrowLeft, FileText, ShieldCheck, Truck, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";

const Terms = () => {
  return (
    <div className="min-h-screen bg-gradient-warm pb-20">
      <main className="container max-w-4xl pt-10">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="h-4 w-4" /> Volver al inicio
        </Link>
        <div className="bg-card border rounded-3xl p-8 md:p-12 shadow-glow">
          <div className="flex items-center gap-4 mb-8">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-soft">
              <FileText className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold tracking-tight">Términos y condiciones</h1>
              <p className="text-muted-foreground">Condiciones de uso de la plataforma Fasty.</p>
            </div>
          </div>
          <div className="space-y-8 text-muted-foreground leading-relaxed">
            <section><h2 className="text-xl font-bold text-foreground flex items-center gap-2 mb-3"><ShieldCheck className="h-5 w-5 text-primary" /> Uso de la plataforma</h2><p>Al usar Fasty aceptas utilizar la plataforma de forma lícita, suministrar información real para entregas y no realizar pedidos fraudulentos.</p></section>
            <section><h2 className="text-xl font-bold text-foreground flex items-center gap-2 mb-3"><Truck className="h-5 w-5 text-primary" /> Pedidos y entregas</h2><p>Los tiempos estimados son aproximados y pueden variar por disponibilidad del negocio, tráfico, clima, ubicación o disponibilidad de domiciliarios.</p></section>
            <section><h2 className="text-xl font-bold text-foreground flex items-center gap-2 mb-3"><CreditCard className="h-5 w-5 text-primary" /> Pagos y reembolsos</h2><p>Los pagos digitales son procesados por proveedores externos. En caso de fallas o cobros no reconocidos, el usuario debe contactar soporte para revisión del caso.</p></section>
            <section className="bg-muted/30 p-6 rounded-2xl border border-border/50"><h2 className="text-lg font-bold text-foreground mb-2">Soporte</h2><p className="text-sm">Para reclamos, cancelaciones, problemas de pago o solicitudes de datos, utiliza el canal de soporte de la plataforma.</p></section>
          </div>
          <div className="mt-12 pt-8 border-t border-border/60 flex justify-center"><Button asChild variant="soft" className="rounded-xl px-8"><Link to="/">Aceptar y volver</Link></Button></div>
        </div>
      </main>
    </div>
  );
};

export default Terms;
