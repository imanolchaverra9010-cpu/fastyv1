import { Link, useLocation } from "react-router-dom";
import { Minus, Plus, ShoppingBag, Trash2, Send } from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useCart } from "@/context/CartContext";
import { formatCOP } from "@/data/mock";
import { useEffect, useState } from "react";

const CartButton = () => {
  const { lines, count, subtotal, setQty, remove } = useCart();
  const location = useLocation();
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (location.pathname === "/checkout") {
      setSheetOpen(false);
    }
  }, [location.pathname]);

  return (
    <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
      <SheetTrigger asChild>
        <Button variant="soft" size="sm" className="relative">
          <ShoppingBag className="h-4 w-4" />
          <span className="hidden sm:inline">Carrito</span>
          {count > 0 && (
            <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold grid place-items-center">
              {count}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="flex flex-col w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl">Tu pedido</SheetTitle>
          {lines[0] && (
            <p className="text-sm text-muted-foreground">de {lines[0].businessName}</p>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6 py-4 space-y-3">
          {lines.length === 0 && (
            <div className="text-center py-12 flex flex-col items-center">
              <div className="h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <ShoppingBag className="h-10 w-10 text-muted-foreground opacity-40" />
              </div>
              <p className="text-muted-foreground font-medium">Tu carrito está vacío</p>
              
              <div className="mt-8 p-6 rounded-3xl bg-primary/5 border border-primary/10 w-full">
                <p className="text-sm font-bold text-primary mb-2">¿No encuentras lo que buscas?</p>
                <p className="text-xs text-muted-foreground mb-4">Pide lo que sea de cualquier lugar y nosotros lo compramos por ti.</p>
                <SheetTrigger asChild>
                  <Button asChild variant="hero" size="sm" className="w-full rounded-xl gap-2 text-xs font-bold">
                    <Link to="/pedido-abierto">
                      <Send className="h-3 w-3" /> Hacer Pedido Abierto
                    </Link>
                  </Button>
                </SheetTrigger>
              </div>
            </div>
          )}
          {lines.map((l) => (
            <div key={l.item.id} className="flex gap-3 p-3 rounded-xl bg-muted/40">
              <div className="text-3xl">{l.item.emoji}</div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{l.item.name}</p>
                <p className="text-xs text-muted-foreground">{formatCOP(l.item.price)}</p>
                <div className="mt-2 flex items-center gap-1.5">
                  <Button size="icon" variant="soft" className="h-7 w-7" onClick={() => setQty(l.item.id, l.qty - 1)}>
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-7 text-center text-sm font-semibold">{l.qty}</span>
                  <Button size="icon" variant="soft" className="h-7 w-7" onClick={() => setQty(l.item.id, l.qty + 1)}>
                    <Plus className="h-3 w-3" />
                  </Button>
                  <button onClick={() => remove(l.item.id)} className="ml-auto text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <p className="font-display font-bold text-sm whitespace-nowrap">{formatCOP(l.item.price * l.qty)}</p>
            </div>
          ))}
        </div>

        {lines.length > 0 && (
          <SheetFooter className="border-t border-border pt-4 flex-col sm:flex-col gap-3">
            <div className="flex items-center justify-between w-full">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-display font-bold text-xl">{formatCOP(subtotal)}</span>
            </div>
            <Button asChild variant="hero" size="lg" className="w-full">
              <Link to="/checkout">Continuar al pago</Link>
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default CartButton;
