import { useState, useEffect } from "react";
import { 
  Palette, 
  Check, 
  RotateCcw, 
  Sparkles, 
  Heart, 
  Info, 
  ShoppingBag, 
  Search, 
  Smartphone, 
  Gamepad2, 
  Dog,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";
import { applyTheme, getThemeColor, resetTheme } from "@/utils/theme";
import { toast } from "@/hooks/use-toast";

const colorPresets = [
  { name: "Fasty Naranja (Original)", hex: "#f97316", class: "bg-[#f97316]" },
  { name: "Verde Kemi / Teal", hex: "#0d8496", class: "bg-[#0d8496]" },
  { name: "Púrpura Cyberpunk", hex: "#8b5cf6", class: "bg-[#8b5cf6]" },
  { name: "Verde Esmeralda", hex: "#10b981", class: "bg-[#10b981]" },
  { name: "Azul Real", hex: "#3b82f6", class: "bg-[#3b82f6]" },
  { name: "Rosa Eléctrico", hex: "#ec4899", class: "bg-[#ec4899]" },
  { name: "Rojo Carmesí", hex: "#ef4444", class: "bg-[#ef4444]" },
];

export default function AdminColors() {
  const [selectedColor, setSelectedColor] = useState("#f97316");
  const [originalColor, setOriginalColor] = useState("#f97316");
  const [inputVal, setInputVal] = useState("#f97316");
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Load current theme color on mount
  useEffect(() => {
    // Primero cargamos del cache local para respuesta instantánea
    const activeColor = getThemeColor();
    setSelectedColor(activeColor);
    setOriginalColor(activeColor);
    setInputVal(activeColor);

    // Luego consultamos al backend para sincronizar
    const fetchLatestTheme = async () => {
      try {
        const res = await fetch("/api/theme-color");
        if (res.ok) {
          const data = await res.json();
          if (data.theme_color) {
            setSelectedColor(data.theme_color);
            setOriginalColor(data.theme_color);
            setInputVal(data.theme_color);
            applyTheme(data.theme_color);
          }
        }
      } catch (err) {
        console.error("Error al sincronizar color del backend:", err);
      }
    };
    fetchLatestTheme();
  }, []);

  // Update theme as the user selects a color (real-time preview)
  const handleColorChange = (hex: string) => {
    // Basic hex validation
    const hexPattern = /^#([0-9a-fA-F]{3}){1,2}$/;
    if (hexPattern.test(hex)) {
      setSelectedColor(hex);
      setInputVal(hex);
      applyTheme(hex);
    } else {
      setInputVal(hex);
    }
  };

  const handlePickerChange = (hex: string) => {
    setSelectedColor(hex);
    setInputVal(hex);
    applyTheme(hex);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/theme-color", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme_color: selectedColor }),
      });

      if (response.ok) {
        applyTheme(selectedColor);
        setOriginalColor(selectedColor);
        toast({
          title: "Tema guardado correctamente",
          description: `El color de la plataforma se ha guardado en la base de datos y actualizado a ${selectedColor.toUpperCase()} para todos los clientes de forma persistente.`,
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Error al guardar el tema.");
      }
    } catch (err: any) {
      toast({
        title: "Error al guardar",
        description: err.message || "No se pudo conectar con el servidor.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    setIsResetting(true);
    try {
      const response = await fetch("/api/admin/theme-color", {
        method: "DELETE",
      });

      if (response.ok) {
        resetTheme();
        setSelectedColor("#f97316");
        setOriginalColor("#f97316");
        setInputVal("#f97316");
        toast({
          title: "Tema restaurado",
          description: "Se ha restablecido el color naranja predeterminado de Fasty en la base de datos y en toda la plataforma.",
        });
      } else {
        throw new Error("Error al restaurar el tema.");
      }
    } catch (err: any) {
      toast({
        title: "Error al restaurar",
        description: err.message || "No se pudo conectar con el servidor.",
        variant: "destructive",
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-gradient-warm">
        <AdminSidebar />
        <SidebarInset className="flex-1">
          <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-border/60 bg-background/75 backdrop-blur-xl px-4 md:px-6">
            <SidebarTrigger className="-ml-1" />
            <div className="h-4 w-px bg-border/60 mx-2" />
            <h2 className="text-sm font-semibold text-muted-foreground">Personalización</h2>
          </header>

          <main className="p-4 md:p-8 max-w-7xl mx-auto w-full">
            <div className="mb-6 md:mb-8">
              <p className="text-xs md:text-sm text-primary font-semibold">Administración</p>
              <h1 className="text-2xl md:text-4xl font-display font-bold tracking-tight">Colores del Sitio</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Personaliza la paleta de colores global y los gradientes del sitio en tiempo real.
              </p>
            </div>

            <div className="grid lg:grid-cols-12 gap-8">
              {/* Left Column: Color Controls */}
              <div className="lg:col-span-5 space-y-6">
                
                {/* Custom Color Selector */}
                <div className="rounded-3xl bg-card border border-border/60 p-6 shadow-card space-y-5">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Palette className="h-5 w-5 text-primary" />
                    Color de Acento
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Elige el color primario de la plataforma. Generará automáticamente las tonalidades de brillo, anillos de enfoque y degradados premium de fondo.
                  </p>

                  <div className="flex items-center gap-4 bg-muted/20 p-4 rounded-2xl border border-border/40">
                    <div className="relative h-14 w-14 rounded-xl overflow-hidden shadow-soft shrink-0 border border-border/60 cursor-pointer hover:scale-105 transition-transform">
                      <input 
                        type="color" 
                        value={selectedColor} 
                        onChange={(e) => handlePickerChange(e.target.value)}
                        className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
                      />
                      <div 
                        className="h-full w-full transition-colors duration-200" 
                        style={{ backgroundColor: selectedColor }}
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Código Hexadecimal</label>
                      <Input 
                        value={inputVal}
                        onChange={(e) => handleColorChange(e.target.value)}
                        placeholder="#f97316"
                        className="h-10 rounded-xl font-mono text-sm uppercase tracking-wider"
                      />
                    </div>
                  </div>
                </div>

                {/* Gorgeous Color Presets */}
                <div className="rounded-3xl bg-card border border-border/60 p-6 shadow-card space-y-4">
                  <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
                    Ajustes Preestablecidos
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {colorPresets.map((preset) => {
                      const isActive = selectedColor.toLowerCase() === preset.hex.toLowerCase();
                      return (
                        <button
                          key={preset.hex}
                          onClick={() => handlePickerChange(preset.hex)}
                          className={`flex items-center gap-3 p-3 rounded-2xl border text-left text-xs font-medium transition-all ${
                            isActive 
                              ? "border-primary bg-primary/5 text-primary shadow-soft" 
                              : "border-border/40 hover:bg-muted/50 text-foreground"
                          }`}
                        >
                          <div className={`h-6 w-6 rounded-full shrink-0 border border-black/10 ${preset.class}`} />
                          <span className="truncate">{preset.name}</span>
                          {isActive && <Check className="h-4 w-4 ml-auto shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Save and Reset Panel */}
                <div className="flex gap-4">
                  <Button 
                    onClick={handleSave} 
                    disabled={isSaving || isResetting}
                    className="flex-1 rounded-2xl h-12 gap-2 text-sm font-bold"
                  >
                    {isSaving ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Check className="h-5 w-5" />
                    )}
                    {isSaving ? "Guardando..." : "Guardar Cambios"}
                  </Button>
                  <Button 
                    onClick={handleReset} 
                    disabled={isSaving || isResetting}
                    variant="outline" 
                    className="rounded-2xl h-12 gap-2 text-sm font-semibold border-primary/20 hover:bg-primary/5 text-muted-foreground hover:text-foreground"
                  >
                    {isResetting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="h-4 w-4" />
                    )}
                    {isResetting ? "Restaurando..." : "Restaurar"}
                  </Button>
                </div>

                {/* Information Card */}
                <div className="rounded-2xl bg-primary/5 border border-primary/20 p-4 flex gap-3 text-xs text-primary/80">
                  <Info className="h-5 w-5 shrink-0 text-primary mt-0.5" />
                  <p>
                    <strong>Nota:</strong> Los cambios se aplican de forma inmediata a toda la sesión actual. Al hacer clic en <strong>Guardar Cambios</strong>, la configuración persistirá entre visitas y navegaciones para todos los usuarios que entren a la plataforma.
                  </p>
                </div>

              </div>

              {/* Right Column: High Fidelity Live Preview Mockup */}
              <div className="lg:col-span-7 space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
                    Previsualización en Vivo
                  </h3>
                  <div className="text-xs bg-muted/60 px-3 py-1 rounded-full text-muted-foreground font-medium flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3 text-primary animate-pulse" />
                    Modo interactivo
                  </div>
                </div>

                {/* The Mockup Shell */}
                <div className="rounded-3xl border border-border/60 bg-muted/20 p-4 md:p-6 shadow-glow relative overflow-hidden backdrop-blur-sm">
                  
                  {/* Mock Browser/App Header */}
                  <div className="bg-background rounded-2xl border border-border/40 shadow-soft overflow-hidden">
                    
                    {/* Header Top bar */}
                    <div className="bg-muted/40 h-8 px-4 flex items-center justify-between border-b border-border/20">
                      <div className="flex gap-1.5">
                        <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
                        <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                        <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono bg-muted/60 px-4 py-0.5 rounded-full">
                        https://fasty.app/preview
                      </div>
                      <div className="w-8" />
                    </div>

                    {/* Fasty Layout Mock */}
                    <div className="p-4 space-y-4 text-left">
                      
                      {/* Brand Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-black text-sm">
                            F
                          </div>
                          <span className="font-display font-black text-lg text-foreground">
                            Fasty
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-xs font-semibold text-primary">Iniciar Sesión</span>
                          <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                            <Heart className="h-3.5 w-3.5 fill-current" />
                          </div>
                        </div>
                      </div>

                      {/* Mock Hero Card */}
                      <div className="bg-gradient-hero text-primary-foreground p-5 rounded-2xl relative overflow-hidden shadow-glow">
                        <div className="relative z-10 space-y-2 max-w-[70%]">
                          <span className="text-[10px] font-bold uppercase tracking-widest bg-white/20 px-2 py-0.5 rounded-full">
                            PROMO DE HOY
                          </span>
                          <h4 className="font-display font-bold text-lg leading-tight">
                            ¡Pide hoy con Domicilio Gratis!
                          </h4>
                          <p className="text-[10px] opacity-90 leading-normal">
                            Disfruta de tus restaurantes favoritos en casa en cuestión de minutos.
                          </p>
                          <button className="bg-white text-primary text-[10px] font-bold px-3 py-1.5 rounded-xl shadow-soft hover:scale-[1.03] transition-transform mt-1">
                            Ver Restaurantes
                          </button>
                        </div>
                        {/* Abstract Background circles */}
                        <div className="absolute right-[-10px] bottom-[-20px] h-32 w-32 rounded-full bg-white/10" />
                        <div className="absolute right-[-30px] top-[-30px] h-24 w-24 rounded-full bg-white/5" />
                      </div>

                      {/* Search Bar Mock */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <div className="w-full bg-muted/40 h-9 rounded-xl pl-9 flex items-center text-xs text-muted-foreground border border-border/20">
                          ¿Qué se te antoja hoy?
                        </div>
                      </div>

                      {/* Circular Categories Mock */}
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Categorías</span>
                        <div className="flex justify-between">
                          <div className="flex flex-col items-center gap-1">
                            <div className="h-10 w-10 rounded-full bg-[#fdf2e9] text-primary flex items-center justify-center shadow-soft">
                              <Dog className="h-4 w-4" />
                            </div>
                            <span className="text-[9px] text-muted-foreground font-medium">Mascotas</span>
                          </div>
                          <div className="flex flex-col items-center gap-1">
                            <div className="h-10 w-10 rounded-full bg-[#f3e8ff] text-primary flex items-center justify-center shadow-soft">
                              <Sparkles className="h-4 w-4" />
                            </div>
                            <span className="text-[9px] text-muted-foreground font-medium">Cuidado</span>
                          </div>
                          <div className="flex flex-col items-center gap-1">
                            <div className="h-10 w-10 rounded-full bg-[#e0f2fe] text-primary flex items-center justify-center shadow-soft">
                              <Gamepad2 className="h-4 w-4" />
                            </div>
                            <span className="text-[9px] text-muted-foreground font-medium">Gaming</span>
                          </div>
                          <div className="flex flex-col items-center gap-1">
                            <div className="h-10 w-10 rounded-full bg-[#ecfdf5] text-primary flex items-center justify-center shadow-soft">
                              <Smartphone className="h-4 w-4" />
                            </div>
                            <span className="text-[9px] text-muted-foreground font-medium">Celulares</span>
                          </div>
                        </div>
                      </div>

                      {/* Action buttons mock */}
                      <div className="border-t border-border/20 pt-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div className="bg-primary/10 text-primary px-2.5 py-1 rounded-lg text-[9px] font-bold flex items-center gap-1">
                            <ShoppingBag className="h-3 w-3" />
                            Carrito
                          </div>
                          <span className="text-[10px] text-muted-foreground">1 item · $14,900</span>
                        </div>
                        <div className="flex gap-2">
                          <button className="border border-primary text-primary text-[10px] font-bold px-3 py-1.5 rounded-lg hover:bg-primary/5 transition-colors">
                            Detalles
                          </button>
                          <button className="bg-primary text-primary-foreground text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-soft hover:bg-primary/95 transition-colors">
                            Proceder al Pago
                          </button>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Dynamic Color Ring visualization */}
                  <div className="mt-4 flex items-center justify-between bg-background/60 p-3 rounded-2xl border border-border/40 text-xs">
                    <span className="font-semibold text-muted-foreground">Estado Activo:</span>
                    <span className="font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                      {selectedColor.toUpperCase()}
                    </span>
                  </div>

                </div>
              </div>

            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
