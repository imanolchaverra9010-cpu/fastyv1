import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Key, User, Mail, Lock, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface AdminCredentialsModalProps {
  business: any;
  onClose: () => void;
  onSuccess: () => void;
}

export const AdminCredentialsModal = ({ business, onClose, onSuccess }: AdminCredentialsModalProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: business.username || "",
    email: business.email || "",
    password: "",
  });

  const handleUpdate = async () => {
    if (!formData.username || !formData.email) {
      toast({ title: "Error", description: "El usuario y el correo son obligatorios.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/users/${business.owner_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: formData.username,
          email: formData.email,
          password: formData.password || undefined,
          is_admin_edit: true
        }),
      });

      if (response.ok) {
        toast({ title: "Éxito", description: "Credenciales actualizadas correctamente." });
        onSuccess();
        onClose();
      } else {
        const error = await response.json();
        throw new Error(error.detail || "Error al actualizar credenciales");
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] overflow-hidden rounded-3xl p-0 border-none shadow-glow">
        <div className="bg-primary p-6 text-white relative">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Key className="h-24 w-24 rotate-12" />
          </div>
          <DialogHeader className="relative z-10">
            <DialogTitle className="text-2xl font-black flex items-center gap-2">
              <Key className="h-6 w-6" /> Credenciales
            </DialogTitle>
            <DialogDescription className="text-primary-foreground/80 font-medium">
              Gestionar acceso para <span className="text-white font-bold">{business.name}</span>
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-5 bg-background">
          <div className="space-y-4">
            <div className="bg-muted/30 p-4 rounded-2xl border border-border/40">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">ID Propietario</p>
              <p className="text-sm font-mono font-bold text-primary">{business.owner_id}</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-muted-foreground uppercase flex items-center gap-2">
                <User className="h-3 w-3" /> Nombre de Usuario
              </label>
              <Input 
                value={formData.username}
                onChange={(e) => setFormData({...formData, username: e.target.value})}
                className="h-12 rounded-xl bg-muted/20 border-border/60 focus:ring-primary/20"
                placeholder="usuario_negocio"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-muted-foreground uppercase flex items-center gap-2">
                <Mail className="h-3 w-3" /> Correo Electrónico
              </label>
              <Input 
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="h-12 rounded-xl bg-muted/20 border-border/60 focus:ring-primary/20"
                placeholder="correo@ejemplo.com"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-muted-foreground uppercase flex items-center gap-2">
                <Lock className="h-3 w-3" /> Nueva Contraseña
              </label>
              <Input 
                type="text"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                className="h-12 rounded-xl bg-muted/20 border-border/60 focus:ring-primary/20 font-mono"
                placeholder="Dejar vacío para no cambiar"
              />
              <p className="text-[10px] text-muted-foreground">
                Actual: <span className="font-bold text-primary">{business.visible_password || 'No registrada'}</span>
              </p>
            </div>
          </div>

          <div className="bg-success/10 border border-success/20 p-4 rounded-2xl flex gap-3">
            <ShieldCheck className="h-5 w-5 text-success shrink-0 mt-0.5" />
            <p className="text-xs text-success-foreground font-medium">
              Como administrador, puedes cambiar estos datos sin conocer la contraseña actual del negocio.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={onClose}>
              Cancelar
            </Button>
            <Button 
              variant="hero" 
              className="flex-1 h-12 rounded-xl gap-2 shadow-glow"
              onClick={handleUpdate}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Actualizar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
