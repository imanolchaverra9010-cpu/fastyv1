import { Plus, Search, Users, Trash2, Edit, Bike, Phone, Star, DollarSign, X, User, Lock, Mail } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";
import { toast } from "@/hooks/use-toast";
import { formatCOP } from "@/data/mock";

const AdminCouriers = () => {
  const [couriers, setCouriers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCourier, setEditingCourier] = useState<any>(null);

  const fetchCouriers = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/couriers");
      if (response.ok) {
        const data = await response.json();
        setCouriers(data);
      }
    } catch (error) {
      console.error("Error fetching couriers:", error);
      toast({ title: "Error", description: "No se pudieron cargar los domiciliarios.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCouriers();
  }, []);

  const deleteCourier = async (id: number) => {
    if (!confirm("¿Eliminar este domiciliario?")) return;
    try {
      const response = await fetch(`/api/admin/couriers/${id}`, { method: "DELETE" });
      if (response.ok) {
        toast({ title: "Eliminado", description: "Domiciliario eliminado correctamente." });
        fetchCouriers();
      }
    } catch (error) {
      toast({ title: "Error", description: "No se pudo eliminar.", variant: "destructive" });
    }
  };

  const filteredCouriers = (couriers || []).filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.vehicle.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-gradient-warm">
        <AdminSidebar />
        <SidebarInset className="flex-1">
          <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-border/60 bg-background/75 backdrop-blur-xl px-4 md:px-6">
            <SidebarTrigger className="-ml-1" />
            <div className="h-4 w-px bg-border/60 mx-2" />
            <h2 className="text-sm font-semibold text-muted-foreground">Gestión de Domiciliarios</h2>
          </header>

          <main className="p-4 md:p-8 max-w-7xl mx-auto w-full">
            <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <p className="text-sm text-primary font-semibold">Administración</p>
                <h1 className="text-4xl font-display font-bold tracking-tight">Domiciliarios</h1>
                <p className="text-muted-foreground mt-1">Administra el equipo de reparto de la plataforma.</p>
              </div>
              <Button variant="hero" className="h-11 rounded-xl gap-2" onClick={() => setIsModalOpen(true)}>
                <Plus className="h-5 w-5" /> Nuevo Domiciliario
              </Button>
            </div>

            <div className="rounded-2xl bg-card border border-border/60 shadow-card overflow-hidden">
              <div className="p-5 border-b border-border/60 flex items-center justify-end bg-muted/20">
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nombre o vehículo…"
                    className="pl-9 h-9 rounded-lg text-xs"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-5 py-3 font-medium">Domiciliario</th>
                      <th className="text-left px-5 py-3 font-medium">Vehículo</th>
                      <th className="text-left px-5 py-3 font-medium">Credenciales</th>
                      <th className="text-left px-5 py-3 font-medium">Estado</th>
                      <th className="text-right px-5 py-3 font-medium">Entregas</th>
                      <th className="text-right px-5 py-3 font-medium">Calificación</th>
                      <th className="text-right px-5 py-3 font-medium">Ganancias</th>
                      <th className="text-right px-5 py-3 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {loading ? (
                      <tr><td colSpan={8} className="px-5 py-10 text-center animate-pulse">Cargando equipo...</td></tr>
                    ) : filteredCouriers.map((c) => (
                      <tr key={c.id} className="hover:bg-muted/30 transition-colors group">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-gradient-hero flex items-center justify-center text-white font-bold text-xs shadow-soft">
                              {c.name.split(" ").map((n: any) => n[0]).join("").slice(0, 2)}
                            </div>
                            <div>
                              <p className="font-bold">{c.name}</p>
                              <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Phone className="h-2.5 w-2.5" /> {c.phone}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                            <Bike className="h-3.5 w-3.5" /> {c.vehicle}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="text-xs">
                            <p className="font-mono text-primary font-bold">{c.username}</p>
                            <p className="text-muted-foreground font-mono">{c.visible_password || '********'}</p>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${c.status === "online" ? "bg-success/10 text-success" :
                              c.status === "busy" ? "bg-warning/15 text-warning-foreground" :
                                "bg-muted text-muted-foreground"
                            }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${c.status === "online" ? "bg-success animate-pulse" :
                                c.status === "busy" ? "bg-warning" : "bg-muted-foreground"
                              }`} />
                            {c.status === "online" ? "En línea" : c.status === "busy" ? "Ocupado" : "Offline"}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right font-bold text-muted-foreground">
                          {c.deliveries}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1 font-bold">
                            <Star className="h-3 w-3 fill-warning text-warning" />
                            {c.rating?.toFixed(1)}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right font-bold text-primary">
                          {formatCOP(c.earnings)}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-muted-foreground hover:text-primary"
                              onClick={() => {
                                setEditingCourier(c);
                                setIsModalOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:bg-destructive/10"
                              onClick={() => deleteCourier(c.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </main>
        </SidebarInset>

        {isModalOpen && (
          <CourierModal
            courier={editingCourier}
            onClose={() => {
              setIsModalOpen(false);
              setEditingCourier(null);
            }}
            onSuccess={fetchCouriers}
          />
        )}
      </div>
    </SidebarProvider>
  );
};

interface CourierModalProps {
  courier?: any;
  onClose: () => void;
  onSuccess: () => void;
}

const CourierModal = ({ courier, onClose, onSuccess }: CourierModalProps) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    vehicle: "Moto",
    username: "",
    email: "",
    password: ""
  });

  useEffect(() => {
    if (courier) {
      setFormData({
        name: courier.name || "",
        phone: courier.phone || "",
        vehicle: courier.vehicle || "Moto",
        username: courier.username || "",
        email: courier.email || "",
        password: ""
      });
    }
  }, [courier]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const url = courier
        ? `/api/admin/couriers/${courier.id}`
        : "/api/admin/couriers";

      // Si estamos editando, solo enviamos los campos permitidos por el backend
      // Si estamos editando o creando, construimos el payload
      const payload: any = {
        name: formData.name,
        phone: formData.phone,
        vehicle: formData.vehicle,
        email: formData.email
      };

      if (formData.password) {
        payload.password = formData.password;
      }

      if (!courier) {
        payload.username = formData.username;
      }

      const response = await fetch(url, {
        method: courier ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        toast({ title: "Éxito", description: `Domiciliario ${courier ? 'actualizado' : 'creado'} correctamente.` });
        onSuccess();
        onClose();
      } else {
        const errorData = await response.json();
        toast({ title: "Error", description: errorData.detail || "No se pudo completar la operación.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Ocurrió un error inesperado.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="bg-card w-full max-w-md rounded-3xl border border-border/60 shadow-glow overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-border/60 flex items-center justify-between bg-primary text-primary-foreground">
          <h2 className="text-xl font-display font-bold flex items-center gap-2">
            <Bike className="h-5 w-5" /> {courier ? 'Editar Domiciliario' : 'Nuevo Domiciliario'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Nombre Completo</label>
            <Input
              required
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="h-11 rounded-xl"
              placeholder="ej: Juan Pérez"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Teléfono / WhatsApp</label>
            <Input
              required
              value={formData.phone}
              onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              className="h-11 rounded-xl"
              placeholder="ej: 3001234567"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Tipo de Vehículo</label>
            <select
              className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm shadow-soft outline-none focus:ring-2 focus:ring-primary/20"
              value={formData.vehicle}
              onChange={e => setFormData(prev => ({ ...prev, vehicle: e.target.value }))}
            >
              <option value="Moto">Moto</option>
              <option value="Bicicleta">Bicicleta</option>
              <option value="Auto">Auto</option>
              <option value="Scooter">Scooter</option>
            </select>
          </div>

          <div className="pt-2 border-t border-border/60">
            <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-3">Credenciales de Acceso</p>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <User className="h-3 w-3" /> Usuario
                </label>
                <Input
                  required
                  disabled={!!courier}
                  value={formData.username}
                  onChange={e => setFormData(prev => ({ ...prev, username: e.target.value }))}
                  className={`h-11 rounded-xl ${courier ? 'bg-muted cursor-not-allowed' : ''}`}
                  placeholder="ej: juan_perez"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Mail className="h-3 w-3" /> Correo Electrónico
                </label>
                <Input
                  required
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="h-11 rounded-xl"
                  placeholder="ej: juan@example.com"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Lock className="h-3 w-3" /> {courier ? 'Nueva Contraseña (opcional)' : 'Contraseña'}
                </label>
                <Input
                  required={!courier}
                  type="password"
                  value={formData.password}
                  onChange={e => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  className="h-11 rounded-xl"
                  placeholder={courier ? "Dejar en blanco para no cambiar" : "Mínimo 6 caracteres"}
                />
              </div>
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <Button type="button" variant="outline" className="flex-1 rounded-xl" onClick={onClose}>Cancelar</Button>
            <Button type="submit" variant="hero" className="flex-[2] rounded-xl font-bold" disabled={loading}>
              {loading ? "Guardando..." : (courier ? "Actualizar" : "Crear Domiciliario")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminCouriers;
