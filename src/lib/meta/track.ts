import { hasConsent } from "@/lib/consent";
import { CATALOG_SHOW_PARAM } from "@/lib/catalog-filters";

// Tarayici takip olaylarinin TEK merkezi: Meta Pixel (bkz. META_PIXEL_CAPI_PLANI.md)
// ve GA4 (bkz. GA4_KURULUM_PLANI.md) - sayfalara dagitik fbq/gtag cagrisi konmaz.
// Meta olayi olan her noktada GA4 olayi da ayni fonksiyondan gider.
// window.fbq yalniz Pixel etkinse (production ya da test kodu) ve pazarlama
// rizasi verildiyse vardir (bkz. components/meta-pixel.tsx); window.gtag yalniz
// GA4 etkinse (production ya da NEXT_PUBLIC_GA4_DEBUG) ve analitik rizasi
// verildiyse (bkz. components/google-analytics.tsx). Rıza sonradan geri
// cekilirse hasConsent kontrolu yeni olayi durdurur.
//
// content_ids / item_id kurali: varyant SKU'su (Google feed'deki g:id ile ayni). SKU'su
// henuz bilinmeyen eski sepet satirlarinda variantId'ye dusulur.

export type MetaContent = { id: string; quantity: number; item_price: number };

export type Ga4Item = {
  item_id: string;
  item_name: string;
  item_brand?: string;
  item_category?: string;
  item_variant?: string;
  price: number;
  quantity: number;
  index?: number;
  item_list_name?: string;
};

// Tesekkurler sayfasinda sunucuda siparisten uretilir (bkz. lib/ga4.ts ga4PurchaseData).
export type Ga4Purchase = { value: number; tax: number; shipping: number; coupon?: string; items: Ga4Item[] };

type CartLineLike = {
  variantId: string;
  sku?: string;
  quantity: number;
  priceCents: number;
  name?: string;
  brand?: string;
  category?: string;
  color?: string;
  size?: string;
};

const CURRENCY = "TRY";

// Ilk yuklemede sayfa bilesenlerinin efektleri (orn. ViewContent) Pixel/gtag
// kurulmadan once calisir: rıza varsa olay kuyrukta bekler, yukleyici
// kurulunca flush ile gonderilir. Takip kapaliysa (localhost) kuyruk hic
// bosalmaz - ust sinir bellegi korur.
const MAX_PENDING = 20;
const pending: (() => void)[] = [];
const ga4Pending: (() => void)[] = [];

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

function whenGa4Ready(send: () => void) {
  if (typeof window === "undefined" || !hasConsent("analytics")) return;
  if (typeof window.gtag === "function") send();
  else if (ga4Pending.length < MAX_PENDING) ga4Pending.push(send);
}

export function flushPendingGa4Events() {
  for (const send of ga4Pending.splice(0)) {
    if (hasConsent("analytics")) send();
  }
}

function fire(event: string, params: Record<string, unknown>, eventId?: string) {
  whenPixelReady(() => window.fbq!("track", event, params, eventId ? { eventID: eventId } : undefined));
}

function ga4(event: string, params: Record<string, unknown>) {
  whenGa4Ready(() => window.gtag!("event", event, params));
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
    value: cartValue(lines),
    content_type: "product",
    content_ids: contents.map((c) => c.id),
    contents,
    num_items: contents.reduce((sum, c) => sum + c.quantity, 0)
  };
}

function cartValue(lines: CartLineLike[]) {
  return lines.reduce((sum, l) => sum + l.priceCents * l.quantity, 0) / 100;
}

// "Renk / Beden" - bos olanlar atlanir.
function variantLabel(color?: string | null, size?: string | null) {
  return [color, size].filter(Boolean).join(" / ") || undefined;
}

function ga4ItemsOf(lines: CartLineLike[]): Ga4Item[] {
  return lines.map((l) => ({
    item_id: l.sku || l.variantId,
    item_name: l.name ?? "",
    item_brand: l.brand || undefined,
    item_category: l.category || undefined,
    item_variant: variantLabel(l.color, l.size),
    price: l.priceCents / 100,
    quantity: l.quantity
  }));
}

function ga4CartData(lines: CartLineLike[], valueCents?: number) {
  return {
    currency: CURRENCY,
    value: valueCents === undefined ? cartValue(lines) : valueCents / 100,
    items: ga4ItemsOf(lines)
  };
}

export function trackPageView() {
  fire("PageView", {});
}

// Katalogdaki "Daha Fazla Goster" (?goster=) yeni sayfa sayilmaz.
export function ga4PageKey(pathname: string, searchParams: URLSearchParams) {
  const params = new URLSearchParams(searchParams);
  params.delete(CATALOG_SHOW_PARAM);
  return `${pathname}?${params.toString()}`;
}

// Istemci taraflı geciste yeni sayfanin <title>'i efektten sonra (metadata akisi)
// yazilabiliyor - bos baslikla gitmesin diye en fazla 1 sn beklenir.
export function trackGa4PageView() {
  const url = location.href;
  const send = () => ga4("page_view", { page_location: url, page_title: document.title });
  if (document.title) return send();
  let sent = false;
  const done = () => {
    if (sent) return;
    sent = true;
    observer.disconnect();
    clearTimeout(timer);
    send();
  };
  const observer = new MutationObserver(() => {
    if (document.title) done();
  });
  observer.observe(document.head, { childList: true, subtree: true, characterData: true });
  const timer = setTimeout(done, 1000);
}

// Urun bazli liste kalemleri (katalog karti = urun/renk, varyant degil):
// item_id = Product.id, AddToWishlist kurali ile ayni.
export type ListItem = {
  productId: string;
  name: string;
  priceCents: number;
  brand?: string | null;
  category?: string | null;
  color?: string | null;
};

function listItem(item: ListItem, listName: string, index: number): Ga4Item {
  return {
    item_id: item.productId,
    item_name: item.name,
    item_brand: item.brand || undefined,
    item_category: item.category || undefined,
    item_variant: item.color || undefined,
    price: item.priceCents / 100,
    quantity: 1,
    index,
    item_list_name: listName
  };
}

export function trackViewItemList(listName: string, items: ListItem[]) {
  if (items.length === 0) return;
  ga4("view_item_list", { item_list_name: listName, items: items.map((item, i) => listItem(item, listName, i)) });
}

export function trackSelectItem(listName: string, item: ListItem, index: number) {
  ga4("select_item", { item_list_name: listName, items: [listItem(item, listName, index)] });
}

// Varyant secilmeden once: Meta'da content_ids, GA4'te kalemler urunun tum varyant SKU'lari.
export function trackViewContent(product: {
  name: string;
  priceCents: number;
  brand?: string | null;
  category?: string | null;
  variants: { sku: string; color: string; size: string; priceCents: number }[];
}) {
  fire("ViewContent", {
    currency: CURRENCY,
    value: product.priceCents / 100,
    content_name: product.name,
    content_type: "product",
    content_ids: product.variants.map((v) => v.sku)
  });
  ga4("view_item", {
    currency: CURRENCY,
    value: product.priceCents / 100,
    items: product.variants.map((v) => ({
      item_id: v.sku,
      item_name: product.name,
      item_brand: product.brand || undefined,
      item_category: product.category || undefined,
      item_variant: variantLabel(v.color, v.size),
      price: v.priceCents / 100,
      quantity: 1
    }))
  });
}

export function trackAddToCart(line: CartLineLike & { name: string }) {
  const eventId = crypto.randomUUID();
  const data = { ...cartData([line]), content_name: line.name };
  fire("AddToCart", data, eventId);
  forwardToServer("AddToCart", eventId, data);
  ga4("add_to_cart", ga4CartData([line]));
}

export function trackRemoveFromCart(line: CartLineLike) {
  ga4("remove_from_cart", ga4CartData([line]));
}

export function trackViewCart(lines: CartLineLike[]) {
  ga4("view_cart", ga4CartData(lines));
}

// Favoriler urun bazli (varyant yok): Meta content_ids = feed'deki item_group_id
// (bkz. lib/item-group-id.ts); GA4 item_id = Product.id (liste olaylariyla ayni).
export function trackAddToWishlist(productId: string, itemGroupId: string, item?: Omit<ListItem, "productId">) {
  fire("AddToWishlist", { content_type: "product_group", content_ids: [itemGroupId] });
  ga4("add_to_wishlist", {
    currency: CURRENCY,
    value: item ? item.priceCents / 100 : 0,
    items: [
      {
        item_id: productId,
        item_name: item?.name ?? "",
        item_brand: item?.brand || undefined,
        item_category: item?.category || undefined,
        item_variant: item?.color || undefined,
        price: item ? item.priceCents / 100 : 0,
        quantity: 1
      }
    ]
  });
}

export function trackSearch(query: string) {
  fire("Search", { search_string: query });
  ga4("search", { search_term: query });
}

// WhatsApp ve Instagram DM tiklamalari. Yalniz tarayici olayi; CAPI kopyasi yok.
export function trackContact(method: "whatsapp" | "instagram", productCode?: string) {
  const params = { method, ...(productCode && { product_code: productCode }) };
  fire("Contact", params);
  ga4("contact", params);
}

export function trackInitiateCheckout(lines: CartLineLike[]) {
  const eventId = crypto.randomUUID();
  const data = cartData(lines);
  fire("InitiateCheckout", data, eventId);
  forwardToServer("InitiateCheckout", eventId, data);
  ga4("begin_checkout", ga4CartData(lines));
}

// Odeme formunda siparis (teslimat adresi) olusturulunca.
export function trackAddShippingInfo(lines: CartLineLike[], valueCents: number, coupon: string | null) {
  ga4("add_shipping_info", { ...ga4CartData(lines, valueCents), coupon: coupon ?? undefined });
}

// iyzico odeme formuna (kart bilgisi adimi) yonlendirmeden hemen once.
export function trackAddPaymentInfo(lines: CartLineLike[], valueCents: number, coupon: string | null) {
  fire("AddPaymentInfo", { ...cartData(lines), value: valueCents / 100 });
  ga4("add_payment_info", { ...ga4CartData(lines, valueCents), coupon: coupon ?? undefined, payment_type: "iyzico" });
}

// Meta: event_id sunucudaki ile ayni (purchase_<siparisNo>, bkz. lib/meta/capi.ts);
// sayfa yenilenince ayni sekmede tekrar gonderilmez. GA4: localStorage ile ayni
// tarayicida siparis basina bir kez (yenileme / sonradan tekrar acma dahil).
export function trackPurchase(orderNumber: string, metaData: Record<string, unknown> | null, ga4Data: Ga4Purchase | null) {
  if (metaData) {
    whenPixelReady(() => {
      const key = `bm-meta-purchase-${orderNumber}`;
      try {
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, "1");
      } catch {
        // sessionStorage yoksa Meta yine event_id ile tekillestirir
      }
      window.fbq!("track", "Purchase", metaData, { eventID: `purchase_${orderNumber}` });
    });
  }
  if (ga4Data) {
    whenGa4Ready(() => {
      const key = `bm-ga4-purchase-${orderNumber}`;
      try {
        if (localStorage.getItem(key)) return;
        localStorage.setItem(key, "1");
      } catch {
        // localStorage yoksa GA4 yine transaction_id ile tekillestirir
      }
      window.gtag!("event", "purchase", { transaction_id: orderNumber, currency: CURRENCY, ...ga4Data });
    });
  }
}

export function trackCompleteRegistration(eventId: string) {
  fire("CompleteRegistration", { status: true }, eventId);
  ga4("sign_up", { method: "email" });
}
