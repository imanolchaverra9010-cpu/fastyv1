import { useState, useEffect } from "react";
import { X, Upload, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";

interface MenuLoaderModalProps {
  onClose: () => void;
}

interface MenuItem {
  name: string;
  description?: string;
  price: number;
  category: string;
  emoji?: string;
  image_url?: string;
}

export function MenuLoaderModal({ onClose }: MenuLoaderModalProps) {
  const [businessId, setBusinessId] = useState("");
  const [menuText, setMenuText] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{success: number, errors: number, messages: string[]}>({success: 0, errors: 0, messages: []});
  const [previewItems, setPreviewItems] = useState<MenuItem[]>([]);

  // Actualizar preview automáticamente cuando cambia el texto
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (menuText.trim()) {
        const items = parseMenuText(menuText);
        setPreviewItems(items);
      } else {
        setPreviewItems([]);
      }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [menuText]);

  const parseMenuText = (text: string): MenuItem[] => {
    const lines = text.trim().split('\n').filter(line => line.trim());
    const items: MenuItem[] = [];

    // Intentar parsear como JSON array primero
    try {
      const jsonData = JSON.parse(text.trim());
      if (Array.isArray(jsonData)) {
        for (const item of jsonData) {
          items.push({
            name: item.name || item.nombre || "",
            description: item.description || item.descripcion || "",
            price: parseInt(item.price || item.precio || 0),
            category: item.category || item.categoria || "Principal",
            emoji: item.emoji || "🍽️",
            image_url: item.image_url || item.imagen || ""
          });
        }
        return items;
      }
    } catch (error) {
      // No es JSON válido, continuar con parsing de texto
    }

    // Parsear formato de texto línea por línea
    for (const line of lines) {
      try {
        // Intentar parsear como JSON individual
        if (line.trim().startsWith('{')) {
          const item = JSON.parse(line.trim());
          items.push({
            name: item.name || item.nombre,
            description: item.description || item.descripcion || "",
            price: parseInt(item.price || item.precio || 0),
            category: item.category || item.categoria || "Principal",
            emoji: item.emoji || "🍽️",
            image_url: item.image_url || item.imagen || ""
          });
          continue;
        }

        // Parsear formato de texto: "Nombre - $Precio - Descripción - Categoría"
        const parts = line.split(' - ').map(p => p.trim());
        if (parts.length >= 2) {
          const name = parts[0];
          let price = 0;
          let description = "";
          let category = "Principal";

          // Buscar precio en las partes
          for (const part of parts) {
            if (part.includes('$') || part.includes('COP') || /^\d+$/.test(part.replace(/[,.]/g, ''))) {
              const priceMatch = part.replace(/[$,COP\s]/g, '').replace(',', '');
              price = parseInt(priceMatch) || 0;
            } else if (part !== name && !part.includes('$') && !/^\d+$/.test(part)) {
              if (!description) description = part;
              else category = part;
            }
          }

          items.push({
            name,
            description,
            price,
            category,
            emoji: "🍽️"
          });
        }
      } catch (error) {
        console.warn(`Error parsing line: ${line}`, error);
      }
    }

    return items;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId.trim() || !menuText.trim()) {
      toast({
        title: "Campos requeridos",
        description: "Por favor ingresa el ID del negocio y el menú.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    setResults({success: 0, errors: 0, messages: []});

    try {
      const menuItems = parseMenuText(menuText);

      if (menuItems.length === 0) {
        toast({
          title: "Error",
          description: "No se pudieron parsear items del menú. Verifica el formato.",
          variant: "destructive"
        });
        return;
      }

      let successCount = 0;
      let errorCount = 0;
      const messages: string[] = [];

      for (const item of menuItems) {
        try {
          const response = await fetch(`/api/businesses/${businessId}/menu`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: item.name,
              description: item.description || "",
              price: item.price,
              category: item.category,
              emoji: item.emoji || "🍽️",
              image_url: item.image_url || "",
              is_active: true
            }),
          });

          if (response.ok) {
            successCount++;
            messages.push(`✓ ${item.name}`);
          } else {
            errorCount++;
            const errorData = await response.json().catch(() => ({}));
            messages.push(`✗ ${item.name}: ${errorData.detail || 'Error desconocido'}`);
          }
        } catch (error) {
          errorCount++;
          messages.push(`✗ ${item.name}: Error de conexión`);
        }
      }

      setResults({success: successCount, errors: errorCount, messages});

      toast({
        title: "Carga completada",
        description: `${successCount} items creados, ${errorCount} errores.`,
        variant: errorCount > 0 ? "destructive" : "default"
      });

    } catch (error) {
      toast({
        title: "Error",
        description: "Error al procesar el menú.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border/60 rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-border/60">
          <h2 className="text-2xl font-display font-bold">Cargar Menú Completo</h2>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0 rounded-xl">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="space-y-2">
            <Label htmlFor="businessId" className="text-sm font-bold">ID del Negocio</Label>
            <Input
              id="businessId"
              value={businessId}
              onChange={(e) => setBusinessId(e.target.value)}
              placeholder="Ej: abc123def"
              className="rounded-xl"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="menuText" className="text-sm font-bold">Menú (una línea por producto)</Label>
            <Textarea
              id="menuText"
              value={menuText}
              onChange={(e) => setMenuText(e.target.value)}
              placeholder={`Formatos soportados:

1. TEXTO (una línea por producto):
Nombre - $Precio - Descripción - Categoría

2. JSON Array:
[
  {"name": "Producto 1", "price": 25000, "description": "Descripción", "category": "Categoría"},
  {"name": "Producto 2", "price": 30000, "description": "Descripción", "category": "Categoría"}
]

Ejemplos:

Texto:
Pizza Margherita - $25000 - Pizza clásica con salsa de tomate - Pizzas
Coca Cola 350ml - $5000 - Refresco de cola - Bebidas

JSON:
[{"name": "Pizza Margherita", "price": 25000, "description": "Pizza clásica", "category": "Pizzas"}, {"name": "Coca Cola", "price": 5000, "description": "Refresco", "category": "Bebidas"}]`}
              className="rounded-xl min-h-[200px] font-mono text-sm"
              required
            />
            <p className="text-xs text-muted-foreground">
              Soporta formato de texto separado por " - " o JSON array. Cada producto debe tener nombre y precio.
            </p>
          </div>

          {previewItems.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-bold">Vista Previa ({previewItems.length} productos)</Label>
              <div className="bg-muted/50 rounded-xl p-4 max-h-40 overflow-y-auto space-y-2">
                {previewItems.slice(0, 10).map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span>{item.emoji}</span>
                      <span className="font-medium">{item.name}</span>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-muted-foreground">{item.category}</span>
                    </div>
                    <span className="font-bold text-primary">${item.price.toLocaleString()}</span>
                  </div>
                ))}
                {previewItems.length > 10 && (
                  <div className="text-xs text-muted-foreground text-center pt-2">
                    ... y {previewItems.length - 10} productos más
                  </div>
                )}
              </div>
            </div>
          )}

          {results.messages.length > 0 && (
            <div className="bg-muted/50 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-bold">
                <CheckCircle className="h-4 w-4 text-green-500" />
                {results.success} exitosos, {results.errors} errores
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {results.messages.map((msg, idx) => (
                  <div key={idx} className="text-xs font-mono">
                    {msg}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 rounded-xl"
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="hero"
              className="flex-1 rounded-xl"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Cargando...
                </>
              ) : (
                <>
                  <Upload className="h-5 w-5 mr-2" />
                  Cargar Menú
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}