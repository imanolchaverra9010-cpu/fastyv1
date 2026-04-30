import { Plus, Eye, EyeOff, Edit2, Trash2, Menu, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCOP } from "@/data/mock";
import { MenuItem, BusinessContextType } from "@/types/business";
import { useOutletContext } from "react-router-dom";
import { MenuScannerModal } from "./MenuScannerModal";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";

interface MenuItemCardProps {
  item: MenuItem;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}

const MenuItemCard = ({ item, onEdit, onToggle, onDelete }: MenuItemCardProps) => {
  return (
    <div className={`bg-card border border-border/60 rounded-xl p-4 transition-all ${!item.is_active ? 'opacity-50' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="text-sm font-bold text-primary bg-primary/5 px-2 py-1 rounded-lg">
          {item.category || "General"}
        </div>
        <div className="flex gap-1">
          <button 
            onClick={onToggle}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
            title={item.is_active ? "Desactivar" : "Activar"}
          >
            {item.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
          </button>
          <button 
            onClick={onEdit}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button 
            onClick={onDelete}
            className="p-2 hover:bg-destructive/10 rounded-lg transition-colors text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <h3 className="font-bold">{item.name}</h3>
      {item.description && <p className="text-xs text-muted-foreground mt-1">{item.description}</p>}
      <p className="text-lg font-bold text-primary mt-2">{formatCOP(item.price)}</p>
      {item.category && <p className="text-xs text-muted-foreground mt-1">{item.category}</p>}
    </div>
  );
};

interface MenuFormCardProps {
  form: any;
  setForm: (form: any) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isEditing: boolean;
  existingCategories: string[];
}

const MenuFormCard = ({ form, setForm, onSubmit, onCancel, isEditing, existingCategories }: MenuFormCardProps) => {
  return (
    <div className="bg-card border border-border/60 rounded-2xl p-6 space-y-4">
      <h3 className="font-bold text-lg">{isEditing ? 'Editar Producto' : 'Nuevo Producto'}</h3>
      
      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="text-xs font-bold text-muted-foreground uppercase">Categoría</label>
          <Input 
            list="categories-list"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="mt-2 h-11 rounded-xl"
            placeholder="Escribe o selecciona una categoría"
          />
          <datalist id="categories-list">
            {existingCategories.map(cat => (
              <option key={cat} value={cat} />
            ))}
            <option value="Platos Principales" />
            <option value="Bebidas" />
            <option value="Postres" />
          </datalist>
          <p className="text-[10px] text-muted-foreground mt-1">Puedes crear una categoría nueva escribiéndola.</p>
        </div>
      </div>

      <div>
        <label className="text-xs font-bold text-muted-foreground uppercase">Nombre del Producto</label>
        <Input 
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="mt-2 h-11 rounded-xl"
          placeholder="ej: Hamburguesa Clásica"
        />
      </div>

      <div>
        <label className="text-xs font-bold text-muted-foreground uppercase">Descripción</label>
        <textarea 
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="mt-2 w-full h-20 rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-soft outline-none focus:ring-2 focus:ring-primary/20"
          placeholder="Describe el producto..."
        />
      </div>

      <div>
        <label className="text-xs font-bold text-muted-foreground uppercase">Precio (COP)</label>
        <Input 
          type="number"
          value={form.price}
          onChange={(e) => setForm({ ...form, price: e.target.value })}
          className="mt-2 h-11 rounded-xl"
          placeholder="15000"
        />
      </div>

      <div className="flex gap-3 pt-4">
        <Button variant="outline" className="flex-1 rounded-xl" onClick={onCancel}>Cancelar</Button>
        <Button variant="hero" className="flex-1 rounded-xl" onClick={onSubmit}>
          {isEditing ? 'Actualizar' : 'Agregar'}
        </Button>
      </div>
    </div>
  );
};

export const MenuTab = () => {
  const {
    business,
    menuItems,
    showMenuForm,
    setShowMenuForm,
    newItemForm,
    setNewItemForm,
    editingItem,
    setEditingItem,
    handleAddMenuItem,
    handleToggleMenuItem,
    handleDeleteMenuItem,
    fetchBusinessData
  } = useOutletContext<BusinessContextType>();

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isBatchSaving, setIsBatchSaving] = useState(false);

  const existingCategories = Array.from(new Set((menuItems || []).map(item => item.category).filter(Boolean)));

  const handleSaveScannedItems = async (items: any[]) => {
    if (!business?.id) return;
    setIsBatchSaving(true);
    
    try {
      // Guardar cada producto uno por uno (o podrías crear un endpoint batch en el futuro)
      for (const item of items) {
        await fetch(`/api/businesses/${business.id}/menu-items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: item.name,
            description: item.description,
            price: item.price,
            category: item.category,
            emoji: "🍽️", // Emoji genérico o podrías pedir a la IA que lo sugiera
            is_active: true
          }),
        });
      }
      
      toast({ title: "Menú actualizado", description: `Se han agregado ${items.length} productos correctamente.` });
      fetchBusinessData();
    } catch (error) {
      toast({ title: "Error", description: "Hubo un problema al guardar los productos.", variant: "destructive" });
    } finally {
      setIsBatchSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-lg font-bold">Gestión de Menú</h2>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button 
            variant="outline" 
            className="flex-1 sm:flex-none rounded-xl gap-2 border-primary/20 hover:bg-primary/5 text-primary font-bold"
            onClick={() => setIsScannerOpen(true)}
            disabled={isBatchSaving}
          >
            {isBatchSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Escaneo con IA
          </Button>
          <Button 
            variant="hero" 
            className="flex-1 sm:flex-none rounded-xl gap-2"
            onClick={() => {
              setEditingItem(null);
              setNewItemForm({ name: "", price: "", emoji: "🍔", description: "", category: "Platos Principales" });
              setShowMenuForm(true);
            }}
            disabled={isBatchSaving}
          >
            <Plus className="h-4 w-4" /> Agregar Producto
          </Button>
        </div>
      </div>

      <MenuScannerModal 
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onSaveItems={handleSaveScannedItems}
        businessId={business?.id}
      />

      {showMenuForm && (
        <MenuFormCard 
          form={newItemForm}
          setForm={setNewItemForm}
          onSubmit={handleAddMenuItem}
          onCancel={() => {
            setShowMenuForm(false);
            setEditingItem(null);
          }}
          isEditing={!!editingItem}
          existingCategories={existingCategories}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(menuItems || []).map((item) => (
          <MenuItemCard
            key={item.id}
            item={item}
            onEdit={() => {
              setEditingItem(item);
              setNewItemForm({
                name: item.name,
                price: String(item.price),
                description: item.description || "",
                category: item.category || "Platos Principales"
              });
              setShowMenuForm(true);
            }}
            onToggle={() => handleToggleMenuItem(item.id, item.is_active)}
            onDelete={() => handleDeleteMenuItem(item.id)}
          />
        ))}
      </div>

      {(!menuItems || menuItems.length === 0) && (
        <div className="text-center py-12">
          <Menu className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground">No hay productos en el menú</p>
        </div>
      )}
    </div>
  );
};
