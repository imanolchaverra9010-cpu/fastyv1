import { useState, useEffect } from "react";
import {
  Image as ImageIcon,
  Plus,
  Trash2,
  Edit,
  UploadCloud,
  X,
  Check,
  Loader2,
  Eye,
  EyeOff,
  ExternalLink,
  Sparkles
} from "lucide-react";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

interface Banner {
  id: number;
  slot_position: string;
  tag?: string;
  title: string;
  subtitle?: string;
  button_text?: string;
  redirect_url?: string;
  image_url: string;
  bg_gradient?: string;
  text_color?: string;
  is_active: boolean;
}

const slotOptions = [
  { value: "left", label: "Izquierdo (Grande - Fallback Samsung)", dimensions: "Recomendado: 800x800px" },
  { value: "right_top", label: "Derecho Superior (Mediano - Fallback Gaming)", dimensions: "Recomendado: 600x300px" },
  { value: "right_bottom", label: "Derecho Inferior (Mediano - Fallback Muebles)", dimensions: "Recomendado: 600x300px" }
];

const textColors = [
  { value: "text-white", label: "Claro (Texto Blanco)", preview: "bg-slate-900 text-white" },
  { value: "text-slate-800", label: "Oscuro (Texto Carbón)", preview: "bg-slate-100 text-slate-800" }
];

const gradientPresets = [
  { name: "Sleek Dark (Negro Premium)", value: "bg-gradient-to-br from-[#0c0f1d] via-[#10152a] to-[#151c38]" },
  { name: "Neon Violet (Púrpura Eléctrico)", value: "bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900" },
  { name: "Ocean Breeze (Teal Profundo)", value: "bg-gradient-to-br from-teal-900 via-cyan-900 to-sky-950" },
  { name: "Sunset Ember (Cálido Premium)", value: "bg-gradient-to-br from-orange-950 via-red-950 to-rose-950" },
  { name: "Emerald Forest (Verde Lujoso)", value: "bg-gradient-to-br from-emerald-950 via-teal-950 to-green-950" },
  { name: "Carbon Fiber (Gris Oscuro)", value: "bg-gradient-to-br from-slate-900 to-slate-950" },
  { name: "Fasty Orange (Original Fasty)", value: "bg-gradient-to-br from-orange-500 via-orange-600 to-red-600" }
];

export default function AdminBanners() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);

  // Form states
  const [slotPosition, setSlotPosition] = useState("left");
  const [tag, setTag] = useState("");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [buttonText, setButtonText] = useState("");
  const [redirectUrl, setRedirectUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [bgGradient, setBgGradient] = useState("bg-gradient-to-br from-[#0c0f1d] via-[#10152a] to-[#151c38]");
  const [textColor, setTextColor] = useState("text-white");
  const [isActive, setIsActive] = useState(true);

  // Upload image states
  const [uploadingImage, setUploadingImage] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Load existing banners
  const fetchBanners = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/banners/admin");
      if (res.ok) {
        const data = await res.json();
        setBanners(data);
      } else {
        toast({
          title: "Error al cargar banners",
          description: "Hubo un problema al consultar la base de datos.",
          variant: "destructive"
        });
      }
    } catch (err) {
      console.error(err);
      toast({
        title: "Error de red",
        description: "No se pudo conectar con el servidor.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBanners();
  }, []);

  const resetForm = () => {
    setEditingBanner(null);
    setSlotPosition("left");
    setTag("");
    setTitle("");
    setSubtitle("");
    setButtonText("");
    setRedirectUrl("");
    setImageUrl("");
    setBgGradient("bg-gradient-to-br from-[#0c0f1d] via-[#10152a] to-[#151c38]");
    setTextColor("text-white");
    setIsActive(true);
  };

  const handleEditClick = (banner: Banner) => {
    setEditingBanner(banner);
    setSlotPosition(banner.slot_position);
    setTag(banner.tag || "");
    setTitle(banner.title);
    setSubtitle(banner.subtitle || "");
    setButtonText(banner.button_text || "");
    setRedirectUrl(banner.redirect_url || "");
    setImageUrl(banner.image_url);
    setBgGradient(banner.bg_gradient || "bg-gradient-to-br from-[#0c0f1d] via-[#10152a] to-[#151c38]");
    setTextColor(banner.text_color || "text-white");
    setIsActive(banner.is_active);
    setIsFormOpen(true);
  };

  // Image upload handler
  const handleImageFile = async (file: File) => {
    setUploadingImage(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/banners/admin/upload-image", {
        method: "POST",
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        if (data.image_url) {
          setImageUrl(data.image_url);
          toast({
            title: "Imagen subida",
            description: "La imagen se procesó y guardó con éxito."
          });
        }
      } else {
        const errData = await res.json();
        toast({
          title: "Error al subir",
          description: errData.detail || "La imagen excede el límite o el formato es inválido.",
          variant: "destructive"
        });
      }
    } catch (err) {
      console.error(err);
      toast({
        title: "Error de red",
        description: "No se pudo comunicar con el endpoint de carga.",
        variant: "destructive"
      });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleImageFile(e.target.files[0]);
    }
  };

  // Submit Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !imageUrl) {
      toast({
        title: "Campos incompletos",
        description: "El título y la imagen del banner son obligatorios.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    const payload = {
      slot_position: slotPosition,
      tag: tag || null,
      title,
      subtitle: subtitle || null,
      button_text: buttonText || null,
      redirect_url: redirectUrl || null,
      image_url: imageUrl,
      bg_gradient: bgGradient || null,
      text_color: textColor,
      is_active: isActive
    };

    try {
      let res;
      if (editingBanner) {
        res = await fetch(`/api/banners/admin/${editingBanner.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch("/api/banners/admin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      }

      if (res.ok) {
        toast({
          title: editingBanner ? "Banner modificado" : "Banner creado",
          description: "La base de datos se ha actualizado correctamente."
        });
        setIsFormOpen(false);
        resetForm();
        fetchBanners();
      } else {
        toast({
          title: "Error al guardar",
          description: "Hubo un problema al procesar la solicitud.",
          variant: "destructive"
        });
      }
    } catch (err) {
      console.error(err);
      toast({
        title: "Error de red",
        description: "Inténtalo de nuevo más tarde.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete banner
  const handleDelete = async (id: number) => {
    if (!confirm("¿Estás seguro de que deseas eliminar permanentemente este banner?")) return;

    try {
      const res = await fetch(`/api/banners/admin/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        toast({
          title: "Banner eliminado",
          description: "El banner se removió de la base de datos."
        });
        fetchBanners();
      } else {
        toast({
          title: "Error al eliminar",
          description: "No se pudo completar la operación.",
          variant: "destructive"
        });
      }
    } catch (err) {
      console.error(err);
      toast({
        title: "Error de red",
        description: "Inténtalo de nuevo.",
        variant: "destructive"
      });
    }
  };

  // Toggle active
  const handleToggleActive = async (banner: Banner) => {
    try {
      const res = await fetch(`/api/banners/admin/${banner.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !banner.is_active })
      });
      if (res.ok) {
        toast({
          title: "Estado modificado",
          description: `Banner ${!banner.is_active ? "activado" : "desactivado"} exitosamente.`
        });
        fetchBanners();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-gradient-warm">
        <AdminSidebar />
        <SidebarInset className="flex-1 bg-transparent">
          {/* Header */}
          <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-border/60 bg-background/75 backdrop-blur-xl px-4 md:px-6">
            <SidebarTrigger className="-ml-1" />
            <div className="h-4 w-px bg-border/60 mx-2" />
            <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-primary" />
              Banners Promocionales
            </h2>
          </header>

          {/* Body Content */}
          <main className="p-4 md:p-8 max-w-7xl mx-auto w-full space-y-8">
            {/* Page Title & Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-xs md:text-sm text-primary font-semibold">Administración</p>
                <h1 className="text-2xl md:text-4xl font-display font-bold tracking-tight">Banners y Carruseles</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Crea y gestiona las campañas promocionales que se muestran dinámicamente en la página de inicio.
                </p>
              </div>
              <Button
                onClick={() => {
                  resetForm();
                  setIsFormOpen(true);
                }}
                className="w-full sm:w-auto bg-primary hover:bg-primary/95 text-white shadow-glow hover:scale-[1.01] active:scale-[0.99] transition-all font-bold h-12 rounded-2xl flex items-center gap-2 px-6"
              >
                <Plus className="h-5 w-5" />
                Nuevo Banner
              </Button>
            </div>
              
            {/* Premium Hero Stats Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 rounded-3xl bg-card border border-border/60 shadow-card flex items-center gap-4 hover:shadow-glow transition-all duration-300">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black shrink-0">
                  {banners.filter(b => b.slot_position === 'left').length}
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Slot Izquierdo</h3>
                  <p className="text-xs text-muted-foreground mt-1">Sustituye Samsung. Si hay &gt;1, se vuelve carrusel.</p>
                </div>
              </div>

              <div className="p-6 rounded-3xl bg-card border border-border/60 shadow-card flex items-center gap-4 hover:shadow-glow transition-all duration-300">
                <div className="h-12 w-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-cyan-500 font-black shrink-0">
                  {banners.filter(b => b.slot_position === 'right_top').length}
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Slot Derecho Sup.</h3>
                  <p className="text-xs text-muted-foreground mt-1">Sustituye Gaming. Si hay &gt;1, se vuelve carrusel.</p>
                </div>
              </div>

              <div className="p-6 rounded-3xl bg-card border border-border/60 shadow-card flex items-center gap-4 hover:shadow-glow transition-all duration-300">
                <div className="h-12 w-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-500 font-black shrink-0">
                  {banners.filter(b => b.slot_position === 'right_bottom').length}
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Slot Derecho Inf.</h3>
                  <p className="text-xs text-muted-foreground mt-1">Sustituye Muebles. Si hay &gt;1, se vuelve carrusel.</p>
                </div>
              </div>
            </div>

            {/* Banners Listing Table/Cards */}
            {isLoading ? (
              <div className="h-64 flex flex-col items-center justify-center text-muted-foreground gap-3 bg-card border border-border/60 rounded-3xl shadow-card">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-xs font-bold">Consultando base de datos...</p>
              </div>
            ) : banners.length === 0 ? (
              <div className="border border-dashed border-border/80 rounded-3xl p-12 text-center text-muted-foreground space-y-4 max-w-xl mx-auto bg-card/40 backdrop-blur-sm">
                <div className="h-20 w-20 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground/60 mx-auto shadow-inner">
                  <ImageIcon className="h-10 w-10" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">No hay banners configurados</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    El cliente mostrará los banners predeterminados premium de Fasty. ¡Sube tu primera promoción ahora mismo!
                  </p>
                </div>
                <Button
                  onClick={() => {
                    resetForm();
                    setIsFormOpen(true);
                  }}
                  className="bg-primary hover:bg-primary/95 text-white font-bold rounded-2xl h-11 px-6 shadow-glow"
                >
                  Crear Primer Banner
                </Button>
              </div>
            ) : (
              <div className="rounded-3xl border border-border/60 bg-card shadow-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border/40 text-muted-foreground font-semibold text-xs uppercase tracking-wider">
                        <th className="px-6 py-4">Banner</th>
                        <th className="px-6 py-4">Slot / Ubicación</th>
                        <th className="px-6 py-4">Estilo Fondo</th>
                        <th className="px-6 py-4 text-center">Estado</th>
                        <th className="px-6 py-4 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30 bg-card text-foreground">
                      {banners.map((banner) => (
                        <tr key={banner.id} className="hover:bg-muted/10 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-4">
                              <div 
                                className={`h-12 w-20 rounded-xl overflow-hidden border border-border/40 shrink-0 relative flex items-center justify-center p-1 ${
                                  (banner.bg_gradient && !banner.bg_gradient.startsWith('#') && !banner.bg_gradient.startsWith('rgb') && !banner.bg_gradient.startsWith('linear-gradient')) 
                                    ? banner.bg_gradient 
                                    : !banner.bg_gradient 
                                    ? "bg-muted" 
                                    : ""
                                }`}
                                style={banner.bg_gradient && (banner.bg_gradient.startsWith('#') || banner.bg_gradient.startsWith('rgb') || banner.bg_gradient.startsWith('linear-gradient')) ? { background: banner.bg_gradient } : undefined}
                              >
                                <img
                                  src={banner.image_url}
                                  alt={banner.title}
                                  className="max-h-full max-w-full object-contain filter drop-shadow-md transition-transform duration-300 hover:scale-105"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = "https://placehold.co/120x80/e2e8f0/64748b?text=Img";
                                  }}
                                />
                              </div>
                              <div className="max-w-[240px] overflow-hidden">
                                {banner.tag && (
                                  <span className="text-[10px] font-black px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 uppercase tracking-widest block w-max leading-none">
                                    {banner.tag}
                                  </span>
                                )}
                                <p className="font-bold text-foreground truncate mt-1">{banner.title}</p>
                                {banner.subtitle && (
                                  <p className="text-xs text-muted-foreground truncate">{banner.subtitle}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-bold text-foreground block">
                              {banner.slot_position === "left"
                                ? "Izquierdo (Grande)"
                                : banner.slot_position === "right_top"
                                ? "Derecho Superior"
                                : "Derecho Inferior"}
                            </span>
                            {banner.redirect_url && (
                              <a
                                href={banner.redirect_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1 font-mono font-medium"
                              >
                                Ver link <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </td>
                          <td className="px-6 py-4 font-mono text-xs max-w-[200px]">
                            <div className="flex items-center gap-2">
                              <span 
                                className={`h-5 w-10 rounded-lg border border-white/10 ${
                                  (banner.bg_gradient && !banner.bg_gradient.startsWith('#') && !banner.bg_gradient.startsWith('rgb') && !banner.bg_gradient.startsWith('linear-gradient')) 
                                    ? banner.bg_gradient 
                                    : !banner.bg_gradient 
                                    ? "bg-slate-800" 
                                    : ""
                                }`}
                                style={banner.bg_gradient && (banner.bg_gradient.startsWith('#') || banner.bg_gradient.startsWith('rgb') || banner.bg_gradient.startsWith('linear-gradient')) ? { background: banner.bg_gradient } : undefined}
                              />
                              <span className="text-muted-foreground truncate w-[140px] block font-medium">
                                {banner.bg_gradient || "Por defecto"}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => handleToggleActive(banner)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                                banner.is_active
                                  ? "bg-success/10 text-success border border-success/20 hover:bg-success/20"
                                  : "bg-muted text-muted-foreground border border-border/60 hover:bg-muted/80"
                              }`}
                            >
                              {banner.is_active ? (
                                <>
                                  <Eye className="h-3.5 w-3.5" /> Visible
                                </>
                              ) : (
                                <>
                                  <EyeOff className="h-3.5 w-3.5" /> Oculto
                                </>
                              )}
                            </button>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditClick(banner)}
                                className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl"
                              >
                                <Edit className="h-4.5 w-4.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(banner.id)}
                                className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl"
                              >
                                <Trash2 className="h-4.5 w-4.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </main>

          {/* Modal / Dialog Form Overlay */}
          {isFormOpen && (
            <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 md:p-8">
              <div className="relative w-full max-w-2xl bg-card border border-border/60 rounded-[2.5rem] overflow-hidden shadow-glow my-auto animate-in fade-in zoom-in-95 duration-200">
                
                {/* Modal Header */}
                <div className="p-6 border-b border-border/40 bg-muted/20 flex items-center justify-between">
                  <h2 className="text-xl font-display font-bold text-foreground flex items-center gap-2">
                    <Sparkles className="text-primary h-5 w-5 animate-pulse" />
                    {editingBanner ? "Modificar Banner" : "Nuevo Banner Promocional"}
                  </h2>
                  <button
                    onClick={() => {
                      setIsFormOpen(false);
                      resetForm();
                    }}
                    className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                  
                  {/* Grid fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    
                    {/* Position Selector */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Ubicación / Slot</label>
                      <select
                        value={slotPosition}
                        onChange={(e) => setSlotPosition(e.target.value)}
                        className="flex h-11 w-full rounded-xl border border-border/60 bg-transparent px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 text-foreground font-semibold"
                      >
                        {slotOptions.map((opt) => (
                          <option key={opt.value} value={opt.value} className="bg-card text-foreground">
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] text-muted-foreground font-medium italic">
                        {slotOptions.find(o => o.value === slotPosition)?.dimensions}
                      </p>
                    </div>

                    {/* Active State */}
                    <div className="space-y-2 flex flex-col justify-end">
                      <div className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-background/50 h-11">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">¿Mostrar en tienda?</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isActive}
                            onChange={(e) => setIsActive(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                      </div>
                    </div>

                    {/* Tag overlay */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Etiqueta (Tag)</label>
                      <Input
                        type="text"
                        placeholder="Ej. SAMSUNG PREMIUM o ÚLTIMO MODELO"
                        value={tag}
                        onChange={(e) => setTag(e.target.value)}
                        className="rounded-xl h-11 border-border/60 focus-visible:ring-primary/20 font-medium"
                      />
                    </div>

                    {/* Main Title */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Título Principal</label>
                      <Input
                        type="text"
                        placeholder="Ej. Galaxy S24 Ultra o Gaming Fest"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="rounded-xl h-11 border-border/60 focus-visible:ring-primary/20 font-medium"
                        required
                      />
                    </div>

                    {/* Subtitle description */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Subtítulo o Descripción corta</label>
                      <Input
                        type="text"
                        placeholder="Ej. Hasta 30% OFF en tecnología"
                        value={subtitle}
                        onChange={(e) => setSubtitle(e.target.value)}
                        className="rounded-xl h-11 border-border/60 focus-visible:ring-primary/20 font-medium"
                      />
                    </div>

                    {/* Button Text */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Texto del Botón</label>
                      <Input
                        type="text"
                        placeholder="Ej. Comprar Ahora o Clic aquí"
                        value={buttonText}
                        onChange={(e) => setButtonText(e.target.value)}
                        className="rounded-xl h-11 border-border/60 focus-visible:ring-primary/20 font-medium"
                      />
                    </div>

                    {/* Redirect URL */}
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Link de Redirección (Link en la plataforma)</label>
                      <Input
                        type="text"
                        placeholder="Ej. /negocios?category=Tecnologia o /negocios/samsung-store"
                        value={redirectUrl}
                        onChange={(e) => setRedirectUrl(e.target.value)}
                        className="rounded-xl h-11 border-border/60 focus-visible:ring-primary/20 font-mono text-sm font-medium"
                      />
                    </div>

                    {/* Image URL with Paste & Drag Drop Container */}
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Foto del Producto (PNG transparente recomendado)</label>
                      
                      {/* Paste URL directly */}
                      <Input
                        type="text"
                        placeholder="Pega la URL absoluta de una imagen o usa el contenedor de abajo para subir un archivo"
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        className="rounded-xl h-11 border-border/60 focus-visible:ring-primary/20 text-xs font-mono mb-2 font-medium"
                      />

                      {/* Drag & Drop */}
                      <div
                        onDragEnter={handleDrag}
                        onDragOver={handleDrag}
                        onDragLeave={handleDrag}
                        onDrop={handleDrop}
                        className={`h-36 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 p-4 transition-all relative ${
                          dragActive
                            ? "border-primary bg-primary/5 text-primary scale-[1.01]"
                            : imageUrl
                            ? "border-success/40 bg-success/5 text-foreground"
                            : "border-border/60 bg-muted/10 text-muted-foreground hover:border-muted hover:bg-muted/20"
                        }`}
                      >
                        {uploadingImage ? (
                          <>
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-xs font-bold">Subiendo imagen al servidor...</p>
                          </>
                        ) : imageUrl ? (
                          <div className="flex items-center gap-4 w-full justify-center">
                            <div className="h-16 w-24 rounded-lg overflow-hidden border border-border/60 bg-white shrink-0">
                              <img src={imageUrl} alt="Thumbnail" className="w-full h-full object-contain" />
                            </div>
                            <div className="text-left max-w-xs">
                              <p className="text-xs text-success font-bold flex items-center gap-1">
                                <Check className="h-3.5 w-3.5" /> Imagen asignada con éxito
                              </p>
                              <p className="text-[10px] text-muted-foreground truncate font-mono mt-1">{imageUrl}</p>
                              <button
                                type="button"
                                onClick={() => setImageUrl("")}
                                className="text-primary hover:underline text-[11px] font-bold block mt-1"
                              >
                                Reemplazar imagen
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <UploadCloud className="h-8 w-8 text-primary" />
                            <p className="text-xs font-bold text-center">
                              Arrastra tu archivo aquí o{" "}
                              <label className="text-primary hover:underline cursor-pointer font-bold">
                                explora tus archivos
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={handleFileChange}
                                />
                              </label>
                            </p>
                            <p className="text-[10px] text-muted-foreground font-medium">JPG, PNG o WebP. Fondo transparente sugerido.</p>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Gradient background class choice */}
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Estilo del Fondo (Degradado de fondo)</label>
                      <Input
                        type="text"
                        placeholder="Clases CSS o Gradient (ej. bg-gradient-to-r from-teal-900 to-cyan-900)"
                        value={bgGradient}
                        onChange={(e) => setBgGradient(e.target.value)}
                        className="rounded-xl h-11 border-border/60 focus-visible:ring-primary/20 font-mono text-sm mb-2 font-medium"
                      />
                      
                      {/* Presets Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                        {gradientPresets.map((preset) => (
                          <button
                            key={preset.name}
                            type="button"
                            onClick={() => setBgGradient(preset.value)}
                            className={`p-2.5 rounded-xl border text-[11px] font-medium text-left flex flex-col justify-between h-14 hover:scale-[1.02] active:scale-[0.98] transition-all overflow-hidden ${preset.value} ${
                              bgGradient === preset.value
                                ? "border-primary ring-2 ring-primary/20 scale-[1.02] text-white"
                                : "border-border/60 text-slate-300"
                            }`}
                          >
                            <span className="truncate w-full block drop-shadow-md text-white font-bold">{preset.name}</span>
                            <span className="text-[8px] text-white/60 truncate w-full font-mono mt-0.5">{preset.value}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Contrast & Text color choice */}
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Contraste de Texto</label>
                      <div className="grid grid-cols-2 gap-4">
                        {textColors.map((color) => (
                          <button
                            key={color.value}
                            type="button"
                            onClick={() => setTextColor(color.value)}
                            className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold transition-all ${
                              textColor === color.value
                                ? "border-primary ring-2 ring-primary/20 bg-primary/5 text-foreground"
                                : "border-border/60 bg-transparent text-muted-foreground hover:bg-muted/50"
                            }`}
                          >
                            <span>{color.label}</span>
                            <span className={`h-4 w-4 rounded-full border border-border/60 ${color.preview}`} />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Banner LIVE visual preview! */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Vista Previa Interactiva (Fasty Premium Design)</label>
                    <div
                      className={`w-full rounded-2xl p-6 ${textColor} relative overflow-hidden min-h-[160px] flex items-center border border-white/10 ${
                        (bgGradient && !bgGradient.startsWith('#') && !bgGradient.startsWith('rgb') && !bgGradient.startsWith('linear-gradient')) ? bgGradient : ""
                      }`}
                      style={bgGradient && (bgGradient.startsWith('#') || bgGradient.startsWith('rgb') || bgGradient.startsWith('linear-gradient')) ? { background: bgGradient } : undefined}
                    >
                      <div className="max-w-[60%] space-y-2 relative z-10 flex flex-col justify-center h-full">
                        {tag && (
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-white/20 border border-white/10 w-max tracking-widest leading-none block">
                            {tag}
                          </span>
                        )}
                        <h4 className="text-lg md:text-xl font-extrabold tracking-tight drop-shadow-sm leading-tight text-inherit">
                          {title || "Mi Promoción"}
                        </h4>
                        <p className="text-xs text-inherit opacity-90 truncate leading-snug">
                          {subtitle || "Descripción promocional premium..."}
                        </p>
                        <button
                          type="button"
                          className="bg-white hover:scale-[1.02] text-slate-900 text-[11px] font-extrabold rounded-full px-4 py-1.5 w-max shadow-md transition-all mt-1"
                        >
                          {buttonText || "Ver Detalles"}
                        </button>
                      </div>
                      
                      {/* Product image right float */}
                      {imageUrl && (
                        <div className="absolute right-4 bottom-2 top-2 w-[35%] flex items-center justify-center z-10 pointer-events-none">
                          <img
                            src={imageUrl}
                            alt="Preview Product"
                            className="max-h-[90%] max-w-full object-contain filter drop-shadow-2xl transition-all duration-300 hover:scale-105"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "https://placehold.co/120x85/000000/000000?text=";
                            }}
                          />
                        </div>
                      )}

                      {/* Micro background particle bubbles to feel modern */}
                      <div className="absolute -top-10 -right-10 h-36 w-36 rounded-full bg-white/5 blur-2xl pointer-events-none" />
                      <div className="absolute -bottom-8 left-[30%] h-24 w-24 rounded-full bg-black/10 blur-xl pointer-events-none" />
                    </div>
                  </div>

                  {/* Actions buttons */}
                  <div className="pt-4 border-t border-border/40 flex items-center justify-end gap-3">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setIsFormOpen(false);
                        resetForm();
                      }}
                      className="rounded-full text-muted-foreground hover:text-foreground hover:bg-muted font-bold"
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      disabled={isSubmitting || uploadingImage}
                      className="bg-primary hover:bg-primary/95 text-white font-bold rounded-full min-w-[120px] shadow-glow"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                          Guardando...
                        </>
                      ) : editingBanner ? (
                        "Actualizar"
                      ) : (
                        "Crear Banner"
                      )}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
