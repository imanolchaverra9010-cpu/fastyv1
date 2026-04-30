import { useState, useEffect, useRef } from "react";
import { Bell, Check, MapPin, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { BusinessSidebar } from "@/components/BusinessSidebar";

import { Business, MenuItem, Promotion, Order, BusinessStats, NewOrderNotification, BusinessContextType } from "@/types/business";
import { Outlet } from "react-router-dom";
import { getWebSocketUrl } from "@/lib/utils";

const BusinessPanel = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<BusinessStats | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentNotification, setCurrentNotification] = useState<NewOrderNotification | null>(null);
  const [showMenuForm, setShowMenuForm] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  const [newItemForm, setNewItemForm] = useState({
    name: "",
    price: "",
    description: "",
    category: "Platos Principales"
  });


  const [businessId, setBusinessId] = useState<string | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const fetchBusinessId = async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/businesses/owner/${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setBusinessId(data.id);
        setBusiness(data);
      }
    } catch (error) {
      console.error("Error fetching business ID:", error);
    }
  };

  const fetchBusinessData = async () => {
    if (!businessId) return;
    try {
      const res = await fetch(`/api/businesses/${businessId}`);
      if (res.ok) setBusiness(await res.json());
    } catch (error) {
      console.error("Error fetching business data:", error);
    }
  };

  const playNotificationSound = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3");
    }
    audioRef.current.play().catch(e => console.log("Audio play blocked by browser policy"));
  };

  const fetchData = async () => {
    if (!user?.id || !businessId) {
      if (!user?.id) setLoading(false);
      return;
    }
    try {
      const [statsRes, ordersRes, menuRes] = await Promise.all([
        fetch(`/api/businesses/${user.id}/stats`),
        fetch(`/api/businesses/${businessId}/orders`),
        fetch(`/api/businesses/${businessId}/menu`)
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (ordersRes.ok) setOrders(await ordersRes.json());
      if (menuRes.ok) setMenuItems(await menuRes.json());
    } catch (error) {
      console.error("Error fetching business data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBusinessId();
  }, [user?.id]);

  useEffect(() => {
    if (businessId) {
      fetchData();
      const interval = setInterval(fetchData, 30000); // 30s
      return () => clearInterval(interval);
    } else if (!user?.id) {
      setLoading(false);
    }
  }, [user?.id, businessId]);

  useEffect(() => {
    if (!businessId) return;

    const connect = () => {
      const url = getWebSocketUrl(`/ws/business/${businessId}`);
      if (!url) return;

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => console.log("WebSocket connected");

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === "new_order") {
          setCurrentNotification(message);
          playNotificationSound();
          fetchData();
        } else if (message.type === "order_status_update") {
          fetchData();
        } else if (message.type === "courier_location_update") {
          setOrders(prev => prev.map(o =>
            o.id === message.order_id
              ? { ...o, courier_lat: message.lat, courier_lng: message.lng }
              : o
          ));
        }
      };

      ws.onclose = () => {
        console.log("WebSocket disconnected, attempting to reconnect...");
        setTimeout(connect, 5000);
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        ws.close();
      };
    };

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [businessId]);

  const handleAddMenuItem = async () => {
    if (!newItemForm.name || !newItemForm.price) {
      toast({ title: "Error", description: "Completa todos los campos requeridos", variant: "destructive" });
      return;
    }

    try {
      const method = editingItem ? "PATCH" : "POST";
      const url = editingItem
        ? `/api/businesses/${businessId}/menu/${editingItem.id}`
        : `/api/businesses/${businessId}/menu`;

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newItemForm.name,
          price: parseInt(newItemForm.price),
          description: newItemForm.description,
          category: newItemForm.category,
          is_active: true
        })
      });

      if (response.ok) {
        toast({
          title: "Éxito",
          description: `${newItemForm.name} ${editingItem ? 'actualizado' : 'agregado'} correctamente.`
        });
        setNewItemForm({ name: "", price: "", description: "", category: "Platos Principales" });
        setShowMenuForm(false);
        setEditingItem(null);
        fetchData();
      }
    } catch (error) {
      toast({ title: "Error", description: "No se pudo procesar el producto", variant: "destructive" });
    }
  };

  const handleToggleMenuItem = async (itemId: number, isActive: boolean) => {
    try {
      await fetch(`/api/businesses/${businessId}/menu/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !isActive })
      });
      toast({ title: "Actualizado", description: `Producto ${!isActive ? "activado" : "desactivado"}` });
      fetchData();
    } catch (error) {
      toast({ title: "Error", description: "No se pudo actualizar el producto", variant: "destructive" });
    }
  };

  const handleDeleteMenuItem = async (itemId: number) => {
    if (!confirm("¿Eliminar este producto del menú?")) return;
    try {
      await fetch(`/api/businesses/${businessId}/menu/${itemId}`, {
        method: "DELETE"
      });
      toast({ title: "Producto eliminado" });
      fetchData();
    } catch (error) {
      toast({ title: "Error", description: "No se pudo eliminar el producto", variant: "destructive" });
    }
  };



  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      await fetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });
      toast({ title: "Pedido actualizado", description: `Estado cambiado a ${newStatus}` });
      fetchData();
    } catch (error) {
      toast({ title: "Error", description: "No se pudo actualizar el pedido", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-warm">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  const pendingOrders = orders.filter(o => o.status === "pending");
  const preparingOrders = orders.filter(o => o.status === "preparing");
  const deliveredOrders = orders.filter(o => o.status === "delivered");

  return (
    <div className="flex flex-col min-h-screen w-full bg-gradient-warm">
      <SidebarProvider>
        <div className="flex flex-1 w-full relative">
          <BusinessSidebar />

          {currentNotification && (
            <div className="fixed inset-x-0 top-0 sm:top-6 z-[100] flex justify-center p-2 sm:px-4 pointer-events-none animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="bg-card border-2 border-primary shadow-2xl rounded-2xl sm:rounded-3xl p-4 sm:p-6 w-full max-w-md pointer-events-auto ring-4 ring-primary/10 backdrop-blur-xl">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0 animate-bounce">
                    <Bell className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-bold text-lg sm:text-xl leading-tight truncate">¡Nuevo Pedido! 🚀</h3>
                    <p className="text-muted-foreground text-xs sm:text-sm font-medium mt-0.5 truncate">{currentNotification.customer_name}</p>
                    <div className="flex items-center gap-1.5 mt-2 text-[10px] sm:text-xs font-bold text-primary bg-primary/5 px-2 py-1 rounded-lg w-fit max-w-full">
                      <MapPin className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
                      <span className="truncate">{currentNotification.delivery_address}</span>
                    </div>
                    <p className="text-sm font-bold mt-2">{formatCOP(currentNotification.total)}</p>
                    <div className="mt-4 flex gap-2">
                      <Button
                        variant="hero"
                        className="flex-1 rounded-xl h-10 sm:h-11 font-bold shadow-glow text-sm"
                        onClick={() => setCurrentNotification(null)}
                      >
                        <Check className="mr-2 h-4 w-4" /> Entendido
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <SidebarInset className="flex-1">
            <header className="sticky top-0 z-30 flex h-14 md:h-16 shrink-0 items-center gap-2 border-b border-border/60 bg-background/75 backdrop-blur-xl px-4 md:px-6">
              <SidebarTrigger className="-ml-1" />
              <div className="h-4 w-px bg-border/60 mx-1 md:mx-2" />
              <h2 className="text-xs md:text-sm font-semibold text-muted-foreground capitalize truncate">
                Panel de Negocio
              </h2>
            </header>

            <main className="p-3 md:p-8 max-w-7xl mx-auto w-full">
              <div className="mb-6 md:mb-8 bg-card/40 md:bg-transparent p-4 md:p-0 rounded-2xl md:rounded-none border border-border/40 md:border-none">
                <p className="text-[10px] md:text-sm text-primary font-bold uppercase tracking-wider">Operación</p>
                <h1 className="text-xl md:text-4xl font-display font-bold tracking-tight mt-1 truncate">¡Hola, {user?.username}! 👋</h1>
                <p className="text-xs md:text-sm text-muted-foreground mt-1">Gestiona tu negocio en tiempo real.</p>
              </div>


              {/* Dynamic Content based on React Router */}
              <Outlet
                context={{
                  user,
                  updateUser,
                  orders,
                  menuItems,
                  stats,
                  business,
                  fetchBusinessData,
                  expandedOrder,
                  setExpandedOrder,
                  handleUpdateOrderStatus,
                  showMenuForm,
                  setShowMenuForm,
                  newItemForm,
                  setNewItemForm,
                  editingItem,
                  setEditingItem,
                  handleAddMenuItem,
                  handleToggleMenuItem,
                  handleDeleteMenuItem
                } satisfies BusinessContextType}
              />

            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  );
};

export default BusinessPanel;
