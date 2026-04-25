import { CheckCircle2, MapPin, User, CreditCard, ShoppingBag } from "lucide-react";
import { formatCOP } from "@/data/mock";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface ReceiptProps {
  orderId: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  paymentMethod: string;
  items: {
    name: string;
    price: number;
    quantity: number;
    emoji: string;
  }[];
  subtotal: number;
  fee: number;
  discount?: number;
  promoCode?: string;
  total: number;
}

const Receipt = ({
  orderId,
  customerName,
  deliveryAddress,
  paymentMethod,
  items,
  subtotal,
  fee,
  discount,
  promoCode,
  total
}: ReceiptProps) => {
  const navigate = useNavigate();
  const date = new Date().toLocaleString("es-CO", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const paymentLabels: Record<string, string> = {
    card: "Tarjeta de Crédito/Débito",
    cash: "Efectivo",
    wallet: "Billetera Digital"
  };

  return (
    <div className="animate-in fade-in zoom-in duration-500 max-w-md mx-auto relative z-10">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl overflow-hidden border border-border/40 relative">
        {/* Decorative Top Bar */}
        <div className="h-2 bg-gradient-to-r from-primary via-orange-400 to-primary" />
        
        <div className="p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success/10 text-success mb-4 animate-bounce-slow">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-display font-bold">¡Pedido Confirmado!</h2>
            <p className="text-muted-foreground text-sm mt-1">Gracias por tu compra en Rapidito</p>
          </div>

          {/* Order ID & Date */}
          <div className="flex justify-between items-center py-3 border-y border-dashed border-border mb-6">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Orden ID</p>
              <p className="font-mono font-bold text-sm">{orderId}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Fecha</p>
              <p className="text-sm font-medium">{date}</p>
            </div>
          </div>

          {/* Customer Details */}
          <div className="space-y-4 mb-8">
            <div className="flex items-start gap-3">
              <div className="mt-1 p-1.5 rounded-lg bg-primary/5 text-primary">
                <User className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Cliente</p>
                <p className="text-sm font-bold">{customerName}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-1 p-1.5 rounded-lg bg-primary/5 text-primary">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Dirección de Entrega</p>
                <p className="text-sm font-bold leading-tight">{deliveryAddress}</p>
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="space-y-4 mb-8">
            <div className="flex items-center gap-2 mb-2">
              <ShoppingBag className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-bold uppercase tracking-wider">Productos</h3>
            </div>
            <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-muted">
              {items.map((item, index) => (
                <div key={index} className="flex justify-between items-center group">
                  <div className="flex items-center gap-3">
                    <span className="text-xl group-hover:scale-110 transition-transform">{item.emoji}</span>
                    <div>
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">x{item.quantity}</p>
                    </div>
                  </div>
                  <p className="text-sm font-bold">{formatCOP(item.price * item.quantity)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="bg-muted/30 rounded-2xl p-4 space-y-2 mb-8">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{formatCOP(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Envío</span>
              <span className="font-medium">{formatCOP(fee)}</span>
            </div>
            {discount && discount > 0 && (
              <div className="flex justify-between text-sm text-success">
                <span>Descuento {promoCode ? `(${promoCode})` : ""}</span>
                <span className="font-medium">-{formatCOP(discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold pt-2 border-t border-border/50 mt-2">
              <span>Total Pagado</span>
              <span className="text-primary text-lg">{formatCOP(total)}</span>
            </div>
          </div>

          {/* Payment Method */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-border/50 bg-card mb-8">
            <div className="flex items-center gap-3">
              <CreditCard className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm font-medium">{paymentLabels[paymentMethod] || paymentMethod}</span>
            </div>
            <div className="text-[10px] font-bold uppercase text-success bg-success/10 px-2 py-1 rounded-full border border-success/20">
              Pagado
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3">
            <Button 
              variant="hero" 
              className="w-full shadow-lg shadow-primary/20"
              onClick={() => navigate(`/rastreo/${orderId}`)}
            >
              Rastrear Pedido
            </Button>
            <Button 
              variant="soft" 
              className="w-full"
              onClick={() => navigate("/negocios")}
            >
              Cerrar
            </Button>
          </div>
        </div>

        {/* Receipt "Teeth" Effect at the bottom */}
        <div className="flex justify-between absolute -bottom-2 left-0 right-0 overflow-hidden h-4">
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} className="w-4 h-4 bg-background dark:bg-background rotate-45 transform translate-y-2 flex-shrink-0" />
          ))}
        </div>
      </div>
      
      {/* Decorative Shadow */}
      <div className="h-6 w-[85%] mx-auto bg-black/10 blur-2xl rounded-full -mt-2" />
    </div>
  );
};

export default Receipt;
