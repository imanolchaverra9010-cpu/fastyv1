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
      <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
        <AdminSidebar />
        <SidebarInset className="flex flex-col flex-1 overflow-hidden bg-slate-950">
          {/* Header */}
          <header className="flex h-16 shrink-0 items-center justify-between gap-2 px-6 border-b border-slate-800/60 bg-slate-900/40 backdrop-blur-md sticky top-0 z-10">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="text-slate-400 hover:text-slate-100" />
              <div className="h-4 w-[1px] bg-slate-800" />
              <h1 className="text-lg font-bold bg-gradient-to-r from-primary to-orange-400 bg-clip-text text-transparent flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-primary" />
                Gestión de Banners y Carruseles
              </h1>
            </div>
            <Button
              onClick={() => {
                resetForm();
                setIsFormOpen(true);
              }}
              className="bg-primary hover:bg-primary/95 text-white shadow-lg hover:shadow-primary/20 transition-all font-semibold flex items-center gap-2 px-4 rounded-full"
            >
              <Plus className="h-4 w-4" />
              Nuevo Banner
            </Button>
          </header>

          {/* Body Content */}
          <main className="flex-1 overflow-y-auto p-6 bg-slate-950">
            <div className="max-w-6xl mx-auto space-y-6">
              
              {/* Premium Hero Stats Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-5 rounded-2xl bg-gradient-to-br from-[#0c0f1d] to-slate-900 border border-slate-800/60 flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
                    {banners.filter(b => b.slot_position === 'left').length}
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Slot Izquierdo</h3>
                    <p className="text-xs text-slate-500 mt-1">Sustituye Samsung. Si hay &gt;1, se vuelve carrusel.</p>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-gradient-to-br from-[#0c0f1d] to-slate-900 border border-slate-800/60 flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 font-bold shrink-0">
                    {banners.filter(b => b.slot_position === 'right_top').length}
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Slot Derecho Sup.</h3>
                    <p className="text-xs text-slate-500 mt-1">Sustituye Gaming. Si hay &gt;1, se vuelve carrusel.</p>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-gradient-to-br from-[#0c0f1d] to-slate-900 border border-slate-800/60 flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 font-bold shrink-0">
                    {banners.filter(b => b.slot_position === 'right_bottom').length}
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Slot Derecho Inf.</h3>
                    <p className="text-xs text-slate-500 mt-1">Sustituye Muebles. Si hay &gt;1, se vuelve carrusel.</p>
                  </div>
                </div>
              </div>

              {/* Banners Listing Table/Cards */}
              {isLoading ? (
                <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-3 bg-slate-900/30 rounded-2xl border border-slate-800/60">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p>Consultando base de datos...</p>
                </div>
              ) : banners.length === 0 ? (
                <div className="h-80 flex flex-col items-center justify-center text-slate-400 gap-4 bg-slate-900/30 rounded-2xl border border-slate-800/60 p-8 text-center max-w-xl mx-auto">
                  <div className="h-16 w-16 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 shadow-inner">
                    <ImageIcon className="h-8 w-8" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-200">No hay banners configurados</h2>
                    <p className="text-sm text-slate-400 mt-1">
                      El cliente mostrará los banners predeterminados premium. ¡Sube tu primera promoción ahora mismo!
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      resetForm();
                      setIsFormOpen(true);
                    }}
                    className="bg-primary hover:bg-primary/95 text-white font-semibold rounded-full mt-2"
                  >
                    Crear Primer Banner
                  </Button>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-800/60 bg-slate-900/30 overflow-hidden shadow-2xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800/80 bg-slate-900/80 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          <th className="px-6 py-4">Banner</th>
                          <th className="px-6 py-4">Slot / Ubicación</th>
                          <th className="px-6 py-4">Gradient de Fondo</th>
                          <th className="px-6 py-4 text-center">Estado</th>
                          <th className="px-6 py-4 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40 text-sm">
                        {banners.map((banner) => (
                          <tr key={banner.id} className="hover:bg-slate-900/20 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-4">
                                <div className="h-12 w-20 rounded-lg overflow-hidden bg-slate-800 border border-slate-700/50 shrink-0 relative">
                                  <img
                                    src={banner.image_url}
                                    alt={banner.title}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src = "https://placehold.co/120x80/1e293b/white?text=Img";
                                    }}
                                  />
                                </div>
                                <div className="max-w-[240px] overflow-hidden">
                                  {banner.tag && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider block w-max">
                                      {banner.tag}
                                    </span>
                                  )}
                                  <p className="font-semibold text-slate-200 truncate mt-1">{banner.title}</p>
                                  {banner.subtitle && (
                                    <p className="text-xs text-slate-400 truncate">{banner.subtitle}</p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="font-medium text-slate-300">
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
                                  className="text-xs text-primary hover:underline flex items-center gap-1 mt-1 font-mono"
                                >
                                  Ver link <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </td>
                            <td className="px-6 py-4 font-mono text-xs max-w-[200px]">
                              <div className="flex items-center gap-2">
                                <span className={`h-4 w-8 rounded ${banner.bg_gradient || "bg-slate-800"}`} />
                                <span className="text-slate-400 truncate w-[140px] block">
                                  {banner.bg_gradient || "Por defecto"}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <button
                                onClick={() => handleToggleActive(banner)}
                                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                                  banner.is_active
                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20"
                                    : "bg-slate-800 text-slate-400 border border-slate-700/60 hover:bg-slate-700/55"
                                }`}
                              >
                                {banner.is_active ? (
                                  <>
                                    <Eye className="h-3.5 w-3.5" /> Activo
                                  </>
                                ) : (
                                  <>
                                    <EyeOff className="h-3.5 w-3.5" /> Inactivo
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
                                  className="h-8 w-8 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 rounded-lg"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDelete(banner.id)}
                                  className="h-8 w-8 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg"
                                >
                                  <Trash2 className="h-4 w-4" />
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
            </div>
          </main>

          {/* Modal / Dialog Form Overlay */}
          {isFormOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
              <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl my-8 animate-in fade-in zoom-in-95 duration-200">
                
                {/* Modal Header */}
                <div className="p-6 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-slate-200 flex items-center gap-2">
                    <Sparkles className="text-primary h-5 w-5" />
                    {editingBanner ? "Modificar Banner" : "Nuevo Banner Promocional"}
                  </h2>
                  <button
                    onClick={() => {
                      setIsFormOpen(false);
                      resetForm();
                    }}
                    className="p-1 rounded-full text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
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
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ubicación / Slot</label>
                      <select
                        value={slotPosition}
                        onChange={(e) => setSlotPosition(e.target.value)}
                        className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-primary transition-colors"
                      >
                        {slotOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <p className="text-[11px] text-slate-500 font-mono">
                        {slotOptions.find(o => o.value === slotPosition)?.dimensions}
                      </p>
                    </div>

                    {/* Active State */}
                    <div className="space-y-2 flex flex-col justify-end">
                      <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">¿Mostrar en tienda?</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isActive}
                            onChange={(e) => setIsActive(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                      </div>
                    </div>

                    {/* Tag overlay */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Etiqueta (Tag)</label>
                      <Input
                        type="text"
                        placeholder="Ej. SAMSUNG PREMIUM o ÚLTIMO MODELO"
                        value={tag}
                        onChange={(e) => setTag(e.target.value)}
                        className="bg-slate-950 border-slate-800 rounded-xl"
                      />
                    </div>

                    {/* Main Title */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Título Principal</label>
                      <Input
                        type="text"
                        placeholder="Ej. Galaxy S24 Ultra o Gaming Fest"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="bg-slate-950 border-slate-800 rounded-xl"
                        required
                      />
                    </div>

                    {/* Subtitle description */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Subtítulo o Descripción corta</label>
                      <Input
                        type="text"
                        placeholder="Ej. Hasta 30% OFF en tecnología"
                        value={subtitle}
                        onChange={(e) => setSubtitle(e.target.value)}
                        className="bg-slate-950 border-slate-800 rounded-xl"
                      />
                    </div>

                    {/* Button Text */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Texto del Botón</label>
                      <Input
                        type="text"
                        placeholder="Ej. Comprar Ahora o Clic aquí"
                        value={buttonText}
                        onChange={(e) => setButtonText(e.target.value)}
                        className="bg-slate-950 border-slate-800 rounded-xl"
                      />
                    </div>

                    {/* Redirect URL */}
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Link de Redirección (Link en la plataforma)</label>
                      <Input
                        type="text"
                        placeholder="Ej. /negocios?category=Tecnologia o /negocios/samsung-store"
                        value={redirectUrl}
                        onChange={(e) => setRedirectUrl(e.target.value)}
                        className="bg-slate-950 border-slate-800 rounded-xl font-mono text-sm"
                      />
                    </div>

                    {/* Image URL with Paste & Drag Drop Container */}
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Foto del Producto (PNG transparente recomendado)</label>
                      
                      {/* Paste URL directly */}
                      <Input
                        type="text"
                        placeholder="Pega la URL absoluta de una imagen o usa el contenedor de abajo para subir un archivo"
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        className="bg-slate-950 border-slate-800 rounded-xl text-xs font-mono mb-2"
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
                            ? "border-emerald-500/40 bg-slate-950/40 text-slate-300"
                            : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700 hover:bg-slate-950/80"
                        }`}
                      >
                        {uploadingImage ? (
                          <>
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-xs">Subiendo imagen al servidor...</p>
                          </>
                        ) : imageUrl ? (
                          <div className="flex items-center gap-4 w-full justify-center">
                            <div className="h-16 w-24 rounded-lg overflow-hidden border border-slate-800 bg-slate-900 shrink-0">
                              <img src={imageUrl} alt="Thumbnail" className="w-full h-full object-contain" />
                            </div>
                            <div className="text-left max-w-xs">
                              <p className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                                <Check className="h-3.5 w-3.5" /> Imagen asignada con éxito
                              </p>
                              <p className="text-[10px] text-slate-500 truncate font-mono mt-1">{imageUrl}</p>
                              <button
                                type="button"
                                onClick={() => setImageUrl("")}
                                className="text-rose-400 hover:underline text-[11px] font-bold block mt-1"
                              >
                                Reemplazar imagen
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <UploadCloud className="h-8 w-8" />
                            <p className="text-xs font-medium text-center">
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
                            <p className="text-[10px] text-slate-500">JPG, PNG o WebP. Fondo transparente sugerido.</p>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Gradient background class choice */}
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Estilo del Fondo (Degradado de fondo)</label>
                      <Input
                        type="text"
                        placeholder="Clases CSS o Gradient (ej. bg-gradient-to-r from-teal-900 to-cyan-900)"
                        value={bgGradient}
                        onChange={(e) => setBgGradient(e.target.value)}
                        className="bg-slate-950 border-slate-800 rounded-xl font-mono text-sm mb-2"
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
                                : "border-slate-800 text-slate-300"
                            }`}
                          >
                            <span className="truncate w-full block drop-shadow-md text-white font-bold">{preset.name}</span>
                            <span className="text-[8px] text-white/60 truncate w-full font-mono mt-1">{preset.value}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Contrast & Text color choice */}
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Contraste de Texto</label>
                      <div className="grid grid-cols-2 gap-4">
                        {textColors.map((color) => (
                          <button
                            key={color.value}
                            type="button"
                            onClick={() => setTextColor(color.value)}
                            className={`p-3 rounded-xl border flex items-center justify-between text-xs font-semibold transition-all ${
                              textColor === color.value
                                ? "border-primary ring-2 ring-primary/20 bg-slate-900 text-slate-100"
                                : "border-slate-800 bg-slate-950 text-slate-400 hover:bg-slate-900/50"
                            }`}
                          >
                            <span>{color.label}</span>
                            <span className={`h-4 w-4 rounded-full border border-slate-700/60 ${color.preview}`} />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Banner LIVE visual preview! */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Vista Previa Interactiva (Fasty Premium Design)</label>
                    <div
                      className={`w-full rounded-2xl p-6 ${bgGradient} ${textColor} relative overflow-hidden min-h-[160px] flex items-center border border-white/10`}
                    >
                      <div className="max-w-[60%] space-y-2 relative z-10 flex flex-col justify-center h-full">
                        {tag && (
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-white/20 border border-white/10 w-max tracking-widest leading-none block">
                            {tag}
                          </span>
                        )}
                        <h4 className="text-lg md:text-xl font-extrabold tracking-tight drop-shadow-sm leading-tight">
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
                            className="max-h-[90%] max-w-full object-contain filter drop-shadow-xl animate-pulse"
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
                  <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setIsFormOpen(false);
                        resetForm();
                      }}
                      className="rounded-full text-slate-400 hover:text-slate-100 hover:bg-slate-800"
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      disabled={isSubmitting || uploadingImage}
                      className="bg-primary hover:bg-primary/95 text-white font-bold rounded-full min-w-[120px]"
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
