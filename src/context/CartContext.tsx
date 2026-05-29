import { createContext, useContext, useMemo, useState, useEffect, ReactNode } from "react";

export type CartLine = { item: any; qty: number; businessId: string; businessName: string };

const CART_STORAGE_KEY = "fasty_cart";
const CART_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type StoredCart = {
  lines: CartLine[];
  promo: { code: string; discount: number } | null;
  savedAt?: string;
};

function isValidCartLine(line: unknown): line is CartLine {
  if (!line || typeof line !== "object") return false;
  const l = line as CartLine;
  return (
    Boolean(l.item) &&
    typeof l.qty === "number" &&
    l.qty > 0 &&
    typeof l.businessId === "string" &&
    typeof l.businessName === "string" &&
    typeof l.item.price === "number" &&
    l.item.id != null &&
    typeof l.item.name === "string"
  );
}

function loadCartFromStorage(): StoredCart {
  if (typeof window === "undefined") {
    return { lines: [], promo: null };
  }
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return { lines: [], promo: null };

    const parsed = JSON.parse(raw) as StoredCart;
    if (parsed.savedAt) {
      const age = Date.now() - new Date(parsed.savedAt).getTime();
      if (Number.isNaN(age) || age > CART_MAX_AGE_MS) {
        localStorage.removeItem(CART_STORAGE_KEY);
        return { lines: [], promo: null };
      }
    }

    const lines = Array.isArray(parsed.lines)
      ? parsed.lines.filter(isValidCartLine)
      : [];

    const promo =
      parsed.promo &&
      typeof parsed.promo.code === "string" &&
      typeof parsed.promo.discount === "number"
        ? parsed.promo
        : null;

    return { lines, promo };
  } catch {
    localStorage.removeItem(CART_STORAGE_KEY);
    return { lines: [], promo: null };
  }
}

function saveCartToStorage(lines: CartLine[], promo: { code: string; discount: number } | null) {
  if (typeof window === "undefined") return;
  if (lines.length === 0 && !promo) {
    localStorage.removeItem(CART_STORAGE_KEY);
    return;
  }
  const payload: StoredCart = {
    lines,
    promo,
    savedAt: new Date().toISOString(),
  };
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(payload));
}

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
  const [initialCart] = useState(loadCartFromStorage);
  const [lines, setLines] = useState<CartLine[]>(initialCart.lines);
  const [promo, setPromo] = useState<{ code: string; discount: number } | null>(initialCart.promo);

  useEffect(() => {
    saveCartToStorage(lines, promo);
  }, [lines, promo]);

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
    if (typeof window !== "undefined") {
      localStorage.removeItem(CART_STORAGE_KEY);
    }
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
