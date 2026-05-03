import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Plus, Trash2, Loader2, Info, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { CATEGORIES } from "@/constants/categories";
import { getPositionErrorMessage, getPreciseCurrentPosition } from "@/utils/geolocation";

type Item = { name: string; price: string; desc: string };

const BusinessRegister = () => {
  const [items, setItems] = useState<Item[]>([{ name: "", price: "", desc: "" }]);
  const [submitted, setSubmitted] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");

  const update = (i: number, key: keyof Item, value: string) =>
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, [key]: value } : it)));

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [coords, setCoords] = useState<{ lat: number | null; lng: number | null }>({ lat: null, lng: null });
  const [gettingLocation, setGettingLocation] = useState(false);
  
  const getCurrentLocation = () => {
    setGettingLocation(true);
    getPreciseCurrentPosition({ desiredAccuracy: 20, fallbackAccuracy: 70, timeout: 18000 })
      .then((position) => {
          setCoords({
            lat: position.latitude,
            lng: position.longitude
          });
          
          // Reverse geocoding to get address
          fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${position.latitude}&lon=${position.longitude}`, {
            headers: { 'Accept-Language': 'es' }
          })
          .then(res => res.json())
          .then(data => {
            if (data.display_name) {
              const addressInput = document.getElementById("address") as HTMLInputElement;
              if (addressInput) addressInput.value = data.display_name;
              toast({ title: "Dirección obtenida", description: "Se ha actualizado la dirección automáticamente." });
            }
          })
          .catch(err => console.error("Reverse geocoding error:", err))
          .finally(() => setGettingLocation(false));
          
          toast({ title: "Ubicación precisa obtenida", description: `Coordenadas guardadas. Precisión aprox: ${Math.round(position.accuracy || 0)} m.` });
        })
        .catch((error) => {
          console.error("Error getting location:", error);
          setGettingLocation(false);
          toast({ 
            title: "Error de ubicación", 
            description: getPositionErrorMessage(error),
            variant: "destructive"
          });
        });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/businesses/requests/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Error al subir la imagen");
      
      const data = await response.json();
      setImageUrl(data.image_url);
      toast({ title: "Imagen subida", description: "La imagen se ha cargado correctamente." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors({});

    const formData = new FormData(e.target as HTMLFormElement);
    const data = {
      name: formData.get("name"),
      category: selectedCategory,
      address: formData.get("address"),
      phone: formData.get("phone"),
      email: formData.get("email"),
      password: formData.get("password"),
      description: formData.get("description"),
      image_url: imageUrl,
      latitude: coords.lat,
      longitude: coords.lng,
      menu_json: items.filter(it => it.name && it.price)
    };

    try {
      const response = await fetch("/api/businesses/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.detail && typeof errorData.detail === 'object') {
          setFieldErrors(errorData.detail.fields || {});
          throw new Error(errorData.detail.message || "Error al enviar la solicitud");
        }
        throw new Error(errorData.detail || "Error al enviar la solicitud");
      }

      setSubmitted(true);
      toast({ title: "¡Solicitud enviada!", description: "Lo revisaremos en menos de 24h." });
    } catch (err: any) {
      setError(err.message);
      toast({ title: "Error", description: err.message, variant: "destructive" });
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
          <h1 className="mt-6 text-4xl font-display font-bold">¡Solicitud enviada!</h1>
          <p className="mt-3 text-muted-foreground">Recibirás un correo en cuanto aprobemos tu negocio. Mientras tanto, explora la plataforma.</p>
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild variant="hero"><Link to="/negocios">Ver negocios</Link></Button>
            <Button asChild variant="soft"><Link to="/">Volver al inicio</Link></Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-warm">
      <main className="container py-10 max-w-3xl">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> Inicio
        </Link>

        <div className="mb-8 p-4 rounded-2xl bg-primary/10 border border-primary/20 flex items-center gap-4 animate-in slide-in-from-top duration-500">
          <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <Info className="h-5 w-5 text-primary" />
          </div>
          <p className="text-sm font-medium text-foreground leading-relaxed">
            <span className="font-bold block text-primary">¿Eres un cliente?</span>
            Para iniciar sesión como cliente y hacer pedidos, por favor{" "}
            <Link to="/login" className="underline font-bold text-primary hover:opacity-80 transition-colors">
              inicia sesión con Google o Facebook aquí
            </Link>.
          </p>
        </div>

        <h1 className="text-4xl font-display font-bold tracking-tight">Registra tu negocio</h1>
        <p className="text-muted-foreground mt-2">Completa la información y empieza a recibir pedidos.</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-8">
          <section className="rounded-2xl bg-card border border-border/60 p-6 shadow-card">
            <h2 className="text-lg font-bold mb-4">Información del negocio</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name" className={fieldErrors.name ? "text-destructive" : ""}>Nombre del negocio</Label>
                <Input
                  id="name"
                  name="name"
                  required
                  placeholder="Ej. La Brasa Dorada"
                  className={fieldErrors.name ? "border-destructive ring-destructive" : ""}
                />
                {fieldErrors.name && <p className="text-xs text-destructive font-medium">{fieldErrors.name}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Categoría</Label>
                <select
                  id="category"
                  name="category_select"
                  required
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="" disabled>Selecciona una categoría</option>
                  {CATEGORIES.map(cat => (
                    <option key={cat.name} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="business_image">Imagen del negocio</Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="business_image"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploadingImage}
                    className="cursor-pointer"
                  />
                  {imageUrl && (
                    <div className="h-12 w-12 rounded-lg overflow-hidden border border-border shrink-0">
                      <img src={imageUrl.startsWith("http") ? imageUrl : (imageUrl.startsWith("/api") ? imageUrl : `/api${imageUrl}`)} alt="Preview" className="h-full w-full object-cover" />
                    </div>
                  )}
                  {uploadingImage && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
                </div>
                <p className="text-xs text-muted-foreground">Sube una foto de tu fachada o logo (JPG, PNG o WebP).</p>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="address">Dirección</Label>
                <Input id="address" name="address" required placeholder="Calle, número, ciudad" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input id="phone" name="phone" required type="tel" placeholder="+57 300 000 0000" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className={fieldErrors.email ? "text-destructive" : ""}>Email</Label>
                <Input
                  id="email"
                  name="email"
                  required
                  type="email"
                  placeholder="hola@negocio.com"
                  className={fieldErrors.email ? "border-destructive ring-destructive" : ""}
                />
                {fieldErrors.email && <p className="text-xs text-destructive font-medium">{fieldErrors.email}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input id="password" name="password" required type="password" placeholder="Tu clave para entrar" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea id="description" name="description" placeholder="Cuéntanos qué hace especial a tu negocio" />
              </div>
              
            <div className="space-y-4 md:col-span-2 border-t border-border/40 pt-4 mt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <Label className="font-bold">Ubicación del negocio</Label>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={getCurrentLocation}
                    disabled={gettingLocation}
                    className="gap-2 w-full sm:w-auto justify-center rounded-xl"
                  >
                    {gettingLocation ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                    {gettingLocation ? "Obteniendo..." : "Obtener mi ubicación actual"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Esto es necesario para calcular las tarifas de envío por distancia.</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="latitude">Latitud</Label>
                    <Input 
                      id="latitude" 
                      type="number" 
                      step="any" 
                      placeholder="0.000000" 
                      value={coords.lat || ""} 
                      onChange={(e) => setCoords(prev => ({ ...prev, lat: parseFloat(e.target.value) || null }))}
                      className="rounded-xl h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="longitude">Longitud</Label>
                    <Input 
                      id="longitude" 
                      type="number" 
                      step="any" 
                      placeholder="0.000000" 
                      value={coords.lng || ""} 
                      onChange={(e) => setCoords(prev => ({ ...prev, lng: parseFloat(e.target.value) || null }))}
                      className="rounded-xl h-11"
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl bg-card border border-border/60 p-6 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Tu menú inicial</h2>
              <Button type="button" variant="soft" size="sm" onClick={() => setItems((a) => [...a, { name: "", price: "", desc: "" }])}>
                <Plus className="h-4 w-4" /> Añadir producto
              </Button>
            </div>

            <div className="space-y-3">
              {items.map((it, i) => (
                <div key={i} className="flex flex-col gap-3 p-4 rounded-xl bg-muted/40 relative">
                  <div className="grid sm:grid-cols-[1fr_120px] gap-3">
                    <Input placeholder="Nombre" value={it.name} onChange={(e) => update(i, "name", e.target.value)} className="rounded-lg h-10" />
                    <Input placeholder="Precio" inputMode="numeric" value={it.price} onChange={(e) => update(i, "price", e.target.value)} className="rounded-lg h-10" />
                  </div>
                  <div className="flex gap-2">
                    <Input placeholder="Descripción" value={it.desc} onChange={(e) => update(i, "desc", e.target.value)} className="flex-1 rounded-lg h-10" />
                    <Button type="button" variant="ghost" size="icon" onClick={() => setItems((a) => a.filter((_, idx) => idx !== i))} disabled={items.length === 1} className="shrink-0 h-10 w-10 text-destructive hover:bg-destructive/10 rounded-lg">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="soft" asChild><Link to="/">Cancelar</Link></Button>
            <Button type="submit" variant="hero" size="lg" disabled={loading}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Procesando...</> : "Enviar solicitud"}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
};

export default BusinessRegister;
