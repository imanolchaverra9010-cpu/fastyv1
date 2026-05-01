import { Plus, Search, Store, Trash2, Edit, Utensils, MoreVertical, Key } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";
import { BusinessModal } from "@/components/BusinessModal";
import { MenuManagerModal } from "@/components/MenuManagerModal";
import { AdminCredentialsModal } from "@/components/admin/AdminCredentialsModal";
import { toast } from "@/hooks/use-toast";
import StatusBadge from "@/components/StatusBadge";

const AdminBusinesses = () => {
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState<any>(null);
  const [managingMenuBusiness, setManagingMenuBusiness] = useState<any>(null);
  const [credentialsBusiness, setCredentialsBusiness] = useState<any>(null);

  const fetchBusinesses = async () => {
    setLoading(true);
    try {
      const url = filter === "all" ? "/api/businesses" : `/api/businesses?status_filter=${filter}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setBusinesses(data);
      }
    } catch (error) {
      console.error("Error fetching businesses:", error);
      toast({ title: "Error", description: "No se pudieron cargar los negocios.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

// ... (fetchBusinesses y useEffect se mantienen igual)

  useEffect(() => {
    fetchBusinesses();
  }, [filter]);

// ... (toggleStatus y deleteBusiness se mantienen igual)

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      const response = await fetch(`/api/businesses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (response.ok) {
        toast({ title: "Éxito", description: `Negocio ${newStatus === 'active' ? 'activado' : 'desactivado'}.` });
        fetchBusinesses();
      }
    } catch (error) {
      toast({ title: "Error", description: "No se pudo actualizar el estado.", variant: "destructive" });
    }
  };

  const deleteBusiness = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar este negocio?")) return;
    try {
      const response = await fetch(`/api/businesses/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        toast({ title: "Eliminado", description: "Negocio eliminado correctamente." });
        fetchBusinesses();
      }
    } catch (error) {
      toast({ title: "Error", description: "No se pudo eliminar el negocio.", variant: "destructive" });
    }
  };

  const filteredBusinesses = (businesses || []).filter(b =>
    b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-gradient-warm">
        <AdminSidebar />
        <SidebarInset className="flex-1">
          <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-border/60 bg-background/75 backdrop-blur-xl px-4 md:px-6">
            <SidebarTrigger className="-ml-1" />
            <div className="h-4 w-px bg-border/60 mx-2" />
            <h2 className="text-sm font-semibold text-muted-foreground">Gestión de Negocios</h2>
          </header>

          <main className="p-4 md:p-8 max-w-7xl mx-auto w-full">
            <div className="mb-6 md:mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <p className="text-xs md:text-sm text-primary font-semibold">Administración</p>
                <h1 className="text-2xl md:text-4xl font-display font-bold tracking-tight">Negocios</h1>
                <p className="text-sm text-muted-foreground mt-1">Controla los aliados y establecimientos de la plataforma.</p>
              </div>
              <Button variant="hero" className="h-11 rounded-xl gap-2 w-full md:w-auto" onClick={() => setIsModalOpen(true)}>
                <Plus className="h-5 w-5" /> Nuevo Negocio
              </Button>
            </div>

            <div className="rounded-2xl bg-card border border-border/60 shadow-card overflow-hidden">
              <div className="p-5 border-b border-border/60 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-muted/20">
                <div className="flex items-center gap-4">
                  <select
                    className="h-9 rounded-lg border-border/60 bg-background px-3 text-xs font-medium shadow-soft outline-none focus:ring-2 focus:ring-primary/20"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option value="all">Todos los estados</option>
                    <option value="active">Activos</option>
                    <option value="inactive">Inactivos</option>
                    <option value="pending">Pendientes</option>
                  </select>
                </div>
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar negocio o categoría…"
                    className="pl-9 h-9 rounded-lg text-xs"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              
              {/* Vista de Escritorio: Tabla */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-5 py-3 font-medium">Negocio</th>
                      <th className="text-left px-5 py-3 font-medium">Categoría</th>
                      <th className="text-left px-5 py-3 font-medium">Credenciales</th>
                      <th className="text-left px-5 py-3 font-medium">Ubicación</th>
                      <th className="text-center px-5 py-3 font-medium">Rating</th>
                      <th className="text-left px-5 py-3 font-medium">Estado</th>
                      <th className="text-right px-5 py-3 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {loading ? (
                      <tr><td colSpan={7} className="px-5 py-10 text-center animate-pulse">Cargando aliados...</td></tr>
                    ) : (filteredBusinesses || []).map((b) => (
                      <tr key={b.id} className="hover:bg-muted/30 transition-colors group">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl h-10 w-10 rounded-lg bg-muted flex items-center justify-center">{b.emoji}</span>
                            <div>
                              <p className="font-bold">{b.name}</p>
                              <p className="text-xs text-muted-foreground">ID: {b.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="px-2 py-1 rounded-md bg-primary/5 text-primary text-xs font-medium">
                            {b.category}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="text-xs space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-primary">{b.username}</span>
                            </div>
                            <div className="text-muted-foreground truncate max-w-[140px]" title={b.email}>
                              {b.email || 'Sin correo'}
                            </div>
                            <div className="font-mono bg-muted px-1.5 py-0.5 rounded text-[10px] w-fit font-bold">
                              {b.visible_password || '********'}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-muted-foreground text-xs max-w-[150px] truncate">
                          <p>{b.address || 'Sin dirección'}</p>
                          {b.latitude && b.longitude && (
                            <p className="text-[10px] text-primary/70">{b.latitude.toFixed(4)}, {b.longitude.toFixed(4)}</p>
                          )}
                        </td>
                        <td className="px-5 py-4 text-center font-bold">
                          {b.rating.toFixed(1)} ⭐
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge status={b.status} />
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1 md:opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-muted-foreground hover:text-primary"
                              onClick={() => setCredentialsBusiness(b)}
                              title="Gestionar Credenciales"
                            >
                              <Key className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-muted-foreground hover:text-primary"
                              onClick={() => {
                                setEditingBusiness(b);
                                setIsModalOpen(true);
                              }}
                              title="Editar Negocio"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-muted-foreground hover:text-primary"
                              onClick={() => setManagingMenuBusiness(b)}
                              title="Gestionar Menú"
                            >
                              <Utensils className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className={`h-8 w-8 ${b.status === 'active' ? 'text-orange-500' : 'text-green-500'}`}
                              onClick={() => toggleStatus(b.id, b.status)}
                              title={b.status === 'active' ? 'Desactivar' : 'Activar'}
                            >
                              <Store className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:bg-destructive/10"
                              onClick={() => deleteBusiness(b.id)}
                              title="Eliminar"
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

              {/* Vista Móvil: Tarjetas */}
              <div className="md:hidden divide-y divide-border/60">
                {loading ? (
                  <div className="p-10 text-center animate-pulse">Cargando aliados...</div>
                ) : filteredBusinesses.map((b) => (
                  <div key={b.id} className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl h-10 w-10 rounded-lg bg-muted flex items-center justify-center">{b.emoji}</span>
                        <div>
                          <p className="font-bold text-sm">{b.name}</p>
                          <span className="px-2 py-0.5 rounded-md bg-primary/5 text-primary text-[10px] font-medium">
                            {b.category}
                          </span>
                        </div>
                      </div>
                      <StatusBadge status={b.status} />
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs bg-muted/20 p-3 rounded-xl">
                      <div className="col-span-2 border-b border-border/40 pb-2 mb-1">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1 tracking-widest">Ubicación</p>
                        <p className="truncate">{b.address || 'Sin dirección'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1 tracking-widest">Credenciales</p>
                        <p className="font-bold text-primary">{b.username}</p>
                        <p className="font-mono text-[9px] text-muted-foreground">{b.visible_password || '********'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1 tracking-widest text-right">Rating</p>
                        <p className="font-bold">{b.rating.toFixed(1)} ⭐</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-around pt-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-10 flex-1 flex-col gap-1 text-[10px] text-muted-foreground"
                        onClick={() => setCredentialsBusiness(b)}
                      >
                        <Key className="h-4 w-4" /> Llaves
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-10 flex-1 flex-col gap-1 text-[10px] text-muted-foreground"
                        onClick={() => {
                          setEditingBusiness(b);
                          setIsModalOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" /> Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-10 flex-1 flex-col gap-1 text-[10px] text-muted-foreground"
                        onClick={() => setManagingMenuBusiness(b)}
                      >
                        <Utensils className="h-4 w-4" /> Menú
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className={`h-10 flex-1 flex-col gap-1 text-[10px] ${b.status === 'active' ? 'text-orange-500' : 'text-green-500'}`}
                        onClick={() => toggleStatus(b.id, b.status)}
                      >
                        <Store className="h-4 w-4" /> {b.status === 'active' ? 'Off' : 'On'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-10 flex-1 flex-col gap-1 text-[10px] text-destructive"
                        onClick={() => deleteBusiness(b.id)}
                      >
                        <Trash2 className="h-4 w-4" /> Borrar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </main>
        </SidebarInset>
        {isModalOpen && (
          <BusinessModal
            business={editingBusiness}
            onClose={() => {
              setIsModalOpen(false);
              setEditingBusiness(null);
            }}
            onSuccess={fetchBusinesses}
          />
        )}
        {managingMenuBusiness && (
          <MenuManagerModal
            businessId={managingMenuBusiness.id}
            businessName={managingMenuBusiness.name}
            onClose={() => setManagingMenuBusiness(null)}
          />
        )}
        {credentialsBusiness && (
          <AdminCredentialsModal
            business={credentialsBusiness}
            onClose={() => setCredentialsBusiness(null)}
            onSuccess={fetchBusinesses}
          />
        )}
      </div>
    </SidebarProvider>
  );
};

export default AdminBusinesses;
