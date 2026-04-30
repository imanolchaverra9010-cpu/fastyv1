import { Plus, Eye, EyeOff, Edit2, Trash2, Menu, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCOP } from "@/data/mock";
import { MenuItem, BusinessContextType } from "@/types/business";
import { useOutletContext } from "react-router-dom";
import { MenuScannerModal } from "./MenuScannerModal";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";

// ... (MenuItemCard y MenuFormCard se mantienen igual)

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
