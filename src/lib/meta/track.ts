import { hasConsent } from "@/lib/consent";

// Meta Pixel olaylarinin TEK merkezi (bkz. META_PIXEL_CAPI_PLANI.md) - sayfalara
// dagitik fbq cagrisi konmaz. window.fbq yalniz Pixel etkinse (production ya da
// test kodu) ve pazarlama rizasi verildiyse vardir (bkz. components/meta-pixel.tsx);
// rıza sonradan geri cekilirse hasConsent kontrolu yeni olayi durdurur.
//
// content_ids kurali: varyant SKU'su (Google feed'deki g:id ile ayni). SKU'su
// henuz bilinmeyen eski sepet satirlarinda variantId'ye dusulur.

export type MetaContent = { id: string; quantity: number; item_price: number };

type CartLineLike = { variantId: string; sku?: string; quantity: number; priceCents: number };

const CURRENCY = "TRY";

// Ilk yuklemede sayfa bilesenlerinin efektleri (orn. ViewContent) Pixel
// kurulmadan once calisir: rıza varsa olay kuyrukta bekler, MetaPixel
// kurulunca flushPendingMetaEvents ile gonderilir. Pixel kapaliysa
// (localhost) kuyruk hic bosalmaz - ust sinir bellegi korur.
const pending: (() => void)[] = [];
const MAX_PENDING = 20;

function whenPixelReady(send: () => void) {
  if (typeof window === "undefined" || !hasConsent("marketing")) return;
  if (typeof window.fbq === "function") send();
  else if (pending.length < MAX_PENDING) pending.push(send);
}

export function flushPendingMetaEvents() {
  for (const send of pending.splice(0)) {
    if (hasConsent("marketing")) send();
  }
}

function fire(event: string, params: Record<string, unknown>, eventId?: string) {
  whenPixelReady(() => window.fbq!("track", event, params, eventId ? { eventID: eventId } : undefined));
}

// Sunucu (CAPI) kopyasi yalniz AddToCart / InitiateCheckout icin bu hafif uc
// noktaya gider; Pixel kapaliysa (localhost, rıza yok) istek hic atilmaz.
function forwardToServer(event: "AddToCart" | "InitiateCheckout", eventId: string, customData: Record<string, unknown>) {
  whenPixelReady(() => sendToServer(event, eventId, customData));
}

function sendToServer(event: string, eventId: string, customData: Record<string, unknown>) {
  fetch("/api/meta/olay", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, eventId, customData }),
    keepalive: true
  }).catch(() => {});
}

function contentsOf(lines: CartLineLike[]): MetaContent[] {
  return lines.map((l) => ({ id: l.sku || l.variantId, quantity: l.quantity, item_price: l.priceCents / 100 }));
}

function cartData(lines: CartLineLike[]) {
  const contents = contentsOf(lines);
  return {
    currency: CURRENCY,
    value: lines.reduce((sum, l) => sum + l.priceCents * l.quantity, 0) / 100,
    content_type: "product",
    content_ids: contents.map((c) => c.id),
    contents,
    num_items: contents.reduce((sum, c) => sum + c.quantity, 0)
  };
}

export function trackPageView() {
  fire("PageView", {});
}

export function trackViewContent(product: { name: string; skus: string[]; priceCents: number }) {
  fire("ViewContent", {
    currency: CURRENCY,
    value: product.priceCents / 100,
    content_name: product.name,
    content_type: "product",
    content_ids: product.skus
  });
}

export function trackAddToCart(line: CartLineLike & { name: string }) {
  const eventId = crypto.randomUUID();
  const data = { ...cartData([line]), content_name: line.name };
  fire("AddToCart", data, eventId);
  forwardToServer("AddToCart", eventId, data);
}

// Favoriler urun bazli (varyant yok): content_ids = Product.id (katalogda item_group_id).
export function trackAddToWishlist(productId: string) {
  fire("AddToWishlist", { content_type: "product_group", content_ids: [productId] });
}

export function trackSearch(query: string) {
  fire("Search", { search_string: query });
}

export function trackInitiateCheckout(lines: CartLineLike[]) {
  const eventId = crypto.randomUUID();
  const data = cartData(lines);
  fire("InitiateCheckout", data, eventId);
  forwardToServer("InitiateCheckout", eventId, data);
}

// iyzico odeme formuna (kart bilgisi adimi) yonlendirmeden hemen once.
export function trackAddPaymentInfo(lines: CartLineLike[], valueCents: number) {
  fire("AddPaymentInfo", { ...cartData(lines), value: valueCents / 100 });
}

// event_id sunucudaki ile ayni (purchase_<siparisNo>, bkz. lib/meta/capi.ts).
// Sayfa yenilenince ayni sekmede tekrar gonderilmez.
export function trackPurchase(orderNumber: string, customData: Record<string, unknown>) {
  whenPixelReady(() => {
    const key = `bm-meta-purchase-${orderNumber}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // sessionStorage yoksa Meta yine event_id ile tekillestirir
    }
    window.fbq!("track", "Purchase", customData, { eventID: `purchase_${orderNumber}` });
  });
}

export function trackCompleteRegistration(eventId: string) {
  fire("CompleteRegistration", { status: true }, eventId);
}
