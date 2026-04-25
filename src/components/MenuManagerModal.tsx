import { useState, useEffect } from "react";
import { X, Plus, Trash2, Utensils, DollarSign, Image as ImageIcon, Smile, Type, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";

interface MenuManagerModalProps {
  businessId: string;
  businessName: string;
  onClose: () => void;
}

export function MenuManagerModal({ businessId, businessName, onClose }: MenuManagerModalProps) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: 0,
    category: "Principal",
    image_url: "",
    emoji: "🍔",
    is_active: true
  });

  const fetchMenu = async () => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:8000/businesses/${businessId}/menu`);
      if (response.ok) {
        const data = await response.json();
        setItems(data);
      }
    } catch (error) {
      console.error("Error fetching menu:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenu();
  }, [businessId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: name === "price" ? parseInt(value) || 0 : value 
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingItem 
        ? `http://localhost:8000/businesses/${businessId}/menu/${editingItem.id}`
        : `http://localhost:8000/businesses/${businessId}/menu`;
      
      const method = editingItem ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast({ title: "Éxito", description: `Producto ${editingItem ? 'actualizado' : 'agregado'}.` });
        setIsAdding(false);
        setEditingItem(null);
        setFormData({ name: "", description: "", price: 0, category: "Principal", image_url: "", emoji: "🍔", is_active: true });
        fetchMenu();
      }
    } catch (error) {
      toast({ title: "Error", description: "No se pudo guardar el producto.", variant: "destructive" });
    }
  };

  const deleteItem = async (id: number) => {
    if (!confirm("¿Eliminar este producto?")) return;
    try {
      const response = await fetch(`http://localhost:8000/businesses/${businessId}/menu/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        toast({ title: "Eliminado", description: "Producto eliminado." });
        fetchMenu();
      }
    } catch (error) {
      toast({ title: "Error", description: "No se pudo eliminar.", variant: "destructive" });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="bg-card w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-3xl border border-border/60 shadow-glow flex flex-col">
        <div className="p-6 border-b border-border/60 flex items-center justify-between bg-primary text-primary-foreground">
          <div>
            <h2 className="text-xl font-display font-bold flex items-center gap-2">
              <Utensils className="h-5 w-5" /> Gestión de Menú
            </h2>
            <p className="text-xs opacity-80 font-medium uppercase tracking-wider">{businessName}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {isAdding || editingItem ? (
            <form onSubmit={handleSubmit} className="space-y-4 bg-muted/30 p-5 rounded-2xl border border-border/40 mb-6 animate-in fade-in slide-in-from-top-2">
              <h3 className="font-bold flex items-center gap-2 text-primary">
                {editingItem ? 'Editar Producto' : 'Nuevo Producto'}
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs flex items-center gap-1.5"><Type className="h-3.5 w-3.5" /> Nombre</Label>
                  <Input name="name" required value={formData.name} onChange={handleChange} className="h-9 text-sm" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5" /> Precio</Label>
                  <Input name="price" type="number" required value={formData.price} onChange={handleChange} className="h-9 text-sm" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-xs flex items-center gap-1.5">Descripción</Label>
                  <Textarea name="description" value={formData.description} onChange={handleChange} className="text-sm min-h-[80px]" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs flex items-center gap-1.5"><Smile className="h-3.5 w-3.5" /> Emoji</Label>
                  <Input name="emoji" value={formData.emoji} onChange={handleChange} className="h-9 text-sm" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs flex items-center gap-1.5"><ImageIcon className="h-3.5 w-3.5" /> URL Imagen (Opcional)</Label>
                  <Input name="image_url" value={formData.image_url} onChange={handleChange} className="h-9 text-sm" />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" variant="hero" className="flex-1 rounded-xl font-bold h-10">
                  {editingItem ? 'Actualizar' : 'Agregar al Menú'}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  className="rounded-xl h-10" 
                  onClick={() => { setIsAdding(false); setEditingItem(null); }}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-muted-foreground flex items-center gap-2">
                Productos ({items.length})
              </h3>
              <Button variant="soft" className="rounded-xl gap-2 h-10 px-5" onClick={() => setIsAdding(true)}>
                <Plus className="h-4 w-4" /> Agregar Producto
              </Button>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : items.length === 0 && !isAdding ? (
            <div className="text-center py-10 bg-muted/20 rounded-2xl border-2 border-dashed border-border/40">
              <Utensils className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground font-medium">No hay productos en el menú.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map(item => (
                <div key={item.id} className="group p-4 rounded-2xl border border-border/60 bg-card hover:border-primary/40 hover:shadow-card transition-all flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-3xl h-12 w-12 rounded-xl bg-muted flex items-center justify-center shrink-0">{item.emoji}</span>
                    <div>
                      <h4 className="font-bold group-hover:text-primary transition-colors">{item.name}</h4>
                      <p className="text-xs text-muted-foreground line-clamp-1 max-w-[300px]">{item.description}</p>
                      <p className="text-sm font-bold text-primary mt-0.5">
                        {new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(item.price)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-9 w-9 text-muted-foreground hover:text-primary"
                      onClick={() => {
                        setEditingItem(item);
                        setFormData({
                          name: item.name,
                          description: item.description,
                          price: item.price,
                          category: item.category,
                          image_url: item.image_url,
                          emoji: item.emoji,
                          is_active: item.is_active
                        });
                      }}
                    >
                      <Trash2 className="h-4 w-4 hidden" /> {/* Placeholder hack */}
                      <Utensils className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-9 w-9 text-destructive hover:bg-destructive/10"
                      onClick={() => deleteItem(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
