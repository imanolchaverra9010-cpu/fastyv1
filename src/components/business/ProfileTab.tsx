import { useState, useEffect, useRef } from "react";
import { useOutletContext } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Business, BusinessContextType } from "@/types/business";
import { Edit2, Save, X, Store, MapPin, Phone, Clock, Tag, Loader2, Camera, ImageOff } from "lucide-react";

export const ProfileTab = () => {
  const { business, fetchBusinessData } = useOutletContext<BusinessContextType>();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [form, setForm] = useState<Partial<Business>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (business) {
      setForm({
        name: business.name ?? "",
        description: business.description ?? "",
        address: business.address ?? "",
        phone: business.phone ?? "",
        eta: business.eta ?? "",
        emoji: business.emoji ?? "",
        category: business.category ?? "",
        image_url: business.image_url ?? "",
      });
    }
  }, [business]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !business?.id) return;

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast({ title: "Imagen muy grande", description: "El archivo debe ser menor a 5MB.", variant: "destructive" });
      return;
    }

    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`http://localhost:8000/businesses/${business.id}/image`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setForm((prev) => ({ ...prev, image_url: data.image_url }));
        toast({ title: "Imagen actualizada", description: "La foto del negocio se subió correctamente." });
        fetchBusinessData();
      } else {
        toast({ title: "Error al subir imagen", description: "Intenta con otra imagen.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error de conexión", description: "No se pudo conectar con el servidor.", variant: "destructive" });
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!business?.id) return;
    setIsSaving(true);
    try {
      const res = await fetch(`http://localhost:8000/businesses/${business.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          address: form.address,
          phone: form.phone,
          eta: form.eta,
          emoji: form.emoji,
          category: form.category,
        }),
      });

      if (res.ok) {
        toast({ title: "Perfil actualizado", description: "Los cambios se guardaron correctamente." });
        fetchBusinessData();
        setIsEditing(false);
      } else {
        toast({ title: "Error", description: "No se pudieron guardar los cambios.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error de conexión", description: "No se pudo conectar con el servidor.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (business) {
      setForm({
        name: business.name ?? "",
        description: business.description ?? "",
        address: business.address ?? "",
        phone: business.phone ?? "",
        eta: business.eta ?? "",
        emoji: business.emoji ?? "",
        category: business.category ?? "",
        image_url: business.image_url ?? "",
      });
    }
    setIsEditing(false);
  };

  if (!business) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Image Banner */}
      <div className="relative rounded-2xl overflow-hidden border border-border/60 bg-muted h-52 group">
        {form.image_url ? (
          <img
            src={form.image_url.startsWith("http") ? form.image_url : `http://localhost:8000${form.image_url}`}
            alt={business.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
            <ImageOff className="h-10 w-10 opacity-40" />
            <p className="text-sm font-medium opacity-60">Sin imagen de portada</p>
          </div>
        )}

        {/* Upload Overlay */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Button
            variant="hero"
            className="rounded-xl gap-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingImage}
          >
            {isUploadingImage ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
            {isUploadingImage ? "Subiendo..." : "Cambiar Imagen"}
          </Button>
        </div>

        {/* Emoji Badge */}
        <div className="absolute bottom-4 left-4 text-5xl drop-shadow-lg">
          {business.emoji || "🏪"}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageUpload}
        />
      </div>

      {/* Edit Form */}
      <div className="bg-card border border-border/60 rounded-2xl p-6 space-y-5">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" />
            Información del Negocio
          </h2>
          {!isEditing ? (
            <Button variant="outline" className="rounded-xl gap-2" onClick={() => setIsEditing(true)}>
              <Edit2 className="h-4 w-4" /> Editar
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" className="rounded-xl gap-2" onClick={handleCancel}>
                <X className="h-4 w-4" /> Cancelar
              </Button>
              <Button variant="hero" className="rounded-xl gap-2" onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Guardar
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase">Emoji del Negocio</label>
            <Input
              value={form.emoji ?? ""}
              onChange={(e) => setForm({ ...form, emoji: e.target.value })}
              className="mt-2 h-11 rounded-xl text-xl text-center"
              disabled={!isEditing}
              maxLength={2}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1">
              <Tag className="h-3 w-3" /> Categoría
            </label>
            <Input
              value={form.category ?? ""}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="mt-2 h-11 rounded-xl"
              disabled={!isEditing}
              placeholder="ej: Restaurante, Tienda..."
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-muted-foreground uppercase">Nombre del Negocio</label>
          <Input
            value={form.name ?? ""}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="mt-2 h-11 rounded-xl"
            disabled={!isEditing}
            placeholder="Mi Restaurante"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-muted-foreground uppercase">Descripción</label>
          <textarea
            value={form.description ?? ""}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="mt-2 w-full h-24 rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-soft outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!isEditing}
            placeholder="Describe tu negocio..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1">
              <MapPin className="h-3 w-3" /> Dirección
            </label>
            <Input
              value={form.address ?? ""}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="mt-2 h-11 rounded-xl"
              disabled={!isEditing}
              placeholder="Calle 123, Ciudad"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1">
              <Phone className="h-3 w-3" /> Teléfono
            </label>
            <Input
              value={form.phone ?? ""}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="mt-2 h-11 rounded-xl"
              disabled={!isEditing}
              placeholder="+57 300 123 4567"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1">
            <Clock className="h-3 w-3" /> Tiempo de entrega estimado
          </label>
          <Input
            value={form.eta ?? ""}
            onChange={(e) => setForm({ ...form, eta: e.target.value })}
            className="mt-2 h-11 rounded-xl"
            disabled={!isEditing}
            placeholder="ej: 30-45 min"
          />
        </div>
      </div>
    </div>
  );
};
