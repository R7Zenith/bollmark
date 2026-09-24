"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import {
  MAX_CART_LINES,
  MAX_LINE_QUANTITY,
  type CartLineIssue,
  type ResolvedCartLine
} from "@/lib/cart-shared";

export type CartLine = {
  productId: string;
  variantId: string;
  name: string;
  size: string;
  color: string;
  priceCents: number;
  compareAtCents?: number | null;
  image: string;
  quantity: number;
  /** Son bilinen stok (fiyat tazelemesinde/ekleme aninda gelir) - adet secicisini sinirlamak icin kullanilir. */
  stock?: number;
  /** Gorsel gri zemin + mix-blend-multiply ile mi gosterilsin (bkz. lib/image-backdrop.ts). */
  greyBackdrop?: boolean;
};

export type PriceNotice = {
  variantId: string;
  name: string;
  oldPriceCents: number;
  newPriceCents: number;
};

export type RefreshResult = { priceChanged: boolean; blocked: boolean };

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
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  /** Son tazelemede fiyati degisen satirlar (kullaniciya gosterilir, kapatilabilir). */
  priceNotices: PriceNotice[];
  dismissPriceNotice: (variantId?: string) => void;
  /** Yayindan kalkmis / stogu bitmis satirlar (variantId -> sorun). Odeme engellenir. */
  lineIssues: Record<string, CartLineIssue>;
  hasBlockingIssues: boolean;
  /** Sepet fiyatlarini sunucudaki guncel degerlerle esitler. */
  refreshPrices: () => Promise<RefreshResult>;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "bollmark-cart";
const SYNC_DEBOUNCE_MS = 500;
// Odak/yol/cekmece tetikleyicileri art arda ates ederse gereksiz istek atma.
const AUTO_REFRESH_MIN_INTERVAL_MS = 2000;

function readLocalCart(): { lines: CartLine[]; couponCode: string | null } {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { lines: [], couponCode: null };
    const parsed = JSON.parse(raw);
    // Eski format (dogrudan CartLine[]) ile geriye uyumluluk - kupon
    // eklenmeden once localStorage'da sadece dizi tutuluyordu.
    if (Array.isArray(parsed)) return { lines: parsed, couponCode: null };
    if (parsed && typeof parsed === "object") {
      return {
        lines: Array.isArray(parsed.lines) ? parsed.lines : [],
        couponCode: typeof parsed.couponCode === "string" ? parsed.couponCode : null
      };
    }
  } catch {
    // localStorage okunamazsa sessizce boş sepetle devam et
  }
  return { lines: [], couponCode: null };
}

function clearLocalCart() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // sessizce yut
  }
}

// DB'ye / dogrulama istegine giden hali: yalniz id + adet.
function toInputs(lines: { productId: string; variantId: string; quantity: number }[]) {
  return lines.slice(0, MAX_CART_LINES).map((l) => ({
    productId: l.productId,
    variantId: l.variantId,
    quantity: Math.min(MAX_LINE_QUANTITY, Math.max(1, l.quantity))
  }));
}

function syncKeyOf(lines: { productId: string; variantId: string; quantity: number }[], couponCode: string | null) {
  return JSON.stringify([toInputs(lines).map((l) => [l.productId, l.variantId, l.quantity]), couponCode]);
}

function toCartLine(f: ResolvedCartLine): CartLine {
  return {
    productId: f.productId,
    variantId: f.variantId,
    name: f.name,
    size: f.size,
    color: f.color,
    priceCents: f.priceCents,
    compareAtCents: f.compareAtCents,
    image: f.image,
    quantity: f.quantity,
    stock: f.stock,
    greyBackdrop: f.greyBackdrop
  };
}

async function putServerCart(lines: CartLine[], couponCode: string | null): Promise<boolean> {
  try {
    const res = await fetch("/api/sepet", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lines: toInputs(lines), couponCode })
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function fetchFresh(lines: CartLine[]): Promise<ResolvedCartLine[] | null> {
  try {
    const res = await fetch("/api/sepet/dogrula", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lines: toInputs(lines) }),
      cache: "no-store"
    });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data.lines) ? data.lines : null;
  } catch {
    return null;
  }
}

// Sunucudan gelen guncel degerleri satirlara isler. Adet ve satir kimligi
// (productId/variantId) HIC degismez - bu yuzden sonucun DB'ye yazilan kismi
// (id + adet) etkilenmez ve tazeleme bir kayit (PUT) dongusu baslatmaz.
// Degisiklik yoksa AYNI dizi referansi doner (gereksiz yeniden render/istek yok).
function applyFresh(base: CartLine[], fresh: ResolvedCartLine[]) {
  const freshByVariant = new Map(fresh.map((f) => [f.variantId, f]));
  const notices: PriceNotice[] = [];
  const issues: Record<string, CartLineIssue> = {};
  let changed = false;

  const next = base.map((line) => {
    const f = freshByVariant.get(line.variantId);
    if (!f) return line;
    if (f.issue) issues[line.variantId] = f.issue;
    // Urun artik cozumlenemiyor: satiri oldugu gibi birak, sadece isaretle.
    if (f.issue === "UNAVAILABLE") return line;

    if (f.priceCents !== line.priceCents) {
      notices.push({
        variantId: line.variantId,
        name: f.name,
        oldPriceCents: line.priceCents,
        newPriceCents: f.priceCents
      });
    }
    const updated: CartLine = {
      ...line,
      name: f.name,
      size: f.size || line.size,
      color: f.color || line.color,
      image: f.image,
      priceCents: f.priceCents,
      compareAtCents: f.compareAtCents,
      stock: f.stock,
      greyBackdrop: f.greyBackdrop
    };
    const same =
      updated.name === line.name &&
      updated.size === line.size &&
      updated.color === line.color &&
      updated.image === line.image &&
      updated.priceCents === line.priceCents &&
      (updated.compareAtCents ?? null) === (line.compareAtCents ?? null) &&
      updated.stock === line.stock &&
      updated.greyBackdrop === line.greyBackdrop;
    if (same) return line;
    changed = true;
    return updated;
  });

  return { lines: changed ? next : base, notices, issues };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const pathname = usePathname();
  const [lines, setLines] = useState<CartLine[]>([]);
  const [couponCode, setCouponCodeState] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [priceNotices, setPriceNotices] = useState<PriceNotice[]>([]);
  const [lineIssues, setLineIssues] = useState<Record<string, CartLineIssue>>({});
  // Giris yapmis musteride DB'den ilk okuma/birlestirme bitene kadar false -
  // bitmeden DB'ye yazmak bos yerel sepetle kayitli sepetin ustunu ezerdi.
  const [serverReady, setServerReady] = useState(false);

  const linesRef = useRef(lines);
  const couponRef = useRef(couponCode);
  const statusRef = useRef(status);
  const serverReadyRef = useRef(serverReady);
  useEffect(() => {
    linesRef.current = lines;
    couponRef.current = couponCode;
    statusRef.current = status;
    serverReadyRef.current = serverReady;
  }, [lines, couponCode, status, serverReady]);

  // Kullanici kaynakli her degisiklikte artar - DB'den gelen gecikmis bir
  // yanit, arada yapilan yerel degisikligin ustunu ezmesin diye.
  const versionRef = useRef(0);
  const lastSyncedKeyRef = useRef<string | null>(null);
  const dirtyRef = useRef(false);
  const syncStartedRef = useRef(false);
  const wasAuthenticatedRef = useRef(false);
  // Odeme tamamlanip clear() cagrildiginda oturum henuz cozulmemis olabilir
  // (tesekkurler sayfasi acilir acilmaz) - o zaman ilk senkronizasyon DB'deki
  // sepeti geri getirmesin.
  const clearedBeforeSyncRef = useRef(false);
  const refreshInFlightRef = useRef<Promise<RefreshResult> | null>(null);
  const lastAutoRefreshRef = useRef(0);

  const openDrawer = () => setIsDrawerOpen(true);
  const closeDrawer = () => setIsDrawerOpen(false);

  useEffect(() => {
    const local = readLocalCart();
    setLines(local.lines);
    setCouponCodeState(local.couponCode);
    setHydrated(true);
  }, []);

  // Misafirde localStorage kaynaktir. Giris yapilmissa kaynak DB'dir, yerel
  // kopya yazilmaz (ortak bilgisayarda onceki musterinin sepeti kalmasin).
  useEffect(() => {
    if (!hydrated || status !== "unauthenticated") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ lines, couponCode }));
    } catch {
      // yazma başarısız olursa (örn. gizli sekme) sessizce yut
    }
  }, [lines, couponCode, hydrated, status]);

  const applyFreshToState = useCallback((fresh: ResolvedCartLine[]): RefreshResult => {
    const result = applyFresh(linesRef.current, fresh);
    if (result.lines !== linesRef.current) {
      setLines((prev) => applyFresh(prev, fresh).lines);
    }
    setLineIssues((prev) => (JSON.stringify(prev) === JSON.stringify(result.issues) ? prev : result.issues));
    if (result.notices.length > 0) {
      setPriceNotices((prev) => [
        ...prev.filter((n) => !result.notices.some((r) => r.variantId === n.variantId)),
        ...result.notices
      ]);
    }
    return { priceChanged: result.notices.length > 0, blocked: Object.keys(result.issues).length > 0 };
  }, []);

  const refreshPrices = useCallback((): Promise<RefreshResult> => {
    if (refreshInFlightRef.current) return refreshInFlightRef.current;
    const snapshot = linesRef.current;
    if (snapshot.length === 0) {
      setLineIssues((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      return Promise.resolve({ priceChanged: false, blocked: false });
    }
    const promise = (async (): Promise<RefreshResult> => {
      const fresh = await fetchFresh(snapshot);
      // Dogrulama alinamazsa sessizce gec: siparis sunucuda yine DB fiyatiyla
      // (ve uyusmazlikta 409 ile) korunur.
      if (!fresh) return { priceChanged: false, blocked: false };
      return applyFreshToState(fresh);
    })().finally(() => {
      refreshInFlightRef.current = null;
    });
    refreshInFlightRef.current = promise;
    return promise;
  }, [applyFreshToState]);

  const autoRefresh = useCallback(() => {
    const ready = statusRef.current === "unauthenticated" || (statusRef.current === "authenticated" && serverReadyRef.current);
    if (!ready) return;
    const now = Date.now();
    if (now - lastAutoRefreshRef.current < AUTO_REFRESH_MIN_INTERVAL_MS) return;
    lastAutoRefreshRef.current = now;
    void refreshPrices();
  }, [refreshPrices]);

  // Giris: DB'deki sepet + bu cihazdaki (misafir) sepet birlestirilir.
  const initialSync = useCallback(async () => {
    let server: { lines: ResolvedCartLine[]; couponCode: string | null };
    try {
      const res = await fetch("/api/sepet", { cache: "no-store" });
      if (!res.ok) throw new Error("sepet okunamadi");
      server = await res.json();
    } catch {
      // Okunamazsa DB'ye HICBIR SEY yazmadan yerel sepetle devam et; odaklanınca tekrar denenir.
      syncStartedRef.current = false;
      return;
    }

    let finalLines: CartLine[];
    let finalCoupon: string | null;
    let issues: Record<string, CartLineIssue> = {};
    let notices: PriceNotice[] = [];

    if (clearedBeforeSyncRef.current) {
      clearedBeforeSyncRef.current = false;
      finalLines = [];
      finalCoupon = null;
    } else {
      const local = { lines: linesRef.current, couponCode: couponRef.current };
      const byVariant = new Map<string, CartLine>();
      for (const f of server.lines) byVariant.set(f.variantId, toCartLine(f));
      for (const l of local.lines) {
        const existing = byVariant.get(l.variantId);
        byVariant.set(l.variantId, existing ? { ...existing, quantity: existing.quantity + l.quantity } : l);
      }
      finalLines = [...byVariant.values()];
      finalCoupon = local.couponCode ?? server.couponCode;

      // Yerel satir varsa: guncel fiyat/stok al, birlesen adet stogu asmasin.
      // Yoksa sunucudan gelen satirlar zaten guncel.
      const fresh = local.lines.length > 0 ? await fetchFresh(finalLines) : server.lines;
      if (fresh) {
        const stockByVariant = new Map(fresh.map((f) => [f.variantId, f.stock]));
        finalLines = finalLines.map((l) => {
          const stock = stockByVariant.get(l.variantId) ?? 0;
          return stock > 0 ? { ...l, quantity: Math.min(l.quantity, stock) } : l;
        });
        const applied = applyFresh(finalLines, fresh);
        finalLines = applied.lines;
        issues = applied.issues;
        notices = applied.notices;
      }
    }

    // Birlesen sonuc DB'ye yazilir; ancak basarili olursa yerel kopya silinir.
    const hadLocal = linesRef.current.length > 0 || couponRef.current !== null;
    if (hadLocal || finalLines.length !== server.lines.length) {
      const ok = await putServerCart(finalLines, finalCoupon);
      if (!ok) {
        syncStartedRef.current = false;
        return;
      }
    }
    clearLocalCart();

    lastSyncedKeyRef.current = syncKeyOf(finalLines, finalCoupon);
    dirtyRef.current = false;
    setLines(finalLines);
    setCouponCodeState(finalCoupon);
    setLineIssues(issues);
    setPriceNotices(notices);
    setServerReady(true);
  }, []);

  // Baska cihazda yapilan degisiklikleri getirir (yerel bekleyen degisiklik yoksa).
  const pullServerCart = useCallback(async () => {
    const version = versionRef.current;
    try {
      const res = await fetch("/api/sepet", { cache: "no-store" });
      if (!res.ok) return;
      const data: { lines: ResolvedCartLine[]; couponCode: string | null } = await res.json();
      if (version !== versionRef.current || dirtyRef.current) return;

      lastSyncedKeyRef.current = syncKeyOf(data.lines, data.couponCode);
      // Eski yerel satir verisi korunur ki fiyat degisimi bildirimi uretilebilsin.
      const localByVariant = new Map(linesRef.current.map((l) => [l.variantId, l]));
      const base = data.lines.map((f) => {
        const local = localByVariant.get(f.variantId);
        return local ? { ...local, quantity: f.quantity } : toCartLine(f);
      });
      const applied = applyFresh(base, data.lines);

      if (JSON.stringify(applied.lines) !== JSON.stringify(linesRef.current)) setLines(applied.lines);
      if (data.couponCode !== couponRef.current) setCouponCodeState(data.couponCode);
      setLineIssues((prev) => (JSON.stringify(prev) === JSON.stringify(applied.issues) ? prev : applied.issues));
      if (applied.notices.length > 0) {
        setPriceNotices((prev) => [
          ...prev.filter((n) => !applied.notices.some((r) => r.variantId === n.variantId)),
          ...applied.notices
        ]);
      }
    } catch {
      // ag hatasi: mevcut sepetle devam
    }
  }, []);

  // Giris/cikis gecisleri.
  useEffect(() => {
    if (status === "unauthenticated") {
      syncStartedRef.current = false;
      clearedBeforeSyncRef.current = false;
      if (wasAuthenticatedRef.current) {
        // Cikis: ekrandaki sepet temizlenir (DB'deki sepete dokunulmaz).
        wasAuthenticatedRef.current = false;
        lastSyncedKeyRef.current = null;
        dirtyRef.current = false;
        setServerReady(false);
        setLines([]);
        setCouponCodeState(null);
        setLineIssues({});
        setPriceNotices([]);
      }
      return;
    }
    if (status !== "authenticated" || !hydrated || syncStartedRef.current) return;
    syncStartedRef.current = true;
    wasAuthenticatedRef.current = true;
    void initialSync();
  }, [status, hydrated, initialSync]);

  // Girisliyken degisiklikleri kisa gecikmeyle DB'ye yaz.
  const pushCart = useCallback(async (): Promise<boolean> => {
    const key = syncKeyOf(linesRef.current, couponRef.current);
    if (key === lastSyncedKeyRef.current) {
      dirtyRef.current = false;
      return true;
    }
    const ok = await putServerCart(linesRef.current, couponRef.current);
    if (!ok) return false;
    lastSyncedKeyRef.current = key;
    dirtyRef.current = syncKeyOf(linesRef.current, couponRef.current) !== key;
    return true;
  }, []);

  // Anahtar yalniz id + adet + kupon icerir: fiyat/isim tazelemesi anahtari
  // degistirmez, dolayisiyla PUT tetiklemez.
  const syncKey = useMemo(() => syncKeyOf(lines, couponCode), [lines, couponCode]);
  useEffect(() => {
    if (status !== "authenticated" || !serverReady) return;
    if (syncKey === lastSyncedKeyRef.current) return;
    dirtyRef.current = true;
    const timer = setTimeout(() => {
      void pushCart();
    }, SYNC_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [syncKey, status, serverReady, pushCart]);

  // Ilk yukleme (veya ilk senkronizasyon bitince) fiyat tazeleme.
  const readyToRefresh = hydrated && (status === "unauthenticated" || (status === "authenticated" && serverReady));
  useEffect(() => {
    if (readyToRefresh) autoRefresh();
  }, [readyToRefresh, autoRefresh]);

  // Sekmeye/pencereye donuldugunde: bekleyen yerel degisikligi yaz, DB'den
  // guncel sepeti al, fiyatlari tazele.
  useEffect(() => {
    // focus + visibilitychange ayni anda ates edebilir: ic ice calismasin.
    let busy = false;
    const onReturn = async () => {
      if (busy || document.visibilityState === "hidden") return;
      busy = true;
      try {
        if (statusRef.current === "authenticated") {
          if (!serverReadyRef.current) {
            if (!syncStartedRef.current) {
              syncStartedRef.current = true;
              await initialSync();
            }
            return;
          }
          if (dirtyRef.current) await pushCart();
          await pullServerCart();
        }
        autoRefresh();
      } finally {
        busy = false;
      }
    };
    window.addEventListener("focus", onReturn);
    document.addEventListener("visibilitychange", onReturn);
    return () => {
      window.removeEventListener("focus", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, [initialSync, pushCart, pullServerCart, autoRefresh]);

  useEffect(() => {
    if (isDrawerOpen) autoRefresh();
  }, [isDrawerOpen, autoRefresh]);

  useEffect(() => {
    if (pathname === "/sepet" || pathname === "/odeme") autoRefresh();
  }, [pathname, autoRefresh]);

  const addLine = (line: CartLine) => {
    versionRef.current++;
    setLines((prev) => {
      const existing = prev.find((l) => l.variantId === line.variantId);
      if (existing) {
        const stock = line.stock ?? existing.stock;
        const max = stock !== undefined ? Math.min(stock, MAX_LINE_QUANTITY) : MAX_LINE_QUANTITY;
        return prev.map((l) =>
          l.variantId === line.variantId
            ? { ...l, stock, quantity: Math.min(l.quantity + line.quantity, max) }
            : l
        );
      }
      return [...prev, { ...line, quantity: Math.min(line.quantity, line.stock ?? MAX_LINE_QUANTITY) }];
    });
  };

  const removeLine = (variantId: string) => {
    versionRef.current++;
    setLines((prev) => prev.filter((l) => l.variantId !== variantId));
    setPriceNotices((prev) => prev.filter((n) => n.variantId !== variantId));
    setLineIssues((prev) => {
      if (!(variantId in prev)) return prev;
      const rest = { ...prev };
      delete rest[variantId];
      return rest;
    });
  };

  const updateQuantity = (variantId: string, quantity: number) => {
    versionRef.current++;
    setLines((prev) =>
      prev.map((l) => {
        if (l.variantId !== variantId) return l;
        const max = l.stock !== undefined ? Math.min(l.stock, MAX_LINE_QUANTITY) : MAX_LINE_QUANTITY;
        return { ...l, quantity: Math.max(1, Math.min(quantity, max)) };
      })
    );
  };

  const setCouponCode = (code: string | null) => {
    versionRef.current++;
    setCouponCodeState(code);
  };

  const clear = () => {
    versionRef.current++;
    if (statusRef.current !== "unauthenticated" && !serverReadyRef.current) {
      clearedBeforeSyncRef.current = true;
    }
    setLines([]);
    setCouponCodeState(null);
    setLineIssues({});
    setPriceNotices([]);
  };

  const dismissPriceNotice = (variantId?: string) => {
    setPriceNotices((prev) => (variantId ? prev.filter((n) => n.variantId !== variantId) : []));
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

  const hasBlockingIssues = lines.some((l) => l.variantId in lineIssues);

  return (
    <CartContext.Provider
      value={{
        lines,
        addLine,
        removeLine,
        updateQuantity,
        clear,
        totalCents,
        totalCount,
        couponCode,
        setCouponCode,
        isDrawerOpen,
        openDrawer,
        closeDrawer,
        priceNotices,
        dismissPriceNotice,
        lineIssues,
        hasBlockingIssues,
        refreshPrices
      }}
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
