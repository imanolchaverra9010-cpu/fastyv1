import { useEffect, useState, useRef } from "react";
import { Bike, DollarSign, MapPin, Navigation, Package, Star, TrendingUp, Loader2, Bell, X as CloseIcon, Check, Clock, Play, Eye, Phone, User, CreditCard, Store, LogOut, CheckCircle, Settings, ChevronRight, Camera, Upload } from "lucide-react";
import StatCard from "@/components/StatCard";
import DeliveryMap from "@/components/DeliveryMap";
import MultiStopMap from "@/components/MultiStopMap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { formatCOP } from "@/data/mock";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { CourierSidebar } from "@/components/CourierSidebar";
import { getWebSocketUrl } from "@/lib/utils";

// Bogotá-ish coordinates for demo
const PICKUP = { lat: 4.6533, lng: -74.0836, label: "Negocio" };
const DROPOFF = { lat: 4.6712, lng: -74.0598, label: "Cliente" };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

interface OrderItem {
  name: string;
  price: number;
  quantity: number;
  emoji?: string;
}

interface OrderNotification {
  type: "new_order";
  order_id: string;
  is_batch?: boolean;
  batch_id?: string;
  order_type?: string;
  business_name: string;
  business_address: string;
  business_emoji?: string;
  customer_name: string;
  delivery_address: string;
  total: number;
  items: OrderItem[];
  description?: string;
}

interface CourierStats {
  earnings_today: number;
  deliveries_today: number;
  rating: number;
  km_today: number;
}

interface OrderStore {
  id: string;
  business_name: string;
  business_address: string;
  business_emoji: string;
  total: number;
}

interface Order {
  id: string;
  order_type?: string;
  is_batch?: boolean;
  batch_id?: string;
  orders?: OrderStore[];
  business_id: string;
  business_name: string;
  business_address: string;
  business_emoji?: string;
  customer_name: string;
  delivery_address: string;
  total: number;
  status: string;
  origin_name?: string;
  origin_address?: string;
  open_order_description?: string;
  customer_phone?: string;
  payment_method?: string;
  notes?: string;
  items?: OrderItem[];
}

const CourierPanel = () => {
  const { user, logout } = useAuth();
  const [online, setOnline] = useState(true);
  const [stats, setStats] = useState<CourierStats | null>(null);
  const [availableOrders, setAvailableOrders] = useState<Order[]>([]);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [t, setT] = useState(0);
  const [activeTab, setActiveTab] = useState<"dashboard" | "available" | "history" | "profile">("dashboard");
  const [activeDeliveryId, setActiveDeliveryId] = useState<string | null>(null);
  const [realCourierPos, setRealCourierPos] = useState<{ lat: number; lng: number } | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const [profileData, setProfileData] = useState<any>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", phone: "", vehicle: "", password: "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentNotification, setCurrentNotification] = useState<OrderNotification | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const assigned = (myOrders || []).filter((o) => ["pending", "preparing"].includes(o.status));
  const mine = (myOrders || []).filter((o) => o.status === "shipped");
  const inTransit = (myOrders || []).filter((o) => o.status === "in_transit");
  const history = (myOrders || []).filter((o) => o.status === "delivered");

  // Geolocation tracking
  const startTracking = () => {
    if (watchIdRef.current !== null) return;

    if ("geolocation" in navigator) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          setRealCourierPos({ lat: latitude, lng: longitude });

          // Send to backend
          if (user?.id) {
            try {
              await fetch(`/api/couriers/${user.id}/location`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ lat: latitude, lng: longitude })
              });
            } catch (err) {
              console.error("Error sending location:", err);
            }
          }
        },
        (error) => {
          console.error("Geolocation error:", error);
          toast({
            title: "Error de ubicación",
            description: "No se pudo obtener tu ubicación en tiempo real.",
            variant: "destructive"
          });
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
      );
    }
  };

  const stopTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  useEffect(() => {
    if (inTransit.length > 0) {
      startTracking();
    } else {
      stopTracking();
    }
    return () => stopTracking();
  }, [inTransit.length]);

  const playNotificationSound = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3");
    }
    audioRef.current.play().catch(e => console.log("Audio play blocked by browser policy"));
  };

  const fetchData = async (initialLoad = false) => {
    if (!user?.id) {
      if (initialLoad) setLoading(false);
      return;
    }
    try {
      const [statsRes, myOrdersRes, availableRes, profileRes] = await Promise.all([
        fetch(`/api/couriers/${user.id}/stats`),
        fetch(`/api/couriers/${user.id}/my-orders`),
        fetch(`/api/couriers/available-orders`),
        fetch(`/api/couriers/${user.id}/profile`)
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (myOrdersRes.ok) setMyOrders(await myOrdersRes.json());
      if (availableRes.ok) setAvailableOrders(await availableRes.json());
      if (profileRes.ok) {
        const data = await profileRes.json();
        setProfileData(data);
        setEditForm({
          name: data.name || "",
          phone: data.phone || "",
          vehicle: data.vehicle || "",
          password: ""
        });
      }

    } catch (error) {
      console.error("Error fetching courier data:", error);
    } finally {
      if (initialLoad) setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`/api/couriers/${user.id}/photo`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setProfileData((prev: any) => ({ ...prev, image_url: data.image_url }));
        toast({ title: "Foto actualizada", description: "Tu foto de perfil ha sido actualizada correctamente." });
      } else {
        throw new Error("Error al subir la foto");
      }
    } catch (error) {
      toast({ title: "Error", description: "No se pudo subir la foto.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    setSavingProfile(true);
    try {
      // 1. Update courier-specific info (name, phone, vehicle)
      const courierRes = await fetch(`/api/couriers/${user.id}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          phone: editForm.phone,
          vehicle: editForm.vehicle
        }),
      });

      // 2. Update user info (password) if provided
      if (editForm.password) {
        const userRes = await fetch(`/api/users/${user.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: editForm.password }),
        });
        if (!userRes.ok) throw new Error("Error al actualizar la contraseña");
      }

      if (courierRes.ok) {
        setProfileData((prev: any) => ({ 
          ...prev, 
          name: editForm.name,
          phone: editForm.phone,
          vehicle: editForm.vehicle
        }));
        setEditingProfile(false);
        setEditForm(prev => ({ ...prev, password: "" }));
        toast({ title: "Perfil actualizado", description: "Tus datos han sido guardados." });
      } else {
        throw new Error("Error al actualizar perfil");
      }
    } catch (error: any) {
      toast({ 
        title: "Error", 
        description: error.message || "No se pudieron guardar los cambios.", 
        variant: "destructive" 
      });
    } finally {
      setSavingProfile(false);
    }
  };

  useEffect(() => {
    fetchData(true);
    // Auto-set online status on load if not already set
    if (user?.id) toggleOnline(true);
    
    const interval = setInterval(() => fetchData(false), 30000); // 30s para ahorrar conexiones DB
    return () => clearInterval(interval);
  }, [user?.id]);

  // WebSocket connection for new orders
  useEffect(() => {
    if (!user?.id) return;

    const connect = () => {
      const url = getWebSocketUrl(`/ws/courier/${user.id}`);
      if (!url) return;

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => console.log("WebSocket connected");

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === "new_order") {
          const isKnown = availableOrders.some(o => o.id === message.order_id) || myOrders.some(o => o.id === message.order_id);
          if (!isKnown) {
            setCurrentNotification(message);
            playNotificationSound();
          }
        } else if (message.type === "order_status_update") {
          fetchData(false);
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
  }, [user?.id, availableOrders, myOrders]);

  // Animate the courier marker along the route while there's an active delivery in transit
  useEffect(() => {
    if (inTransit.length === 0 || !activeDeliveryId) {
      setT(0);
      return;
    }
    const id = setInterval(() => {
      setT((prev) => (prev >= 1 ? 0 : +(prev + 0.01).toFixed(2)));
    }, 250);
    return () => clearInterval(id);
  }, [inTransit.length, activeDeliveryId]);

  const activeOrder = inTransit.find(o => o.id === activeDeliveryId) || inTransit[0] || mine[0] || assigned[0];

  const courierPos = realCourierPos
    ? { ...realCourierPos, label: "Tú" }
    : (activeDeliveryId && inTransit.length > 0
      ? { lat: lerp(PICKUP.lat, DROPOFF.lat, t), lng: lerp(PICKUP.lng, DROPOFF.lng, t), label: "Tú (Simulado)" }
      : undefined);

  const mapPickup = activeOrder ? {
    lat: activeOrder.business_lat || activeOrder.latitude || PICKUP.lat,
    lng: activeOrder.business_lng || activeOrder.longitude || PICKUP.lng,
    label: activeOrder.business_name || "Negocio"
  } : PICKUP;

  const mapDropoff = activeOrder ? {
    lat: activeOrder.latitude || DROPOFF.lat,
    lng: activeOrder.longitude || DROPOFF.lng,
    label: "Cliente"
  } : DROPOFF;

  const activeDeliveries = [...inTransit, ...mine];
  const multiDropoffs = activeDeliveries.map(o => ({
    lat: o.latitude || DROPOFF.lat,
    lng: o.longitude || DROPOFF.lng,
    label: o.business_name ? `Entrega a ${o.customer_name} (${o.business_name})` : `Entrega a ${o.customer_name}`,
    emoji: "📍",
    id: o.id
  }));

  const toggleOnline = async (val: boolean) => {
    if (!user?.id) return;
    setOnline(val);
    try {
      await fetch(`/api/couriers/${user.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: val ? "online" : "offline" })
      });
    } catch (error) {
      console.error("Error toggling status:", error);
    }
  };

  const handleAction = async (action: 'accept' | 'reject' | 'start_trip' | 'complete', orderId: string) => {
    if (!user?.id) return;

    let url = ``;
    let successMessage = "";

    if (action === 'accept') {
      url = `/api/couriers/${user.id}/accept-order/${orderId}`;
      successMessage = `Pedido ${orderId} aceptado. ¡Prepárate para el viaje!`;
    } else if (action === 'reject') {
      url = `/api/couriers/${user.id}/reject-order/${orderId}`;
      successMessage = `Pedido ${orderId} rechazado.`;
    } else if (action === 'start_trip') {
      url = `/api/orders/${orderId}/status`;
      // Usar PATCH para actualizar el estado a in_transit
      try {
        const response = await fetch(url, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "in_transit" })
        });
        if (response.ok) {
          toast({ title: "¡Viaje iniciado!", description: "Abriendo navegación..." });

          // Buscar el pedido para obtener la dirección
          const order = [...availableOrders, ...myOrders].find(o => o.id === orderId);
          if (order) {
            const address = order.delivery_address;
            const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
            window.open(mapsUrl, '_blank');
          }

          setActiveDeliveryId(orderId);
          fetchData(false);
          return;
        }
      } catch (error) {
        console.error("Error starting trip:", error);
      }
      return;
    } else if (action === 'complete') {
      url = `/api/couriers/${user.id}/complete-order/${orderId}`;
      successMessage = `¡Entrega completada!`;
    }

    try {
      const response = await fetch(url, { method: "POST" });
      if (response.ok) {
        toast({ title: successMessage });
        if (currentNotification?.order_id === orderId) {
          setCurrentNotification(null);
        }
        setActiveDeliveryId(null);
        fetchData(false);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail || "La acción falló");
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-warm">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-gradient-warm relative">
        <CourierSidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          profileImage={profileData?.image_url}
        />

        {currentNotification && online && (
          <div className="fixed inset-x-0 top-6 z-[100] flex justify-center px-4 pointer-events-none animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="bg-card border-2 border-primary shadow-2xl rounded-3xl p-6 w-full max-w-md pointer-events-auto ring-4 ring-primary/10 backdrop-blur-xl">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0 animate-bounce">
                  <Bell className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-display font-bold text-xl leading-tight">
                      {currentNotification.is_batch ? "¡Paquete Multi-Tienda! 📦" :
                        currentNotification.order_type === "open" ? "¡Encargo Especial! 🛍️" : "¡Nuevo Pedido! 🚀"}
                    </h3>
                  </div>
                  <p className="text-muted-foreground text-sm font-medium">
                    {currentNotification.is_batch ? "Recogida en múltiples negocios" : currentNotification.business_name}
                  </p>

                  {currentNotification.order_type === "open" && currentNotification.description && (
                    <div className="mt-2 p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-600 text-xs font-medium italic">
                      "{currentNotification.description}"
                    </div>
                  )}

                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(currentNotification.delivery_address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 mt-2 text-xs font-bold text-primary bg-primary/5 px-2 py-1 rounded-lg w-fit hover:bg-primary/10 transition-colors pointer-events-auto"
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    {currentNotification.delivery_address}
                  </a>
                  <div className="mt-4 flex gap-3">
                    <Button
                      variant="hero"
                      className="flex-1 rounded-xl h-11 font-bold shadow-glow"
                      onClick={() => handleAction('accept', currentNotification.order_id)}
                    >
                      <Check className="mr-2 h-4 w-4" /> Aceptar
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 rounded-xl h-11 font-bold border-2"
                      onClick={() => handleAction('reject', currentNotification.order_id)}
                    >
                      <CloseIcon className="mr-2 h-4 w-4" /> Rechazar
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
              {activeTab === "dashboard" && "Dashboard"}
              {activeTab === "available" && "Pedidos Disponibles"}
              {activeTab === "history" && "Historial de Entregas"}
            </h2>
          </header>

          <main className="p-4 md:p-8 max-w-7xl mx-auto w-full">
            {/* DASHBOARD TAB */}
            {activeTab === "dashboard" && (
              <div className="space-y-8">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                  <div>
                    <p className="text-sm text-primary font-semibold">Operación</p>
                    <h1 className="text-4xl font-display font-bold tracking-tight">¡Hola, {user?.username}! 👋</h1>
                    <p className="text-muted-foreground mt-1">Tu turno de hoy va excelente.</p>
                  </div>
                  <div className="flex items-center gap-3 bg-card border border-border/60 rounded-2xl px-5 py-3 shadow-card">
                    <div className={`h-2.5 w-2.5 rounded-full ${online ? "bg-success animate-pulse" : "bg-muted-foreground"}`} />
                    <span className="font-semibold text-sm">{online ? "En línea" : "Desconectado"}</span>
                    <Switch checked={online} onCheckedChange={toggleOnline} />
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard icon={DollarSign} label="Ganancias hoy" value={formatCOP(stats?.earnings_today || 0)} hint="+12% vs ayer" tone="success" />
                  <StatCard icon={Package} label="Entregas hoy" value={String(stats?.deliveries_today || 0)} hint={`${assigned.length + mine.length + inTransit.length} activos`} tone="primary" />
                  <StatCard icon={Star} label="Calificación" value={String(stats?.rating?.toFixed(1) || 5.0)} hint="Últimos 30 días" tone="warning" />
                  <StatCard icon={TrendingUp} label="Km recorridos" value={String(stats?.km_today || 0)} tone="accent" />
                </div>

                <section>
                  <div className="flex items-end justify-between mb-4">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-primary" /> Mapa en vivo
                    </h2>
                    {activeDeliveryId && inTransit.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        Progreso ruta: <span className="font-semibold text-foreground">{Math.round(t * 100)}%</span>
                      </span>
                    )}
                  </div>
                  {activeDeliveries.length >= 2 && courierPos ? (
                    <MultiStopMap courier={{ lat: courierPos.lat, lng: courierPos.lng }} dropoffs={multiDropoffs} />
                  ) : (
                    <div className="rounded-2xl bg-card border border-border/60 shadow-card overflow-hidden h-[360px]">
                      <DeliveryMap pickup={mapPickup} dropoff={mapDropoff} courier={courierPos} />
                    </div>
                  )}
                  {inTransit.length === 0 && mine.length === 0 && assigned.length === 0 && (
                    <p className="mt-3 text-sm text-muted-foreground text-center">
                      No tienes pedidos asignados. Ve a "Disponibles" para aceptar uno.
                    </p>
                  )}
                </section>

                {assigned.length > 0 && (
                  <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                      <Clock className="h-5 w-5 text-warning" /> Pedidos en preparación
                    </h2>
                    <div className="grid gap-3 md:grid-cols-2">
                      {assigned.map((order) => (
                        <div key={order.id} className={`bg-card border-2 ${order.order_type === 'open' ? 'border-orange-500/20' : 'border-warning/20'} rounded-xl p-4 shadow-sm relative overflow-hidden group`}>
                          <div className="absolute top-0 right-0 p-2">
                            <span className={`flex h-2 w-2 rounded-full ${order.order_type === 'open' ? 'bg-orange-500' : 'bg-warning'} animate-pulse`} />
                          </div>
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <p className="font-bold text-lg">{order.business_name || order.origin_name} {order.business_emoji || '🛍️'}</p>
                              <p className="text-sm text-muted-foreground">{order.business_address || order.origin_address}</p>
                            </div>
                            <p className={`font-bold text-lg ${order.order_type === 'open' ? 'text-orange-600' : 'text-warning'}`}>{order.order_type === 'open' ? 'Por definir' : formatCOP(order.total)}</p>
                          </div>
                          <div className="flex items-center gap-2 text-xs font-medium text-warning bg-warning/10 px-3 py-1.5 rounded-lg w-fit">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            {order.order_type === 'open' ? 'Dirígete al lugar de compra' : (order.status === 'preparing' ? 'El negocio está preparando el pedido' : 'Esperando confirmación del negocio')}
                          </div>
                          {order.order_type === 'open' && order.open_order_description && (
                            <p className="mt-3 text-xs text-muted-foreground italic border-t border-border/40 pt-2">"{order.open_order_description}"</p>
                          )}
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="mt-3 w-full h-8 text-xs gap-1.5 rounded-lg border border-warning/10 hover:bg-warning/5"
                            onClick={() => setSelectedOrder(order)}
                          >
                            <Eye className="h-3.5 w-3.5" /> Ver detalles del pedido
                          </Button>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {mine.length > 0 && (
                  <section>
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                      <Package className="h-5 w-5 text-primary" /> Pedidos aceptados (Listos para recoger)
                    </h2>
                    <div className="space-y-3">
                      {mine.map((order) => (
                        <div key={order.id} className={`bg-card border-2 ${order.is_batch ? 'border-purple-500/40'
                            : order.order_type === 'open' ? 'border-orange-500/30'
                              : 'border-primary/30'
                          } rounded-xl p-4 shadow-sm`}>

                          {order.is_batch ? (
                            <>
                              <div className="flex items-center gap-2 mb-3">
                                <span className="bg-purple-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">📦 Paquete Multi-Tienda</span>
                                <p className="font-bold text-lg text-purple-600">{formatCOP(order.total)}</p>
                              </div>
                              <div className="space-y-2 mb-3 pl-1">
                                {(order.orders ?? []).map((store) => (
                                  <div key={store.id} className="flex items-center justify-between text-sm bg-muted/40 rounded-lg px-3 py-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-base">{store.business_emoji}</span>
                                      <div>
                                        <p className="font-semibold">{store.business_name}</p>
                                        <p className="text-xs text-muted-foreground">{store.business_address}</p>
                                      </div>
                                    </div>
                                    <span className="font-bold text-primary">{formatCOP(store.total)}</span>
                                  </div>
                                ))}
                              </div>
                            </>
                          ) : (
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-bold text-lg">{order.business_name || order.origin_name} {order.business_emoji || '🛍️'}</p>
                                  {order.order_type === 'open' && (
                                    <span className="bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Encargo</span>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground">{order.business_address || order.origin_address}</p>
                              </div>
                              <p className="font-bold text-lg text-primary">{order.order_type === 'open' ? 'Por definir' : formatCOP(order.total)}</p>
                            </div>
                          )}

                          {order.order_type === 'open' && order.open_order_description && (
                            <div className="mb-4 p-3 rounded-xl bg-orange-500/5 border border-orange-500/10 text-sm italic">
                              "{order.open_order_description}"
                            </div>
                          )}

                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.delivery_address)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 mb-3 text-sm text-muted-foreground hover:text-primary transition-colors"
                          >
                            <MapPin className="h-4 w-4" />
                            {order.delivery_address}
                          </a>
                          <div className="flex gap-2">
                            <Button
                              variant="hero"
                              className="flex-1 rounded-lg font-bold"
                              onClick={() => handleAction('start_trip', order.id)}
                            >
                              <Play className="mr-2 h-4 w-4" /> Iniciar Viaje
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="rounded-lg shrink-0"
                              onClick={() => setSelectedOrder(order)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {inTransit.length > 0 && (
                  <section>
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                      <Navigation className="h-5 w-5 text-success animate-pulse" /> En Camino
                    </h2>
                    <div className="space-y-3">
                      {inTransit.map((order) => (
                        <div key={order.id} className={`bg-card border-2 ${order.is_batch ? 'border-purple-500/40'
                            : order.order_type === 'open' ? 'border-orange-500/30'
                              : 'border-success/30'
                          } rounded-xl p-4 shadow-sm`}>

                          {order.is_batch ? (
                            <>
                              <div className="flex items-center gap-2 mb-3">
                                <span className="bg-purple-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">📦 Paquete Multi-Tienda</span>
                                <p className="font-bold text-lg text-purple-600">{formatCOP(order.total)}</p>
                              </div>
                              <div className="space-y-2 mb-3 pl-1">
                                {(order.orders ?? []).map((store) => (
                                  <div key={store.id} className="flex items-center justify-between text-sm bg-muted/40 rounded-lg px-3 py-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-base">{store.business_emoji}</span>
                                      <div>
                                        <p className="font-semibold">{store.business_name}</p>
                                        <p className="text-xs text-muted-foreground">{store.business_address}</p>
                                      </div>
                                    </div>
                                    <span className="font-bold text-success">{formatCOP(store.total)}</span>
                                  </div>
                                ))}
                              </div>
                            </>
                          ) : (
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <p className="font-bold text-lg">{order.business_name || order.origin_name} {order.business_emoji || '🛍️'}</p>
                                <a
                                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.delivery_address)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-muted-foreground hover:text-primary transition-colors block"
                                >
                                  {order.delivery_address}
                                </a>
                              </div>
                              <p className="font-bold text-lg text-success">{order.order_type === 'open' ? 'Por definir' : formatCOP(order.total)}</p>
                            </div>
                          )}

                          {order.order_type === 'open' && order.open_order_description && (
                            <div className="mb-4 p-3 rounded-xl bg-orange-500/5 border border-orange-500/10 text-sm italic">
                              "{order.open_order_description}"
                            </div>
                          )}

                          {order.is_batch && (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.delivery_address)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 mb-4 text-sm text-muted-foreground hover:text-primary transition-colors"
                            >
                              <MapPin className="h-4 w-4" />
                              {order.delivery_address}
                            </a>
                          )}

                          <div className="flex gap-2">
                            <Button
                              variant="hero"
                              className="flex-1 rounded-lg font-bold"
                              onClick={() => handleAction('complete', order.id)}
                            >
                              <Check className="mr-2 h-4 w-4" /> Completar Entrega
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="rounded-lg shrink-0"
                              onClick={() => setSelectedOrder(order)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}

            {/* AVAILABLE ORDERS TAB */}
            {activeTab === "available" && (
              <div className="space-y-8">
                <div>
                  <p className="text-sm text-primary font-semibold">Oportunidades</p>
                  <h1 className="text-4xl font-display font-bold tracking-tight">Pedidos Disponibles</h1>
                  <p className="text-muted-foreground mt-1">Acepta los pedidos que te interesen y comienza a ganar.</p>
                </div>

                <div className="flex items-center gap-3 bg-card border border-border/60 rounded-2xl px-5 py-3 shadow-card w-fit">
                  <div className={`h-2.5 w-2.5 rounded-full ${online ? "bg-success animate-pulse" : "bg-muted-foreground"}`} />
                  <span className="font-semibold text-sm">{online ? "En línea" : "Desconectado"}</span>
                  <Switch checked={online} onCheckedChange={toggleOnline} />
                </div>

                <div>
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Bike className="h-5 w-5 text-primary" /> Disponibles
                    <span className="text-sm text-muted-foreground font-normal">({availableOrders.length})</span>
                  </h2>
                  <div className="space-y-3">
                    {availableOrders.length === 0 && (
                      <p className="text-muted-foreground text-center py-8">No hay pedidos disponibles en este momento.</p>
                    )}
                    {availableOrders.map((order) => (
                      <div key={order.id} className={`bg-card border-2 ${order.is_batch ? 'border-purple-500/40'
                          : order.order_type === 'open' ? 'border-orange-500/30'
                            : 'border-primary/30'
                        } rounded-xl p-4 shadow-sm`}>

                        {/* BATCH (multi-store) header */}
                        {order.is_batch ? (
                          <>
                            <div className="flex items-center gap-2 mb-3">
                              <span className="bg-purple-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">📦 Paquete Multi-Tienda</span>
                              <p className="font-bold text-lg text-purple-600">{formatCOP(order.total)}</p>
                            </div>
                            <div className="space-y-2 mb-3 pl-1">
                              {(order.orders ?? []).map((store) => (
                                <div key={store.id} className="flex items-center justify-between text-sm bg-muted/40 rounded-lg px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-base">{store.business_emoji}</span>
                                    <div>
                                      <p className="font-semibold">{store.business_name}</p>
                                      <p className="text-xs text-muted-foreground">{store.business_address}</p>
                                    </div>
                                  </div>
                                  <span className="font-bold text-primary">{formatCOP(store.total)}</span>
                                </div>
                              ))}
                            </div>
                          </>
                        ) : (
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-bold text-lg">{order.business_name || order.origin_name} {order.business_emoji || '🛍️'}</p>
                                {order.order_type === 'open' && (
                                  <span className="bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Encargo</span>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">{order.business_address || order.origin_address}</p>
                            </div>
                            <p className="font-bold text-lg text-primary">{order.order_type === 'open' ? 'Por definir' : formatCOP(order.total)}</p>
                          </div>
                        )}

                        {order.order_type === 'open' && order.open_order_description && (
                          <div className="mb-4 p-3 rounded-xl bg-orange-500/5 border border-orange-500/10 text-sm italic">
                            "{order.open_order_description}"
                          </div>
                        )}

                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.delivery_address)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 mb-4 text-sm text-muted-foreground hover:text-primary transition-colors"
                        >
                          <MapPin className="h-4 w-4" />
                          {order.delivery_address}
                        </a>
                        <div className="flex gap-2">
                          <Button
                            variant="hero"
                            className="flex-1 rounded-lg font-bold"
                            onClick={() => handleAction('accept', order.id)}
                          >
                            <Check className="mr-2 h-4 w-4" /> Aceptar
                          </Button>
                          <Button
                            variant="outline"
                            className="shrink-0 rounded-lg"
                            onClick={() => handleAction('reject', order.id)}
                          >
                            <CloseIcon className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            className="shrink-0 rounded-lg border-primary/20 text-primary hover:bg-primary/5"
                            onClick={() => setSelectedOrder(order)}
                            title="Ver detalles"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* HISTORY TAB */}
            {activeTab === "history" && (
              <div className="space-y-8">
                <div>
                  <p className="text-sm text-primary font-semibold">Registro</p>
                  <h1 className="text-4xl font-display font-bold tracking-tight">Historial de Entregas</h1>
                  <p className="text-muted-foreground mt-1">Todas tus entregas completadas.</p>
                </div>

                <div>
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" /> Entregas completadas
                    <span className="text-sm text-muted-foreground font-normal">({history.length})</span>
                  </h2>
                  <div className="space-y-3">
                    {history.length === 0 && (
                      <p className="text-muted-foreground text-center py-8">No has completado ninguna entrega aún.</p>
                    )}
                    {history.map((order) => (
                      <div key={order.id} className={`bg-card border ${order.order_type === 'open' ? 'border-orange-500/20' : 'border-border/60'} rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow`}>
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-bold">{order.business_name || order.origin_name} {order.business_emoji || '🛍️'}</p>
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.delivery_address)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-muted-foreground hover:text-primary transition-colors block"
                            >
                              {order.delivery_address}
                            </a>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-lg text-success">{order.order_type === 'open' ? 'Encargo' : formatCOP(order.total)}</p>
                            <span className="text-xs text-success font-bold">✓ Entregado</span>
                          </div>
                        </div>
                        <div className="mt-2 flex justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs gap-1.5 rounded-lg text-muted-foreground hover:text-primary"
                            onClick={() => setSelectedOrder(order)}
                          >
                            <Eye className="h-4 w-4" /> Ver detalles
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* PROFILE TAB */}
            {activeTab === "profile" && (
              <div className="space-y-8">
                <div>
                  <p className="text-sm text-primary font-semibold">Mi Cuenta</p>
                  <h1 className="text-4xl font-display font-bold tracking-tight">Perfil de Domiciliario</h1>
                  <p className="text-muted-foreground mt-1">Gestiona tu información personal y revisa tus estadísticas.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Info Card */}
                  <div className="md:col-span-1 space-y-6">
                    <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-sm flex flex-col items-center text-center">
                      <div className="relative group">
                        <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center text-primary text-3xl font-bold mb-4 border-4 border-background shadow-sm overflow-hidden">
                          {profileData?.image_url ? (
                            <img src={profileData.image_url.startsWith("http") ? profileData.image_url : (profileData.image_url.startsWith("/api") ? profileData.image_url : `/api${profileData.image_url}`)} alt="Profile" className="h-full w-full object-cover" />
                          ) : (
                            user?.username?.charAt(0).toUpperCase()
                          )}
                        </div>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                          className="absolute bottom-4 right-0 p-2 bg-primary text-white rounded-full shadow-lg border-2 border-background opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                        >
                          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                        </button>
                        <input
                          type="file"
                          ref={fileInputRef}
                          className="hidden"
                          accept="image/*"
                          onChange={handleFileUpload}
                        />
                      </div>
                      <h2 className="text-xl font-bold">{profileData?.name || user?.username}</h2>
                      <p className="text-sm text-muted-foreground mb-4 capitalize">
                        {user?.role === 'courier' ? 'Domiciliario' : 
                         user?.role === 'admin' ? 'Administrador' : 
                         user?.role === 'business' ? 'Negocio' : user?.role}
                      </p>

                      <div className="w-full pt-4 border-t border-border/40 space-y-3 text-left">
                        <div className="flex items-center gap-3 text-sm">
                          <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                            <User className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-muted-foreground">Usuario</p>
                            <p className="font-medium truncate">{user?.username}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                            <Bike className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-muted-foreground">Vehículo</p>
                            <p className="font-medium truncate">{profileData?.vehicle || "No registrado"}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                            <Phone className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-muted-foreground">Teléfono</p>
                            <p className="font-medium truncate">{profileData?.phone || "No registrado"}</p>
                          </div>
                        </div>
                      </div>

                      <Button 
                        className="w-full mt-6 rounded-xl gap-2 font-bold" 
                        onClick={() => setEditingProfile(true)}
                      >
                        <Settings className="h-4 w-4" /> Editar Datos
                      </Button>
                    </div>

                    <Button variant="outline" className="w-full rounded-xl gap-2 text-destructive border-destructive/20 hover:bg-destructive/10" onClick={logout}>
                      <LogOut className="h-4 w-4" /> Cerrar Sesión
                    </Button>
                  </div>

                  {/* Stats and Edit Form */}
                  <div className="md:col-span-2 space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-primary/5 border border-primary/10 rounded-2xl p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                            <CheckCircle className="h-5 w-5" />
                          </div>
                          <span className="text-xs font-bold text-primary uppercase tracking-wider">Total Entregas</span>
                        </div>
                        <p className="text-3xl font-display font-bold">{history.length}</p>
                        <p className="text-sm text-muted-foreground mt-1">Pedidos completados con éxito</p>
                      </div>

                      <div className="bg-warning/5 border border-warning/10 rounded-2xl p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                          <div className="h-10 w-10 rounded-xl bg-warning/10 flex items-center justify-center text-warning">
                            <Star className="h-5 w-5" />
                          </div>
                          <span className="text-xs font-bold text-warning uppercase tracking-wider">Calificación</span>
                        </div>
                        <p className="text-3xl font-display font-bold">4.9</p>
                        <p className="text-sm text-muted-foreground mt-1">Promedio de satisfacción</p>
                      </div>
                    </div>

                    {editingProfile ? (
                      <div className="bg-card border-2 border-primary/20 rounded-2xl p-6 shadow-glow animate-in zoom-in-95">
                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                          <User className="h-5 w-5 text-primary" /> Editar Información Personal
                        </h3>
                        <form onSubmit={handleUpdateProfile} className="space-y-4">
                          <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nombre Completo</label>
                            <Input 
                              value={editForm.name} 
                              onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                              placeholder="Tu nombre real"
                              className="rounded-xl h-11"
                              required
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Teléfono</label>
                              <Input 
                                value={editForm.phone} 
                                onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                                placeholder="310 123 4567"
                                className="rounded-xl h-11"
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Vehículo</label>
                              <Input 
                                value={editForm.vehicle} 
                                onChange={(e) => setEditForm(prev => ({ ...prev, vehicle: e.target.value }))}
                                placeholder="Moto / Bicicleta"
                                className="rounded-xl h-11"
                                required
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nueva Contraseña (opcional)</label>
                            <Input 
                              type="password"
                              value={editForm.password} 
                              onChange={(e) => setEditForm(prev => ({ ...prev, password: e.target.value }))}
                              placeholder="Déjalo en blanco para mantener la actual"
                              className="rounded-xl h-11"
                            />
                          </div>
                          <div className="flex gap-3 pt-2">
                            <Button type="submit" variant="hero" className="flex-1 rounded-xl font-bold" disabled={savingProfile}>
                              {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar Cambios"}
                            </Button>
                            <Button type="button" variant="outline" className="flex-1 rounded-xl font-bold" onClick={() => setEditingProfile(false)}>
                              Cancelar
                            </Button>
                          </div>
                        </form>
                      </div>
                    ) : (
                      <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-sm">
                        <h3 className="font-bold text-lg mb-4">Configuración de Cuenta</h3>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer border border-transparent hover:border-border/60">
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-lg bg-primary/5 flex items-center justify-center text-primary">
                                <Settings className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="font-medium text-sm">Notificaciones</p>
                                <p className="text-xs text-muted-foreground">Gestionar alertas de nuevos pedidos</p>
                              </div>
                            </div>
                            <div className="h-5 w-8 rounded-full bg-primary relative p-1">
                              <div className="h-3 w-3 rounded-full bg-white absolute right-1"></div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer border border-transparent hover:border-border/60">
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-lg bg-primary/5 flex items-center justify-center text-primary">
                                <MapPin className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="font-medium text-sm">Zona de Trabajo</p>
                                <p className="text-xs text-muted-foreground">Cambiar tu radio de operación</p>
                              </div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </main>
        </SidebarInset>
        {selectedOrder && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-card w-full max-w-lg max-h-[85vh] overflow-hidden rounded-3xl border border-border/60 shadow-glow flex flex-col">
              <div className="p-5 border-b border-border/60 flex items-center justify-between bg-gradient-hero text-primary-foreground">
                <div>
                  <h2 className="text-xl font-display font-bold flex items-center gap-2">
                    <Package className="h-5 w-5" /> Detalle del Pedido
                  </h2>
                  <p className="text-xs opacity-80">#{selectedOrder.id}</p>
                </div>
                <button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                  <CloseIcon className="h-6 w-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* ORIGIN / BUSINESS */}
                <section className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Store className="h-3.5 w-3.5" /> Punto de Recogida
                  </h3>
                  <div className="bg-muted/30 p-4 rounded-2xl border border-border/40">
                    <p className="font-bold text-lg">{selectedOrder.business_name || selectedOrder.origin_name} {selectedOrder.business_emoji || '🛍️'}</p>
                    <p className="text-sm text-muted-foreground mb-2">{selectedOrder.business_address || selectedOrder.origin_address}</p>
                    {selectedOrder.business_id && (
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 rounded-lg" asChild>
                          <a href={`tel:${selectedOrder.phone || ''}`}><Phone className="h-3 w-3" /> Llamar Negocio</a>
                        </Button>
                      </div>
                    )}
                  </div>
                </section>

                {/* CUSTOMER / DELIVERY */}
                <section className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <User className="h-3.5 w-3.5" /> Cliente y Entrega
                  </h3>
                  <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-bold text-lg">{selectedOrder.customer_name}</p>
                        <p className="text-sm text-muted-foreground">{selectedOrder.delivery_address}</p>
                      </div>
                      <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-lg uppercase">
                        {selectedOrder.payment_method === 'cash' ? 'Efectivo 💵' : 'Pago Digital 💳'}
                      </span>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button variant="hero" size="sm" className="h-9 text-xs gap-1.5 rounded-lg flex-1" asChild>
                        <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(selectedOrder.delivery_address)}`} target="_blank">
                          <Navigation className="h-3.5 w-3.5" /> Navegar
                        </a>
                      </Button>
                      {selectedOrder.customer_phone && (
                        <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5 rounded-lg flex-1" asChild>
                          <a href={`tel:${selectedOrder.customer_phone}`}><Phone className="h-3.5 w-3.5" /> Llamar Cliente</a>
                        </Button>
                      )}
                    </div>
                  </div>
                </section>

                {/* ITEMS */}
                <section className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Package className="h-3.5 w-3.5" /> Productos
                  </h3>
                  <div className="border border-border/60 rounded-2xl overflow-hidden">
                    <div className="max-h-48 overflow-y-auto">
                      {(selectedOrder.items && selectedOrder.items.length > 0) ? (
                        <div className="divide-y divide-border/40">
                          {selectedOrder.items.map((item, idx) => (
                            <div key={idx} className="p-3 flex justify-between items-center bg-card hover:bg-muted/20 transition-colors">
                              <div className="flex items-center gap-3">
                                <span className="text-xl">{item.emoji || '📦'}</span>
                                <div>
                                  <p className="text-sm font-bold">{item.name}</p>
                                  <p className="text-xs text-muted-foreground">Cantidad: {item.quantity}</p>
                                </div>
                              </div>
                              <p className="text-sm font-semibold">{formatCOP(item.price * item.quantity)}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-6 text-center text-muted-foreground italic text-sm">
                          {selectedOrder.order_type === 'open' ? 'Encargo personalizado: ver descripción abajo.' : 'No hay items registrados.'}
                        </div>
                      )}
                    </div>
                    <div className="bg-muted/20 p-3 flex justify-between items-center border-t border-border/60">
                      <span className="font-bold text-sm">Total a cobrar/pagar:</span>
                      <span className="font-display font-bold text-lg text-primary">
                        {selectedOrder.order_type === 'open' ? 'Por definir' : formatCOP(selectedOrder.total)}
                      </span>
                    </div>
                  </div>
                </section>

                {/* NOTES / DESCRIPTION */}
                {(selectedOrder.notes || selectedOrder.open_order_description) && (
                  <section className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Instrucciones / Notas</h3>
                    <div className="p-4 rounded-2xl bg-orange-500/5 border border-orange-500/10 text-sm italic text-orange-800">
                      {selectedOrder.notes || selectedOrder.open_order_description}
                    </div>
                  </section>
                )}
              </div>

              <div className="p-5 border-t border-border/60 bg-muted/10">
                <Button className="w-full rounded-xl h-11 font-bold" onClick={() => setSelectedOrder(null)}>
                  Cerrar
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SidebarProvider>
  );
};

export default CourierPanel;
