import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Car, CheckCircle2, Loader2, Info, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";

const VEHICLE_OPTIONS = [
  { value: "Carro", label: "Carro" },
  { value: "Auto", label: "Auto / Sedán" },
  { value: "Camioneta", label: "Camioneta / SUV" },
];

const DriverRegister = () => {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [vehicle, setVehicle] = useState("Carro");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setFieldErrors({});

    const form = new FormData(e.currentTarget);
    const payload = {
      name: form.get("name"),
      email: form.get("email"),
      phone: form.get("phone"),
      password: form.get("password"),
      vehicle,
      vehicle_plate: form.get("vehicle_plate"),
      vehicle_color: form.get("vehicle_color"),
      vehicle_model: form.get("vehicle_model"),
      id_number: form.get("id_number") || null,
      license_number: form.get("license_number") || null,
      notes: form.get("notes") || null,
    };

    try {
      const response = await fetch("/api/rides/driver-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.detail?.fields) {
          setFieldErrors(errorData.detail.fields);
          throw new Error(errorData.detail.message || "Revisa los datos del formulario");
        }
        throw new Error(errorData.detail || "No se pudo enviar la solicitud");
      }
      setSubmitted(true);
      toast({ title: "¡Solicitud enviada!", description: "Revisaremos tu perfil y te avisaremos por email." });
    } catch (err: unknown) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Intenta de nuevo",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-warm">
        <main className="container py-20 max-w-xl text-center">
          <div className="grid place-items-center h-20 w-20 mx-auto rounded-full bg-success/15 text-success">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <h1 className="mt-6 text-4xl font-display font-bold">¡Solicitud recibida!</h1>
          <p className="mt-3 text-muted-foreground">
            Validaremos tus datos y el vehículo. Cuando aprueben tu cuenta podrás iniciar sesión y publicar viajes compartidos.
          </p>
          <div className="mt-8 flex justify-center gap-3 flex-wrap">
            <Button asChild variant="hero"><Link to="/login">Ir a iniciar sesión</Link></Button>
            <Button asChild variant="soft"><Link to="/">Volver al inicio</Link></Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-warm pb-20">
      <main className="container py-10 max-w-3xl">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> Inicio
        </Link>

        <div className="mb-8 p-4 rounded-2xl bg-primary/10 border border-primary/20 flex items-start gap-4">
          <ShieldCheck className="h-6 w-6 text-primary shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-bold text-primary">Registro de conductor — Fasty Viajes</p>
            <p className="text-muted-foreground mt-1">
              Publica rutas fijas (ej. Parque → Universidad) y los pasajeros reservan cupos. Solo vehículos tipo carro.
              Tras aprobar tu solicitud, un administrador verificará tu perfil para activar la publicación de viajes.
            </p>
          </div>
        </div>

        <h1 className="text-4xl font-display font-bold tracking-tight flex items-center gap-3">
          <Car className="h-9 w-9 text-primary" /> Regístrate como conductor
        </h1>
        <p className="text-muted-foreground mt-2">Completa tus datos personales y del vehículo.</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-8">
          <section className="rounded-2xl bg-card border border-border/60 p-6 shadow-card space-y-4">
            <h2 className="text-lg font-bold">Datos personales</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="name">Nombre completo</Label>
                <Input id="name" name="name" required placeholder="Ej. Juan Pérez" className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className={fieldErrors.email ? "text-destructive" : ""}>Email</Label>
                <Input id="email" name="email" type="email" required placeholder="tu@email.com" className={`rounded-xl ${fieldErrors.email ? "border-destructive" : ""}`} />
                {fieldErrors.email && <p className="text-xs text-destructive">{fieldErrors.email}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono / WhatsApp</Label>
                <Input id="phone" name="phone" type="tel" required placeholder="+57 300 000 0000" className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="id_number">Cédula (opcional)</Label>
                <Input id="id_number" name="id_number" placeholder="Documento de identidad" className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input id="password" name="password" type="password" required minLength={6} placeholder="Mínimo 6 caracteres" className="rounded-xl" />
              </div>
            </div>
          </section>

          <section className="rounded-2xl bg-card border border-border/60 p-6 shadow-card space-y-4">
            <h2 className="text-lg font-bold">Datos del vehículo</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vehicle">Tipo de vehículo</Label>
                <select
                  id="vehicle"
                  value={vehicle}
                  onChange={(e) => setVehicle(e.target.value)}
                  className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                  required
                >
                  {VEHICLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="vehicle_plate">Placa</Label>
                <Input id="vehicle_plate" name="vehicle_plate" required placeholder="ABC123" className="rounded-xl uppercase" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vehicle_model">Marca y modelo</Label>
                <Input id="vehicle_model" name="vehicle_model" required placeholder="Ej. Chevrolet Spark" className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vehicle_color">Color</Label>
                <Input id="vehicle_color" name="vehicle_color" required placeholder="Ej. Blanco" className="rounded-xl" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="license_number">Licencia de conducción (opcional)</Label>
                <Input id="license_number" name="license_number" placeholder="Número de licencia" className="rounded-xl" />
              </div>
            </div>
          </section>

          <section className="rounded-2xl bg-card border border-border/60 p-6 shadow-card space-y-4">
            <h2 className="text-lg font-bold">Información adicional</h2>
            <Textarea id="notes" name="notes" placeholder="Cuéntanos tu experiencia, rutas que sueles hacer, horarios..." className="rounded-xl min-h-[100px]" />
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <p>Al enviar aceptas que Fasty verifique tu información antes de habilitarte como conductor verificado.</p>
            </div>
          </section>

          <div className="flex flex-wrap justify-end gap-3">
            <Button type="button" variant="soft" asChild><Link to="/viajes">Cancelar</Link></Button>
            <Button type="submit" variant="hero" size="lg" disabled={loading} className="rounded-xl">
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...</> : "Enviar solicitud"}
            </Button>
          </div>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-8">
          ¿Ya tienes cuenta? <Link to="/login" className="text-primary font-semibold hover:underline">Inicia sesión</Link>
        </p>
      </main>
    </div>
  );
};

export default DriverRegister;
