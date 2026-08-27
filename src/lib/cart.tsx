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
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "bollmark-cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setLines(JSON.parse(raw));
    } catch {
      // localStorage okunamazsa sessizce bos sepetle devam et
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // yazma basarisiz olursa (orn. gizli sekme) sessizce yut
    }
  }, [lines, hydrated]);

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

  const clear = () => setLines([]);

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
    <CartContext.Provider value={{ lines, addLine, removeLine, updateQuantity, clear, totalCents, totalCount }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart, CartProvider icinde kullanilmalidir");
  return ctx;
}
