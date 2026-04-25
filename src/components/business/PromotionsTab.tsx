import { Plus, Eye, EyeOff, Edit2, Trash2, Clock, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Promotion, BusinessContextType } from "@/types/business";
import { useOutletContext } from "react-router-dom";

interface PromotionCardProps {
  promo: Promotion;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}

const PromotionCard = ({ promo, onEdit, onToggle, onDelete }: PromotionCardProps) => {
  return (
    <div className={`bg-card border-2 border-primary/20 rounded-2xl p-5 transition-all relative overflow-hidden ${!promo.is_active ? 'opacity-50 grayscale' : ''}`}>
      {promo.discount_percent && (
        <div className="absolute top-0 right-0 bg-primary text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-tighter">
          {promo.discount_percent}% OFF
        </div>
      )}
      
      <div className="flex items-start justify-between mb-4">
        <div className="text-4xl">{promo.emoji}</div>
        <div className="flex gap-1">
          <button onClick={onToggle} className="p-2 hover:bg-muted rounded-lg transition-colors">
            {promo.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
          <button onClick={onEdit} className="p-2 hover:bg-muted rounded-lg transition-colors">
            <Edit2 className="h-4 w-4" />
          </button>
          <button onClick={onDelete} className="p-2 hover:bg-destructive/10 rounded-lg transition-colors text-destructive">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      
      <h3 className="font-bold text-lg leading-tight">{promo.title}</h3>
      {promo.description && <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{promo.description}</p>}
      
      {promo.expires_at && (
        <div className="mt-4 pt-4 border-t border-border/60 flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase">
          <Clock className="h-3.5 w-3.5" />
          Expira: {new Date(promo.expires_at).toLocaleDateString()}
        </div>
      )}
    </div>
  );
};

interface PromotionFormCardProps {
  form: any;
  setForm: (form: any) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isEditing: boolean;
}

const PromotionFormCard = ({ form, setForm, onSubmit, onCancel, isEditing }: PromotionFormCardProps) => {
  return (
    <div className="bg-card border-2 border-primary/30 rounded-2xl p-6 space-y-4 animate-in fade-in zoom-in duration-300">
      <h3 className="font-bold text-lg">{isEditing ? 'Editar Promoción' : 'Nueva Promoción'}</h3>
      
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
          <label className="text-xs font-bold text-muted-foreground uppercase">% Descuento (Opcional)</label>
          <Input 
            type="number"
            value={form.discount_percent}
            onChange={(e) => setForm({ ...form, discount_percent: e.target.value })}
            className="mt-2 h-11 rounded-xl"
            placeholder="ej: 20"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-bold text-muted-foreground uppercase">Título de la Promo</label>
        <Input 
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="mt-2 h-11 rounded-xl"
          placeholder="ej: 2x1 en Pizzas de Jueves"
        />
      </div>

      <div>
        <label className="text-xs font-bold text-muted-foreground uppercase">Código de la Promo (Opcional)</label>
        <Input 
          value={form.promo_code}
          onChange={(e) => setForm({ ...form, promo_code: e.target.value.toUpperCase() })}
          className="mt-2 h-11 rounded-xl font-mono"
          placeholder="ej: RAPIDITO"
        />
      </div>

      <div>
        <label className="text-xs font-bold text-muted-foreground uppercase">Descripción / Términos</label>
        <textarea 
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="mt-2 w-full h-24 rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-soft outline-none focus:ring-2 focus:ring-primary/20"
          placeholder="Describe los detalles de la oferta..."
        />
      </div>

      <div>
        <label className="text-xs font-bold text-muted-foreground uppercase">Fecha de Expiración (Opcional)</label>
        <Input 
          type="datetime-local"
          value={form.expires_at}
          onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
          className="mt-2 h-11 rounded-xl"
        />
      </div>

      <div className="flex gap-3 pt-4">
        <Button variant="outline" className="flex-1 rounded-xl" onClick={onCancel}>Cancelar</Button>
        <Button variant="hero" className="flex-1 rounded-xl" onClick={onSubmit}>
          {isEditing ? 'Actualizar Promo' : 'Publicar Promo'}
        </Button>
      </div>
    </div>
  );
};

export const PromotionsTab = () => {
  const {
    promotions,
    showPromoForm,
    setShowPromoForm,
    newPromoForm,
    setNewPromoForm,
    editingPromo,
    setEditingPromo,
    handleAddPromotion,
    handleTogglePromotion,
    handleDeletePromotion
  } = useOutletContext<BusinessContextType>();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold">Promociones y Ofertas</h2>
        <Button 
          variant="hero" 
          className="rounded-xl gap-2"
          onClick={() => {
            setEditingPromo(null);
            setNewPromoForm({ title: "", description: "", discount_percent: "", emoji: "📢", expires_at: "" });
            setShowPromoForm(true);
          }}
        >
          <Plus className="h-4 w-4" /> Crear Promoción
        </Button>
      </div>

      {showPromoForm && (
        <PromotionFormCard 
          form={newPromoForm}
          setForm={setNewPromoForm}
          onSubmit={handleAddPromotion}
          onCancel={() => {
            setShowPromoForm(false);
            setEditingPromo(null);
          }}
          isEditing={!!editingPromo}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {promotions.map((promo) => (
          <PromotionCard
            key={promo.id}
            promo={promo}
            onEdit={() => {
              setEditingPromo(promo);
              setNewPromoForm({
                title: promo.title,
                description: promo.description || "",
                discount_percent: promo.discount_percent ? String(promo.discount_percent) : "",
                promo_code: promo.promo_code || "",
                emoji: promo.emoji || "📢",
                expires_at: promo.expires_at ? new Date(promo.expires_at).toISOString().slice(0, 16) : ""
              });
              setShowPromoForm(true);
            }}
            onToggle={() => handleTogglePromotion(promo.id, promo.is_active)}
            onDelete={() => handleDeletePromotion(promo.id)}
          />
        ))}
      </div>

      {promotions.length === 0 && (
        <div className="text-center py-12">
          <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground">No hay promociones activas</p>
        </div>
      )}
    </div>
  );
};
