import { Plus, Eye, EyeOff, Edit2, Trash2, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCOP } from "@/data/mock";
import { MenuItem, BusinessContextType } from "@/types/business";
import { useOutletContext } from "react-router-dom";

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
        <div className="text-3xl">{item.emoji}</div>
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
}

const MenuFormCard = ({ form, setForm, onSubmit, onCancel, isEditing }: MenuFormCardProps) => {
  return (
    <div className="bg-card border border-border/60 rounded-2xl p-6 space-y-4">
      <h3 className="font-bold text-lg">{isEditing ? 'Editar Producto' : 'Nuevo Producto'}</h3>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-bold text-muted-foreground uppercase">Emoji</label>
          <Input 
            value={form.emoji}
            onChange={(e) => setForm({ ...form, emoji: e.target.value })}
            className="mt-2 h-11 rounded-xl"
            maxLength={2}
          />
        </div>
        <div>
          <label className="text-xs font-bold text-muted-foreground uppercase">Categoría</label>
          <select 
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="mt-2 w-full h-11 rounded-xl border border-input bg-background px-3 text-sm shadow-soft outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option>Platos Principales</option>
            <option>Bebidas</option>
            <option>Postres</option>
            <option>Acompañamientos</option>
          </select>
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
    menuItems,
    showMenuForm,
    setShowMenuForm,
    newItemForm,
    setNewItemForm,
    editingItem,
    setEditingItem,
    handleAddMenuItem,
    handleToggleMenuItem,
    handleDeleteMenuItem
  } = useOutletContext<BusinessContextType>();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold">Gestión de Menú</h2>
        <Button 
          variant="hero" 
          className="rounded-xl gap-2"
          onClick={() => {
            setEditingItem(null);
            setNewItemForm({ name: "", price: "", emoji: "🍔", description: "", category: "Platos Principales" });
            setShowMenuForm(true);
          }}
        >
          <Plus className="h-4 w-4" /> Agregar Producto
        </Button>
      </div>

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
                emoji: item.emoji || "🍔",
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
