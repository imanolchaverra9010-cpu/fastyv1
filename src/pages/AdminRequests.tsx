import { useState, useEffect } from "react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Info,
  Loader2,
  ChevronRight,
  Utensils,
  Store,
  MapPin,
  Phone,
  Mail
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface BusinessRequest {
  id: number;
  name: string;
  email: string;
  phone: string;
  address: string;
  category: string;
  description: string;
  menu_json: any[];
  image_url?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

const AdminRequests = () => {
  const [requests, setRequests] = useState<BusinessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<BusinessRequest | null>(null);
  const [processing, setProcessing] = useState<number | null>(null);

  const fetchRequests = async () => {
    try {
      const response = await fetch("/api/businesses/admin/requests");
      if (response.ok) {
        setRequests(await response.json());
      }
    } catch (error) {
      console.error("Error fetching requests:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleApprove = async (id: number) => {
    setProcessing(id);
    try {
      const response = await fetch(`/api/businesses/admin/requests/${id}/approve`, {
        method: "POST"
      });
      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Solicitud aprobada",
          description: `Negocio creado. Usuario: ${data.username}, Clave temporal: ${data.temp_password}`
        });
        fetchRequests();
        setSelectedRequest(null);
      } else {
        throw new Error(data.detail || "Error al aprobar");
      }
    } catch (error: any) {
      toast({
        title: "No se pudo aprobar",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (id: number) => {
    setProcessing(id);
    try {
      const response = await fetch(`/api/businesses/admin/requests/${id}/reject`, {
        method: "POST"
      });
      if (response.ok) {
        toast({ title: "Solicitud rechazada" });
        fetchRequests();
        setSelectedRequest(null);
      }
    } catch (error) {
      toast({ title: "Error", description: "No se pudo rechazar la solicitud", variant: "destructive" });
    } finally {
      setProcessing(null);
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
            <h2 className="text-sm font-semibold text-muted-foreground capitalize">
              Solicitudes de Negocios
            </h2>
          </header>

          <main className="p-4 md:p-8 max-w-7xl mx-auto w-full">
            <div className="mb-8">
              <h1 className="text-4xl font-display font-bold tracking-tight">Solicitudes</h1>
              <p className="text-muted-foreground mt-1">Nuevos negocios esperando aprobación para unirse a Fasty.</p>
            </div>

            {loading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
              </div>
            ) : (
              <div className="grid lg:grid-cols-[1fr_400px] gap-8">
                <div className="space-y-4">
                  {requests.length === 0 ? (
                    <div className="bg-card border border-border/60 rounded-2xl p-12 text-center">
                      <Utensils className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                      <p className="text-muted-foreground">No hay solicitudes pendientes.</p>
                    </div>
                  ) : (
                    requests.map((req) => (
                      <div
                        key={req.id}
                        onClick={() => setSelectedRequest(req)}
                        className={`group bg-card border-2 rounded-2xl p-6 transition-all cursor-pointer hover:shadow-glow
                          ${selectedRequest?.id === req.id ? 'border-primary shadow-glow' : 'border-border/60'}
                        `}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold">
                              {req.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <h3 className="font-bold text-lg">{req.name}</h3>
                              <p className="text-sm text-muted-foreground">{req.category} · {new Date(req.created_at).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant={req.status === 'pending' ? 'outline' : 'secondary'} className="capitalize">
                              {req.status === 'pending' ? 'Pendiente' : 
                               req.status === 'approved' ? 'Aprobado' : 
                               req.status === 'rejected' ? 'Rechazado' : req.status}
                            </Badge>
                            <ChevronRight className={`h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 ${selectedRequest?.id === req.id ? 'rotate-90 md:rotate-0' : ''}`} />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <aside>
                  {selectedRequest ? (
                    <div className="bg-card border-2 border-border/60 rounded-3xl p-8 sticky top-24 shadow-card animate-in fade-in slide-in-from-right-4">
                      <h2 className="text-2xl font-display font-bold mb-6">Detalle de Solicitud</h2>

                      <div className="space-y-6">
                        <section className="space-y-4">
                          <div className="flex items-start gap-3">
                            <Store className="h-5 w-5 text-primary mt-0.5" />
                            <div className="flex-1">
                              <p className="text-xs font-bold text-muted-foreground uppercase">Negocio</p>
                              <div className="flex items-center gap-3 mt-1">
                                {selectedRequest.image_url && (
                                  <div className="h-12 w-12 rounded-lg overflow-hidden border border-border">
                                    <img src={selectedRequest.image_url.startsWith("http") ? selectedRequest.image_url : (selectedRequest.image_url.startsWith("/api") ? selectedRequest.image_url : `/api${selectedRequest.image_url}`)} alt="Logo" className="h-full w-full object-cover" />
                                  </div>
                                )}
                                <div>
                                  <p className="font-semibold">{selectedRequest.name}</p>
                                  <p className="text-sm text-muted-foreground">{selectedRequest.category}</p>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-start gap-3">
                            <MapPin className="h-5 w-5 text-primary mt-0.5" />
                            <div>
                              <p className="text-xs font-bold text-muted-foreground uppercase">Dirección</p>
                              <p className="text-sm">{selectedRequest.address}</p>
                            </div>
                          </div>

                          <div className="flex items-start gap-3">
                            <Mail className="h-5 w-5 text-primary mt-0.5" />
                            <div>
                              <p className="text-xs font-bold text-muted-foreground uppercase">Email</p>
                              <p className="text-sm">{selectedRequest.email}</p>
                            </div>
                          </div>

                          <div className="flex items-start gap-3">
                            <Phone className="h-5 w-5 text-primary mt-0.5" />
                            <div>
                              <p className="text-xs font-bold text-muted-foreground uppercase">Teléfono</p>
                              <p className="text-sm">{selectedRequest.phone}</p>
                            </div>
                          </div>
                        </section>

                        <section className="bg-muted/30 rounded-2xl p-4">
                          <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Menú inicial</p>
                          <div className="space-y-2">
                            {selectedRequest.menu_json.map((item: any, idx: number) => (
                              <div key={idx} className="flex justify-between items-center text-sm bg-background border border-border/40 p-2 rounded-lg">
                                <span className="font-medium">{item.name}</span>
                                <span className="text-primary font-bold">${item.price}</span>
                              </div>
                            ))}
                          </div>
                        </section>

                        {selectedRequest.status === 'pending' && (
                          <div className="flex gap-3 pt-4">
                            <Button
                              onClick={() => handleReject(selectedRequest.id)}
                              variant="outline"
                              className="flex-1 rounded-xl text-destructive hover:bg-destructive/10"
                              disabled={processing !== null}
                            >
                              {processing === selectedRequest.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><XCircle className="mr-2 h-4 w-4" /> Rechazar</>}
                            </Button>
                            <Button
                              onClick={() => handleApprove(selectedRequest.id)}
                              variant="hero"
                              className="flex-1 rounded-xl shadow-glow"
                              disabled={processing !== null}
                            >
                              {processing === selectedRequest.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle2 className="mr-2 h-4 w-4" /> Aprobar</>}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-muted/20 border-2 border-dashed border-border/60 rounded-3xl p-8 text-center h-[400px] flex flex-col items-center justify-center space-y-4">
                      <div className="h-16 w-16 rounded-full bg-background flex items-center justify-center text-muted-foreground shadow-soft">
                        <Info className="h-8 w-8" />
                      </div>
                      <p className="text-muted-foreground font-medium">Seleccion una solicitud para ver los detalles.</p>
                    </div>
                  )}
                </aside>
              </div>
            )}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default AdminRequests;
