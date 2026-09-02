"use client";

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { useSession } from "next-auth/react";

type WishlistContextValue = {
  ids: Set<string>;
  isAuthenticated: boolean;
  toggle: (productId: string) => void;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);
const STORAGE_KEY = "bollmark-wishlist";

function readLocalIds(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function writeLocalIds(ids: string[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // yazma başarısız olursa (örn. gizli sekme) sessizce yut
  }
}

// cart.tsx ile ayni desende ama ikili kaynak: giris yapilmamis kullanicida
// localStorage, giris yapilmissa DB (WishlistItem) tek gercek kaynak olur.
// Giris aninda bir kerelik senkronizasyon yapilir (bkz. handleSync), sonra
// localStorage temizlenir.
export function WishlistProvider({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const [ids, setIds] = useState<Set<string>>(new Set());
  const syncedRef = useRef(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      setIds(new Set(readLocalIds()));
      return;
    }
    if (status !== "authenticated" || syncedRef.current) return;
    syncedRef.current = true;

    const localIds = readLocalIds();
    (async () => {
      if (localIds.length > 0) {
        await fetch("/api/favoriler/senkronize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productIds: localIds })
        }).catch(() => {
          // senkronizasyon basarisiz olursa sessizce yut, DB'den okunan liste yine gosterilir
        });
        writeLocalIds([]);
      }
      try {
        const res = await fetch("/api/favoriler");
        const data = await res.json();
        setIds(new Set(Array.isArray(data.productIds) ? data.productIds : []));
      } catch {
        // olamazsa bos listeyle devam
      }
    })();
  }, [status]);

  function toggle(productId: string) {
    if (status === "authenticated") {
      const isRemoving = ids.has(productId);
      setIds((prev) => {
        const next = new Set(prev);
        if (isRemoving) next.delete(productId);
        else next.add(productId);
        return next;
      });
      fetch("/api/favoriler", {
        method: isRemoving ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId })
      }).catch(() => {
        // istek basarisiz olursa sessizce yut - kullanici tekrar deneyebilir
      });
      return;
    }

    setIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      writeLocalIds(Array.from(next));
      return next;
    });
  }

  return (
    <WishlistContext.Provider value={{ ids, isAuthenticated: status === "authenticated", toggle }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist, WishlistProvider içinde kullanılmalıdır");
  return ctx;
}
