import { createContext, useContext, useMemo, useState, ReactNode } from "react";
import { MenuItem } from "@/data/mock";

export type CartLine = { item: any; qty: number; businessId: string; businessName: string };

type CartContextType = {
  lines: CartLine[];
  add: (item: any, businessName: string) => void;
  remove: (itemId: string) => void;
  setQty: (itemId: string, qty: number) => void;
  clear: () => void;
  applyPromo: (code: string, discount: number) => void;
  promo: { code: string; discount: number } | null;
  count: number;
  subtotal: number;
};

const CartContext = createContext<CartContextType | null>(null);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [promo, setPromo] = useState<{ code: string; discount: number } | null>(null);

  const add = (item: any, businessName: string) => {
    const bId = String(item.businessId || item.business_id);

    setLines((prev) => {
      const itemId = String(item.id);
      const existing = prev.find((l) => String(l.item.id) === itemId);
      if (existing) return prev.map((l) => (String(l.item.id) === itemId ? { ...l, qty: l.qty + 1 } : l));
      return [...prev, { item, qty: 1, businessId: bId, businessName }];
    });
  };



  const remove = (itemId: string) =>
    setLines((prev) => prev.filter((l) => String(l.item.id) !== String(itemId)));

  const setQty = (itemId: string, qty: number) =>
    setLines((prev) =>
      qty <= 0
        ? prev.filter((l) => String(l.item.id) !== String(itemId))
        : prev.map((l) => (String(l.item.id) === String(itemId) ? { ...l, qty } : l))
    );

  const clear = () => {
    setLines([]);
    setPromo(null);
  };

  const applyPromo = (code: string, discount: number) => {
    setPromo({ code, discount });
  };

  const value = useMemo<CartContextType>(() => ({
    lines, add, remove, setQty, clear, applyPromo, promo,
    count: lines.reduce((s, l) => s + l.qty, 0),
    subtotal: lines.reduce((s, l) => s + l.qty * l.item.price, 0)
  }), [lines, promo]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
};
