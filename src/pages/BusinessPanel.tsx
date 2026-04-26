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
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentNotification, setCurrentNotification] = useState<NewOrderNotification | null>(null);
  const [showMenuForm, setShowMenuForm] = useState(false);
  const [showPromoForm, setShowPromoForm] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  const [newItemForm, setNewItemForm] = useState({
    name: "",
    price: "",
    emoji: "🍔",
    description: "",
    category: "Platos Principales"
  });

  const [newPromoForm, setNewPromoForm] = useState({
    title: "",
    description: "",
    discount_percent: "",
    promo_code: "",
    emoji: "📢",
    expires_at: ""
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
      const [statsRes, ordersRes, menuRes, promoRes] = await Promise.all([
        fetch(`/api/businesses/${user.id}/stats`),
        fetch(`/api/businesses/${businessId}/orders`),
        fetch(`/api/businesses/${businessId}/menu`),
        fetch(`/api/promotions/${businessId}?only_active=false`)
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (ordersRes.ok) setOrders(await ordersRes.json());
      if (menuRes.ok) setMenuItems(await menuRes.json());
      if (promoRes.ok) setPromotions(await promoRes.json());
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
      const interval = setInterval(fetchData, 10000);
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
          emoji: newItemForm.emoji,
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
        setNewItemForm({ name: "", price: "", emoji: "🍔", description: "", category: "Platos Principales" });
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

  const handleAddPromotion = async () => {
    if (!newPromoForm.title) {
      toast({ title: "Error", description: "El título es requerido", variant: "destructive" });
      return;
    }

    try {
      const method = editingPromo ? "PUT" : "POST";
      const url = editingPromo
        ? `/api/promotions/${editingPromo.id}`
        : `/api/promotions/?business_id=${businessId}`;

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newPromoForm.title,
          description: newPromoForm.description,
          discount_percent: newPromoForm.discount_percent ? parseInt(newPromoForm.discount_percent) : null,
          promo_code: newPromoForm.promo_code || null,
          emoji: newPromoForm.emoji,
          expires_at: newPromoForm.expires_at || null,
          is_active: true
        })
      });

      if (response.ok) {
        toast({
          title: "Éxito",
          description: `Promoción ${editingPromo ? 'actualizada' : 'agregada'} correctamente.`
        });
        setNewPromoForm({ title: "", description: "", discount_percent: "", promo_code: "", emoji: "📢", expires_at: "" });
        setShowPromoForm(false);
        setEditingPromo(null);
        fetchData();
      }
    } catch (error) {
      toast({ title: "Error", description: "No se pudo procesar la promoción", variant: "destructive" });
    }
  };

  const handleTogglePromotion = async (promoId: number, isActive: boolean) => {
    try {
      await fetch(`/api/promotions/${promoId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !isActive })
      });
      toast({ title: "Actualizado", description: `Promoción ${!isActive ? "activada" : "desactivada"}` });
      fetchData();
    } catch (error) {
      toast({ title: "Error", description: "No se pudo actualizar la promoción", variant: "destructive" });
    }
  };

  const handleDeletePromotion = async (promoId: number) => {
    if (!confirm("¿Eliminar esta promoción?")) return;
    try {
      await fetch(`/api/promotions/${promoId}`, {
        method: "DELETE"
      });
      toast({ title: "Promoción eliminada" });
      fetchData();
    } catch (error) {
      toast({ title: "Error", description: "No se pudo eliminar la promoción", variant: "destructive" });
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
            <div className="fixed inset-x-0 top-6 z-[100] flex justify-center px-4 pointer-events-none animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="bg-card border-2 border-primary shadow-2xl rounded-3xl p-6 w-full max-w-md pointer-events-auto ring-4 ring-primary/10 backdrop-blur-xl">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0 animate-bounce">
                    <Bell className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-display font-bold text-xl leading-tight">¡Nuevo Pedido! 🚀</h3>
                    <p className="text-muted-foreground text-sm font-medium mt-1">{currentNotification.customer_name}</p>
                    <div className="flex items-center gap-1.5 mt-2 text-xs font-bold text-primary bg-primary/5 px-2 py-1 rounded-lg w-fit">
                      <MapPin className="h-3.5 w-3.5" />
                      {currentNotification.delivery_address}
                    </div>
                    <p className="text-sm font-bold mt-2">{formatCOP(currentNotification.total)}</p>
                    <div className="mt-4 flex gap-3">
                      <Button
                        variant="hero"
                        className="flex-1 rounded-xl h-11 font-bold shadow-glow"
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
            <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-border/60 bg-background/75 backdrop-blur-xl px-4 md:px-6">
              <SidebarTrigger className="-ml-1" />
              <div className="h-4 w-px bg-border/60 mx-2" />
              <h2 className="text-sm font-semibold text-muted-foreground capitalize">
                Panel de Negocio
              </h2>
            </header>

            <main className="p-4 md:p-8 max-w-7xl mx-auto w-full">
              <div className="mb-8">
                <p className="text-sm text-primary font-semibold">Operación</p>
                <h1 className="text-4xl font-display font-bold tracking-tight">¡Hola, {user?.username}! 👋</h1>
                <p className="text-muted-foreground mt-1">Gestiona tu negocio en tiempo real.</p>
              </div>


              {/* Dynamic Content based on React Router */}
              <Outlet
                context={{
                  orders,
                  menuItems,
                  promotions,
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
                  handleDeleteMenuItem,
                  showPromoForm,
                  setShowPromoForm,
                  newPromoForm,
                  setNewPromoForm,
                  editingPromo,
                  setEditingPromo,
                  handleAddPromotion,
                  handleTogglePromotion,
                  handleDeletePromotion
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
