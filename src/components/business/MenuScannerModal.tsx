import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Sparkles, Upload, Check, X, AlertCircle, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatCOP } from "@/data/mock";

interface ScannedItem {
  name: string;
  price: number;
  description: string;
  category: string;
  selected: boolean;
}

interface MenuScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveItems: (items: any[]) => void;
  businessId?: string;
}

export const MenuScannerModal = ({ isOpen, onClose, onSaveItems, businessId }: MenuScannerModalProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);

    // Llamada al backend real que usa Gemini
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/businesses/scan-menu", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Error al procesar la imagen.");
      }

      const items = await res.json();

      if (!Array.isArray(items) || items.length === 0) {
        toast({ 
          title: "Menú vacío", 
          description: "La IA no pudo detectar productos en esta imagen. Asegúrate de que la foto sea clara y los precios visibles.",
          variant: "destructive"
        });
        setImagePreview(null);
        return;
      }

      // Mapear para añadir el estado 'selected'
      const mappedItems = items.map(item => ({
        ...item,
        selected: true
      }));

      setScannedItems(mappedItems);
      toast({ title: "Escaneo completado", description: `Se han detectado ${mappedItems.length} productos.` });
    } catch (error: any) {
      toast({ 
        title: "Error de Escaneo", 
        description: error.message || "No se pudo procesar la imagen.", 
        variant: "destructive" 
      });
      setImagePreview(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleItem = (index: number) => {
    const newItems = [...scannedItems];
    newItems[index].selected = !newItems[index].selected;
    setScannedItems(newItems);
  };

  const handleSave = () => {
    const selectedItems = scannedItems.filter(i => i.selected);
    if (selectedItems.length === 0) {
      toast({ title: "Atención", description: "Selecciona al menos un producto para guardar." });
      return;
    }
    onSaveItems(selectedItems);
    onClose();
    // Reset
    setScannedItems([]);
    setImagePreview(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-black">
            <Sparkles className="h-6 w-6 text-primary" />
            Escáner de Menú con IA
          </DialogTitle>
          <DialogDescription>
            Sube una foto de tu menú físico y Rapidito creará los productos automáticamente por ti.
          </DialogDescription>
        </DialogHeader>

        {!imagePreview && !isProcessing && (
          <div 
            className="mt-6 border-2 border-dashed border-border/60 rounded-3xl p-12 flex flex-col items-center justify-center gap-4 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <div className="text-center">
              <p className="font-bold text-lg">Haz clic para subir foto</p>
              <p className="text-sm text-muted-foreground">O arrastra la imagen aquí</p>
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleFileChange} 
            />
          </div>
        )}

        {isProcessing && (
          <div className="py-12 flex flex-col items-center justify-center gap-6">
            <div className="relative">
              <div className="h-24 w-24 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
              <Sparkles className="h-8 w-8 text-primary absolute inset-0 m-auto animate-pulse" />
            </div>
            <div className="text-center">
              <p className="font-bold text-xl">Analizando tu menú...</p>
              <p className="text-sm text-muted-foreground">Nuestra IA está extrayendo platos, precios y descripciones.</p>
            </div>
          </div>
        )}

        {scannedItems.length > 0 && !isProcessing && (
          <div className="mt-6 space-y-6 animate-in fade-in zoom-in duration-300">
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex items-start gap-3">
              <Check className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-bold text-sm">¡Lectura Exitosa!</p>
                <p className="text-xs text-muted-foreground">Hemos encontrado estos productos. Selecciona los que quieras agregar a tu catálogo.</p>
              </div>
            </div>

            <div className="space-y-3">
              {scannedItems.map((item, index) => (
                <div 
                  key={index}
                  className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                    item.selected ? 'border-primary bg-primary/5 shadow-soft' : 'border-border/40 bg-card hover:border-border'
                  }`}
                  onClick={() => handleToggleItem(index)}
                >
                  <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                    item.selected ? 'bg-primary border-primary' : 'border-muted-foreground/30'
                  }`}>
                    {item.selected && <Check className="h-4 w-4 text-white" />}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold truncate">{item.name}</p>
                      <p className="font-bold text-primary">{formatCOP(item.price)}</p>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                    <span className="text-[10px] font-bold uppercase text-muted-foreground/60 bg-muted px-2 py-0.5 rounded-full mt-1 inline-block">
                      {item.category}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-4 border-t sticky bottom-0 bg-background pb-2">
              <Button variant="outline" className="flex-1 rounded-xl h-12" onClick={() => { setScannedItems([]); setImagePreview(null); }}>
                Escanear otra foto
              </Button>
              <Button variant="hero" className="flex-1 rounded-xl h-12 shadow-glow gap-2" onClick={handleSave}>
                <Plus className="h-4 w-4" /> Agregar {scannedItems.filter(i => i.selected).length} productos
              </Button>
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center gap-2 text-[10px] text-muted-foreground bg-muted/30 p-3 rounded-xl">
          <AlertCircle className="h-3 w-3" />
          <span>La IA puede cometer errores. Por favor, verifica los nombres y precios antes de guardar.</span>
        </div>
      </DialogContent>
    </Dialog>
  );
};
