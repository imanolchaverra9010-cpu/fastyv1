import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck, Lock, Eye, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

const PrivacyPolicy = () => {
  const lastUpdated = "26 de abril de 2024";

  return (
    <div className="min-h-screen bg-gradient-warm pb-20">
      <main className="container max-w-4xl pt-10">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="h-4 w-4" /> Volver al inicio
        </Link>

        <div className="bg-card border rounded-3xl p-8 md:p-12 shadow-glow animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center gap-4 mb-8">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-soft">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold tracking-tight">Política de Privacidad</h1>
              <p className="text-muted-foreground">Última actualización: {lastUpdated}</p>
            </div>
          </div>

          <div className="prose prose-orange max-w-none space-y-8 text-muted-foreground leading-relaxed">
            <section>
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2 mb-3">
                <Lock className="h-5 w-5 text-primary" /> 1. Introducción
              </h2>
              <p>
                En <strong>Fasty</strong>, valoramos su privacidad y estamos comprometidos con la protección de sus datos personales. Esta política explica cómo recopilamos, usamos y protegemos su información cuando utiliza nuestra plataforma de domicilios.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2 mb-3">
                <Eye className="h-5 w-5 text-primary" /> 2. Información que Recopilamos
              </h2>
              <p>
                Para proporcionar nuestros servicios, podemos recopilar la siguiente información:
              </p>
              <ul className="list-disc pl-5 space-y-2 mt-2">
                <li><strong>Información de cuenta:</strong> Nombre, correo electrónico y foto de perfil (cuando utiliza inicio de sesión con Google o Facebook).</li>
                <li><strong>Información de entrega:</strong> Dirección de entrega y número de teléfono.</li>
                <li><strong>Ubicación:</strong> Coordenadas GPS en tiempo real para el rastreo de pedidos y asignación de domiciliarios.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2 mb-3">
                <FileText className="h-5 w-5 text-primary" /> 3. Uso de la Información
              </h2>
              <p>
                Utilizamos los datos recopilados para:
              </p>
              <ul className="list-disc pl-5 space-y-2 mt-2">
                <li>Gestionar y entregar sus pedidos de manera eficiente.</li>
                <li>Permitir que los domiciliarios encuentren su ubicación exacta.</li>
                <li>Mejorar nuestros servicios y personalizar su experiencia.</li>
                <li>Garantizar la seguridad de las transacciones dentro de la plataforma.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2 mb-3">
                <ShieldCheck className="h-5 w-5 text-primary" /> 4. Protección de Datos
              </h2>
              <p>
                Implementamos medidas de seguridad técnicas y organizativas para proteger sus datos contra el acceso no autorizado, la alteración o la destrucción. Sus contraseñas son encriptadas utilizando algoritmos de última generación (Bcrypt).
              </p>
            </section>

            <section className="bg-muted/30 p-6 rounded-2xl border border-border/50">
              <h2 className="text-lg font-bold text-foreground mb-2">Contacto</h2>
              <p className="text-sm">
                Si tiene preguntas sobre esta política o desea ejercer sus derechos de acceso, rectificación o eliminación de datos, puede contactarnos a través de nuestro soporte técnico.
              </p>
            </section>
          </div>

          <div className="mt-12 pt-8 border-t border-border/60 flex justify-center">
            <Button asChild variant="soft" className="rounded-xl px-8">
              <Link to="/">Aceptar y volver</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PrivacyPolicy;
