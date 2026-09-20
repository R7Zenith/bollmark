"use client";

import { useEffect } from "react";
import { useCart } from "@/lib/cart";

// Sepet yalnizca odeme DOGRULANINCA temizlenir (odeme sayfasindan cikarken degil).
export function ClearCartOnMount() {
  const { clear } = useCart();
  useEffect(() => {
    clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
