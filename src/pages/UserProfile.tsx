import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  User, 
  ShoppingBag, 
  Ticket, 
  Star, 
  ChevronRight, 
  Clock, 
  MapPin, 
  CheckCircle2, 
  AlertCircle,
  LogOut,
  Gift,
  Settings,
  Camera,
  X,
  Loader2,
  Store
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCOP } from "@/data/mock";
import { toast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";

interface Order {
  id: string;
  business_id: string;
  business_name: string;
  business_emoji: string;
  total: number;
  status: string;
  created_at: string;
  is_rated: boolean;
}

interface Benefit {
  code: string;
  description: string;
  discount: number;
  type: string;
}

const AVATARS = [
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Milo",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Luna",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Oliver",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Zoe",
];

const UserProfile = () => {
  const { user, logout, updateUser } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"orders" | "benefits">("orders");
  const [ratingOrder, setRatingOrder] = useState<Order | null>(null);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  
  // Edit Profile States
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(user?.username || "");
  const [editEmail, setEditEmail] = useState(user?.email || "");
  const [editAvatar, setEditAvatar] = useState(user?.avatar_url || "");

  // Update Profile Mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: { username: string, email: string, avatar_url: string }) => {
      const res = await fetch(`http://localhost:8000/users/${user?.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Error updating profile");
      return res.json();
    },
    onSuccess: (updatedUser) => {
      updateUser(updatedUser);
      toast({ title: "Perfil actualizado", description: "Tus cambios han sido guardados." });
      setIsEditing(false);
    }
  });

  // Fetch Orders
  const { data: orders, isLoading: isLoadingOrders } = useQuery<Order[]>({
    queryKey: ["userOrders", user?.id],
    queryFn: async () => {
      const res = await fetch(`http://localhost:8000/orders/user/${user?.id}`);
      if (!res.ok) throw new Error("Error fetching orders");
      return res.json();
    },
    enabled: !!user?.id,
  });

  // Fetch Benefits
  const { data: benefitsData, isLoading: isLoadingBenefits } = useQuery<{order_count: number, level: number, benefits: Benefit[]}>({
    queryKey: ["userBenefits", user?.id],
    queryFn: async () => {
      const res = await fetch(`http://localhost:8000/users/${user?.id}/benefits`);
      if (!res.ok) throw new Error("Error fetching benefits");
      return res.json();
    },
    enabled: !!user?.id,
  });

  // Rate Order Mutation
  const rateMutation = useMutation({
    mutationFn: async (data: { orderId: string, rating: number, comment: string }) => {
      const res = await fetch(`http://localhost:8000/orders/${data.orderId}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_rating: data.rating,
          courier_rating: data.rating,
          comment: data.comment
        })
      });
      if (!res.ok) throw new Error("Error submitting rating");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userOrders"] });
      toast({
        title: "¡Gracias!",
        description: "Tu calificación ha sido enviada correctamente.",
      });
      setRatingOrder(null);
      setRatingValue(5);
      setRatingComment("");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-warm pb-20">
      {/* Header Perfil */}
      <div className="bg-white dark:bg-zinc-900 border-b border-border/40 pt-12 pb-8">
        <div className="container max-w-4xl">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="relative">
              {user.avatar_url ? (
                <img 
                  src={user.avatar_url} 
                  alt={user.username} 
                  className="h-24 w-24 rounded-full border-4 border-white shadow-lg object-cover"
                />
              ) : (
                <div className="h-24 w-24 rounded-full bg-gradient-hero flex items-center justify-center text-white text-3xl font-bold border-4 border-white shadow-lg">
                  {user.username[0].toUpperCase()}
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-success border-4 border-white flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4 text-white" />
              </div>
            </div>
            
            <div className="flex-1 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-3">
                <h1 className="text-3xl font-display font-bold">¡Hola, {user.username}!</h1>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="rounded-full hover:bg-primary/10 text-primary"
                  onClick={() => {
                     setEditName(user.username);
                     setEditEmail(user.email || "");
                     setEditAvatar(user.avatar_url || "");
                     setIsEditing(true);
                   }}
                >
                  <Settings className="h-5 w-5" />
                </Button>
              </div>
              <p className="text-muted-foreground text-sm font-medium">{user.email}</p>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-2">
                <p className="text-muted-foreground flex items-center gap-2">
                  <User className="h-4 w-4" /> Cliente Rapidito
                </p>
                <Button asChild variant="link" className="h-auto p-0 text-primary font-bold text-sm">
                  <Link to="/" className="flex items-center gap-1">
                    <ShoppingBag className="h-4 w-4" /> Ir a comprar
                  </Link>
                </Button>
              </div>
            </div>

            <Button variant="soft" className="rounded-xl gap-2 text-destructive hover:bg-destructive/10" onClick={logout}>
              <LogOut className="h-4 w-4" /> Cerrar Sesión
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-8">
            <div className="bg-primary/5 rounded-2xl p-4 text-center border border-primary/10">
              <p className="text-2xl font-bold text-primary">{benefitsData?.order_count || 0}</p>
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Pedidos</p>
            </div>
            <div className="bg-orange-500/5 rounded-2xl p-4 text-center border border-orange-500/10">
              <p className="text-2xl font-bold text-orange-600">{benefitsData?.benefits.length || 0}</p>
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Beneficios</p>
            </div>
            <div className="bg-success/5 rounded-2xl p-4 text-center border border-success/10">
              <p className="text-2xl font-bold text-success">{benefitsData?.level || 1}</p>
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Nivel</p>
            </div>
          </div>
        </div>
      </div>

      <main className="container max-w-4xl mt-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-8 bg-card/50 p-1.5 rounded-2xl border border-border/40 w-fit mx-auto md:mx-0">
          <button 
            onClick={() => setActiveTab("orders")}
            className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'orders' ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <ShoppingBag className="h-4 w-4" /> Mis Pedidos
          </button>
          <button 
            onClick={() => setActiveTab("benefits")}
            className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'benefits' ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Ticket className="h-4 w-4" /> Beneficios
          </button>
        </div>

        {activeTab === "orders" && (
          <div className="space-y-4">
            {isLoadingOrders ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-32 bg-card/50 animate-pulse rounded-3xl border border-border/40" />
              ))
            ) : orders && orders.length > 0 ? (
              orders.map((order) => (
                <div key={order.id} className="bg-card/50 backdrop-blur-md border border-border/40 rounded-[2rem] p-6 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
                  <div className="flex items-start justify-between relative z-10">
                    <div className="flex items-center gap-4">
                      <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                        {order.business_emoji || "🛍️"}
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">{order.business_name || "Encargo Especial"}</h3>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 font-medium">
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(order.created_at).toLocaleDateString()}</span>
                          <span className="h-1 w-1 bg-border rounded-full" />
                          <span className="font-mono uppercase tracking-tighter">ID: {order.id}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg text-primary">{formatCOP(order.total)}</p>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                        order.status === 'delivered' ? 'bg-success/10 text-success border-success/20' : 
                        order.status === 'cancelled' ? 'bg-destructive/10 text-destructive border-destructive/20' : 
                        'bg-primary/10 text-primary border-primary/20'
                      }`}>
                        {order.status}
                      </span>
                    </div>
                  </div>

                  <div className="mt-6 flex items-center justify-between border-t border-border/40 pt-4 relative z-10">
                    <Link to={`/rastreo/${order.id}`} className="text-xs font-bold text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
                      Ver detalles <ChevronRight className="h-3 w-3" />
                    </Link>
                    
                    {order.status === 'delivered' && !order.is_rated && (
                      <Button 
                        size="sm" 
                        variant="hero" 
                        className="rounded-xl h-9 text-xs font-bold gap-1.5"
                        onClick={() => setRatingOrder(order)}
                      >
                        <Star className="h-3.5 w-3.5" /> Calificar pedido
                      </Button>
                    )}
                    {order.is_rated && (
                      <div className="flex items-center gap-1 text-success text-xs font-bold">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Calificado
                      </div>
                    )}
                  </div>
                  
                  {/* Decoración fondo */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-primary/10 transition-colors" />
                </div>
              ))
            ) : (
              <div className="text-center py-20 bg-card/30 rounded-[3rem] border border-dashed border-border/60">
                <ShoppingBag className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-40" />
                <p className="text-muted-foreground font-medium">Aún no has realizado pedidos.</p>
                <Button asChild variant="soft" className="mt-6 rounded-xl">
                  <Link to="/negocios">Explorar negocios</Link>
                </Button>
              </div>
            )}
          </div>
        )}

        {activeTab === "benefits" && (
          <div className="space-y-6">
            <div className="bg-gradient-hero rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-glow">
              <div className="relative z-10">
                <h2 className="text-3xl font-display font-bold mb-2">Tu Progreso de Lealtad</h2>
                <p className="text-white/80 text-sm mb-8">¡Sigue pidiendo y desbloquea más descuentos!</p>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold uppercase tracking-widest">
                    <span>{benefitsData?.order_count || 0} pedidos realizados</span>
                    <span>Meta: 10 pedidos</span>
                  </div>
                  <div className="h-3 bg-white/20 rounded-full overflow-hidden border border-white/10">
                    <div 
                      className="h-full bg-white shadow-glow transition-all duration-1000" 
                      style={{ width: `${Math.min(((benefitsData?.order_count || 0) / 10) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {isLoadingBenefits ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-40 bg-card/50 animate-pulse rounded-3xl border border-border/40" />
                ))
              ) : benefitsData && benefitsData.benefits.length > 0 ? (
                benefitsData.benefits.map((benefit) => (
                  <div key={benefit.code} className="bg-white dark:bg-zinc-900 border-2 border-primary/20 rounded-3xl p-6 shadow-sm relative overflow-hidden group">
                    <div className="relative z-10">
                      <div className="flex justify-between items-start mb-4">
                        <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                          <Gift className="h-6 w-6" />
                        </div>
                        <div className="bg-success text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase">
                          Disponible
                        </div>
                      </div>
                      
                      <h3 className="font-bold text-xl leading-tight mb-2">{benefit.description}</h3>
                      
                      <div className="mt-6 p-3 bg-muted rounded-xl border border-dashed border-border flex items-center justify-between">
                        <span className="font-mono font-bold text-primary tracking-wider">{benefit.code}</span>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-8 text-[10px] font-bold uppercase hover:bg-primary/5 text-primary"
                          onClick={() => {
                            navigator.clipboard.writeText(benefit.code);
                            toast({ title: "Copiado", description: "Código copiado al portapapeles." });
                          }}
                        >
                          Copiar
                        </Button>
                      </div>
                    </div>
                    <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-primary/5 rounded-full blur-2xl group-hover:scale-150 transition-transform" />
                  </div>
                ))
              ) : (
                <div className="col-span-full text-center py-12 bg-card/30 rounded-[3rem] border border-dashed border-border/60">
                  <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto mb-4 opacity-40" />
                  <p className="text-muted-foreground font-medium">Aún no tienes beneficios disponibles.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sección de Registro de Negocio */}
        <div className="mt-12 bg-zinc-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-glow border border-white/5 group">
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-center md:text-left">
              <h3 className="text-2xl font-display font-bold mb-2 flex items-center justify-center md:justify-start gap-2">
                <Store className="h-6 w-6 text-primary" /> ¿Tienes un negocio?
              </h3>
              <p className="text-zinc-400 text-sm max-w-md">Únete a nuestra red y empieza a vender tus productos hoy mismo con la mejor logística y visibilidad.</p>
            </div>
            <Button asChild variant="hero" className="rounded-2xl h-14 px-8 font-bold shadow-glow shrink-0 group-hover:scale-105 transition-transform">
              <Link to="/negocios/registro">Registrar mi negocio</Link>
            </Button>
          </div>
          <div className="absolute -top-10 -left-10 w-40 h-40 bg-primary/20 rounded-full blur-3xl group-hover:bg-primary/30 transition-colors" />
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-primary/10 rounded-full blur-3xl" />
        </div>
      </main>

      {/* Modal de Calificación */}
      {ratingOrder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-500">
            <div className="text-center mb-8">
              <div className="h-20 w-20 rounded-3xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4 text-4xl">
                {ratingOrder.business_emoji}
              </div>
              <h2 className="text-2xl font-display font-bold">Califica tu pedido</h2>
              <p className="text-muted-foreground text-sm mt-1">¿Qué tal estuvo tu experiencia con {ratingOrder.business_name}?</p>
            </div>

            <div className="flex justify-center gap-2 mb-8">
              {[1, 2, 3, 4, 5].map((star) => (
                <button 
                  key={star}
                  onClick={() => setRatingValue(star)}
                  className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-all ${
                    ratingValue >= star ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-110' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <Star className={`h-6 w-6 ${ratingValue >= star ? 'fill-current' : ''}`} />
                </button>
              ))}
            </div>

            <div className="space-y-4">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Tu comentario (Opcional)</label>
              <textarea 
                className="w-full h-32 rounded-2xl border border-border bg-background px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                placeholder="Cuéntanos más sobre tu pedido..."
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 mt-8">
              <Button variant="soft" className="rounded-2xl h-14 font-bold" onClick={() => setRatingOrder(null)}>
                Cancelar
              </Button>
              <Button 
                variant="hero" 
                className="rounded-2xl h-14 font-bold shadow-glow" 
                onClick={() => rateMutation.mutate({ orderId: ratingOrder.id, rating: ratingValue, comment: ratingComment })}
                disabled={rateMutation.isPending}
              >
                {rateMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : "Enviar calificación"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Editar Perfil */}
      {isEditing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-500 relative">
            <button 
              onClick={() => setIsEditing(false)}
              className="absolute top-6 right-6 h-10 w-10 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="text-center mb-8">
              <h2 className="text-2xl font-display font-bold">Editar Perfil</h2>
              <p className="text-muted-foreground text-sm mt-1">Personaliza tu apariencia en Rapidito</p>
            </div>

            <div className="space-y-8">
              {/* Avatar Selection */}
              <div className="space-y-4">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest text-center block">Selecciona un avatar</label>
                <div className="grid grid-cols-3 gap-4">
                  {AVATARS.map((url) => (
                    <button
                      key={url}
                      onClick={() => setEditAvatar(url)}
                      className={`relative aspect-square rounded-2xl overflow-hidden border-4 transition-all ${
                        editAvatar === url ? 'border-primary scale-105 shadow-lg' : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={url} alt="Avatar option" className="h-full w-full object-cover" />
                      {editAvatar === url && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                          <CheckCircle2 className="h-6 w-6 text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Name Input */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="space-y-2">
                   <Label htmlFor="editName" className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Nombre</Label>
                   <Input 
                     id="editName"
                     value={editName}
                     onChange={(e) => setEditName(e.target.value)}
                     className="h-12 rounded-xl text-sm font-medium px-4 focus:ring-primary/20"
                     placeholder="Tu nombre..."
                   />
                 </div>
                 <div className="space-y-2">
                   <Label htmlFor="editEmail" className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Email</Label>
                   <Input 
                     id="editEmail"
                     type="email"
                     value={editEmail}
                     onChange={(e) => setEditEmail(e.target.value)}
                     className="h-12 rounded-xl text-sm font-medium px-4 focus:ring-primary/20"
                     placeholder="tu@email.com"
                   />
                 </div>
               </div>

               <div className="pt-4">
                 <Button 
                   variant="hero" 
                   className="w-full rounded-2xl h-14 font-bold shadow-glow text-lg" 
                   onClick={() => updateProfileMutation.mutate({ username: editName, email: editEmail, avatar_url: editAvatar })}
                   disabled={updateProfileMutation.isPending || !editName.trim() || !editEmail.trim()}
                 >
                  {updateProfileMutation.isPending ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    "Guardar cambios"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserProfile;
