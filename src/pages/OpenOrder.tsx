import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ShoppingBag, MapPin, Store, CreditCard, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import Receipt from "@/components/Receipt";
import { isNightFeeTime } from "@/lib/utils";

const OpenOrder = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [orderSummary, setOrderSummary] = useState<any>(null);

  const [formData, setFormData] = useState({
    customerName: "",
    customerPhone: "",
    deliveryAddress: "",
    originName: "",
    originAddress: "",
    description: "",
    paymentMethod: "cash"
  });

  useEffect(() => {
    const fetchLastOrder = async () => {
      if (!user?.id) return;
      try {
        const response = await fetch(`/api/orders/user/${user.id}`);
        if (response.ok) {
          const orders = await response.json();
          if (orders && orders.length > 0) {
            const lastOrder = orders[0];
            setFormData(prev => ({
              ...prev,
              customerName: lastOrder.customer_name || user.username || "",
              customerPhone: lastOrder.customer_phone || "",
              deliveryAddress: lastOrder.delivery_address || ""
            }));
          } else {
            setFormData(prev => ({ ...prev, customerName: user.username || "" }));
          }
        }
      } catch (error) {
        console.error("Error fetching last order:", error);
      }
    };
    fetchLastOrder();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerName || !formData.originName || !formData.description || !formData.deliveryAddress) {
      toast({ title: "Faltan datos", description: "Por favor completa los campos obligatorios.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user?.id,
          customer_name: formData.customerName,
          customer_phone: formData.customerPhone,
          delivery_address: formData.deliveryAddress,
          origin_name: formData.originName,
          origin_address: formData.originAddress,
          open_order_description: formData.description,
          payment_method: formData.paymentMethod,
          order_type: "open",
          total: 0, // El total se definirá cuando el domiciliario haga la compra
          items: []
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Error al crear el pedido");

      setOrderSummary({
        orderId: data.id,
        customerName: formData.customerName,
        customerPhone: formData.customerPhone,
        deliveryAddress: formData.deliveryAddress,
        paymentMethod: formData.paymentMethod,
        items: [{
          name: `Compra en ${formData.originName}`,
          price: 0,
          quantity: 1,
          emoji: "🛍️"
        }],
        subtotal: 0,
        fee: 5000 + (isNightFeeTime() ? 2000 : 0), // Tarifa base para pedidos abiertos + recargo nocturno
        total: 5000 + (isNightFeeTime() ? 2000 : 0)
      });
      setDone(data.id);
      toast({ title: "¡Pedido enviado!", description: "Un domiciliario se encargará de tu compra." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (done && orderSummary) {
    return (
      <div className="min-h-screen bg-gradient-warm py-12 px-4">
        <Receipt {...orderSummary} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-warm pb-20">
      <header className="container py-6">
        <button onClick={() => navigate(-1)} className="flex items-center text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="h-5 w-5 mr-2" /> Volver
        </button>
        <h1 className="text-3xl font-display font-bold tracking-tight">Pedido Abierto</h1>
        <p className="text-muted-foreground mt-2">¿No encuentras lo que buscas? Nosotros lo compramos por ti.</p>
      </header>

      <main className="container max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Sección de la Tienda */}
          <section className="bg-card/50 backdrop-blur-md border border-border/60 rounded-3xl p-8 shadow-card">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Store className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-bold">¿Dónde compramos?</h2>
            </div>

            <div className="grid gap-6">
              <div className="space-y-2">
                <Label htmlFor="originName">Nombre del lugar *</Label>
                <Input
                  id="originName"
                  placeholder="Ej: Ferretería El Martillo, Tienda de la esquina..."
                  value={formData.originName}
                  onChange={(e) => setFormData({ ...formData, originName: e.target.value })}
                  className="rounded-xl h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="originAddress">Dirección del lugar (Opcional)</Label>
                <Input
                  id="originAddress"
                  placeholder="Ej: Calle 10 # 5-20"
                  value={formData.originAddress}
                  onChange={(e) => setFormData({ ...formData, originAddress: e.target.value })}
                  className="rounded-xl h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">¿Qué necesitas que compremos? *</Label>
                <Textarea
                  id="description"
                  placeholder="Describe detalladamente los productos..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="rounded-xl min-h-[120px]"
                />
              </div>
            </div>
          </section>

          {/* Datos de Entrega */}
          <section className="bg-card/50 backdrop-blur-md border border-border/60 rounded-3xl p-8 shadow-card">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <MapPin className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-bold">¿A dónde lo llevamos?</h2>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="customerName">Tu nombre *</Label>
                <Input
                  id="customerName"
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  className="rounded-xl h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerPhone">Teléfono de contacto</Label>
                <Input
                  id="customerPhone"
                  value={formData.customerPhone}
                  onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                  className="rounded-xl h-12"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="deliveryAddress">Dirección de entrega *</Label>
                <Input
                  id="deliveryAddress"
                  value={formData.deliveryAddress}
                  onChange={(e) => setFormData({ ...formData, deliveryAddress: e.target.value })}
                  className="rounded-xl h-12"
                />
              </div>
            </div>
          </section>

          {/* Método de Pago */}
          <section className="bg-card/50 backdrop-blur-md border border-border/60 rounded-3xl p-8 shadow-card">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <CreditCard className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-bold">Método de pago</h2>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, paymentMethod: 'cash' })}
                className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${formData.paymentMethod === 'cash' ? 'border-primary bg-primary/5' : 'border-border/60'}`}
              >
                <span className="text-2xl">💵</span>
                <span className="font-bold text-sm">Efectivo</span>
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-4 text-center italic">
              * El valor total del pedido se ajustará una vez el domiciliario realice la compra y presente el recibo.
            </p>
          </section>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-16 rounded-[2rem] text-lg font-bold shadow-glow flex items-center justify-center gap-3"
            variant="hero"
          >
            {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : <><Send className="h-6 w-6" /> Enviar Pedido Abierto</>}
          </Button>
        </form>
      </main>
    </div>
  );
};

export default OpenOrder;
