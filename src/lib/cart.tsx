"use client";

import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";

export type CartLine = {
  productId: string;
  variantId: string;
  name: string;
  size: string;
  color: string;
  priceCents: number;
  image: string;
  quantity: number;
};

type CartContextValue = {
  lines: CartLine[];
  addLine: (line: CartLine) => void;
  removeLine: (variantId: string) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  clear: () => void;
  totalCents: number;
  totalCount: number;
  couponCode: string | null;
  setCouponCode: (code: string | null) => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "bollmark-cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Eski format (dogrudan CartLine[]) ile geriye uyumluluk - kupon
        // eklenmeden once localStorage'da sadece dizi tutuluyordu.
        if (Array.isArray(parsed)) {
          setLines(parsed);
        } else if (parsed && typeof parsed === "object") {
          if (Array.isArray(parsed.lines)) setLines(parsed.lines);
          if (typeof parsed.couponCode === "string") setCouponCode(parsed.couponCode);
        }
      }
    } catch {
      // localStorage okunamazsa sessizce boş sepetle devam et
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ lines, couponCode }));
    } catch {
      // yazma başarısız olursa (örn. gizli sekme) sessizce yut
    }
  }, [lines, couponCode, hydrated]);

  const addLine = (line: CartLine) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.variantId === line.variantId);
      if (existing) {
        return prev.map((l) =>
          l.variantId === line.variantId ? { ...l, quantity: l.quantity + line.quantity } : l
        );
      }
      return [...prev, line];
    });
  };

  const removeLine = (variantId: string) => {
    setLines((prev) => prev.filter((l) => l.variantId !== variantId));
  };

  const updateQuantity = (variantId: string, quantity: number) => {
    setLines((prev) =>
      prev.map((l) => (l.variantId === variantId ? { ...l, quantity: Math.max(1, quantity) } : l))
    );
  };

  const clear = () => {
    setLines([]);
    setCouponCode(null);
  };

  const { totalCents, totalCount } = useMemo(() => {
    return lines.reduce(
      (acc, l) => ({
        totalCents: acc.totalCents + l.priceCents * l.quantity,
        totalCount: acc.totalCount + l.quantity
      }),
      { totalCents: 0, totalCount: 0 }
    );
  }, [lines]);

  return (
    <CartContext.Provider
      value={{ lines, addLine, removeLine, updateQuantity, clear, totalCents, totalCount, couponCode, setCouponCode }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart, CartProvider içinde kullanılmalıdır");
  return ctx;
}
