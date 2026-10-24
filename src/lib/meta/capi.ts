import "server-only";
import { createHash } from "node:crypto";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site-url";
import { CONSENT_COOKIE_NAME, parseConsent } from "@/lib/consent";

// Meta Conversions API - sunucu tarafi tek merkez (bkz. META_PIXEL_CAPI_PLANI.md).
// Yalniz Purchase, InitiateCheckout, AddToCart, CompleteRegistration buradan
// gider; digerleri yalniz tarayicidaki Pixel ile. Gonderim after() ile yaniti
// bekletmez, 3 sn zaman asimi var ve hata akisi ASLA bozmaz (kisa log).
// Tarayici ve sunucu ayni event_id'yi kullanir (Meta tekillestirir).

// Meta'nin guncel Graph API surumu (v26.0, 29 Temmuz 2026).
export const META_GRAPH_API_VERSION = "v26.0";
const REQUEST_TIMEOUT_MS = 3000;

// Neon prod ve yerel ayni DB'yi paylasiyor: production disi ortamlar "test"
// sayilir ve yalniz META_TEST_EVENT_CODE tanimliysa calisir.
export function isMetaTestMode(): boolean {
  return process.env.VERCEL_ENV !== "production";
}

export function metaTrackingEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_META_PIXEL_ID) && (!isMetaTestMode() || Boolean(process.env.META_TEST_EVENT_CODE));
}

function capiEnabled(): boolean {
  return metaTrackingEnabled() && Boolean(process.env.META_CAPI_ACCESS_TOKEN);
}

type CookieReader = { get(name: string): { value: string } | undefined };
type HeaderReader = { get(name: string): string | null };

export function hasMarketingConsent(cookies: CookieReader): boolean {
  return parseConsent(cookies.get(CONSENT_COOKIE_NAME)?.value ?? "")?.marketing === true;
}

// --- user_data normalizasyonu (Meta kurallari) + SHA-256 ---
function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function hashed(value: string | null | undefined): string[] | undefined {
  return value ? [sha256(value)] : undefined;
}

function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() || null;
}

// Turkiye: yalniz rakam, 90 ile baslar (05xx..., 5xx..., +90 5xx... hepsi 905xx...).
export function normalizePhone(phone: string | null | undefined): string | null {
  let digits = (phone ?? "").replace(/\D/g, "");
  if (digits.startsWith("0090")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = `9${digits}`;
  else if (digits.length === 10) digits = `90${digits}`;
  return digits.length >= 11 ? digits : null;
}

function normalizeName(name: string | null | undefined) {
  return name?.toLocaleLowerCase("tr-TR").replace(/[^\p{L}]/gu, "") || null;
}

// Sehir: kucuk harf, bosluk/noktalama yok, a-z (Meta "ozel karakter yok" diyor).
function normalizeCity(city: string | null | undefined) {
  return (
    city
      ?.toLocaleLowerCase("tr-TR")
      .replace(/ı/g, "i")
      .normalize("NFD")
      .replace(/[^a-z]/g, "") || null
  );
}

function normalizeZip(zip: string | null | undefined) {
  return zip?.toLowerCase().replace(/\s/g, "") || null;
}

export function splitFullName(fullName: string): { first: string | null; last: string | null } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: null, last: null };
  return { first: parts[0], last: parts.length > 1 ? parts.slice(1).join(" ") : null };
}

export type MetaUserInput = {
  email?: string | null;
  phone?: string | null;
  fullName?: string | null;
  city?: string | null;
  zip?: string | null;
  externalId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  fbp?: string | null;
  fbc?: string | null;
};

function buildUserData(input: MetaUserInput) {
  const { first, last } = splitFullName(input.fullName ?? "");
  const data: Record<string, unknown> = {
    em: hashed(normalizeEmail(input.email)),
    ph: hashed(normalizePhone(input.phone)),
    fn: hashed(normalizeName(first)),
    ln: hashed(normalizeName(last)),
    ct: hashed(normalizeCity(input.city)),
    zp: hashed(normalizeZip(input.zip)),
    country: hashed("tr"),
    external_id: hashed(input.externalId),
    client_ip_address: input.ip || undefined,
    client_user_agent: input.userAgent || undefined,
    fbp: input.fbp || undefined,
    fbc: input.fbc || undefined
  };
  return Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
}

// Istek basligindan IP; yerel/bos IP Meta'ya gonderilmez. Hicbir yerde saklanmaz.
export function requestIp(headers: HeaderReader): string | null {
  const ip = headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip")?.trim() || "";
  return ip && ip !== "127.0.0.1" && ip !== "::1" ? ip : null;
}

export type MetaContent = { id: string; quantity: number; item_price: number };

export type MetaServerEvent = {
  eventName: "Purchase" | "InitiateCheckout" | "AddToCart" | "CompleteRegistration";
  eventId: string;
  sourceUrl: string;
  user: MetaUserInput;
  customData?: Record<string, unknown>;
};

async function postEvent(event: MetaServerEvent) {
  const body: Record<string, unknown> = {
    data: [
      {
        event_name: event.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: event.eventId,
        action_source: "website",
        event_source_url: event.sourceUrl,
        user_data: buildUserData(event.user),
        ...(event.customData ? { custom_data: event.customData } : {})
      }
    ],
    access_token: process.env.META_CAPI_ACCESS_TOKEN
  };
  const testCode = process.env.META_TEST_EVENT_CODE;
  if (testCode) body.test_event_code = testCode;

  try {
    const res = await fetch(
      `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${process.env.NEXT_PUBLIC_META_PIXEL_ID}/events`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      }
    );
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      console.error(`Meta CAPI ${event.eventName} reddedildi (${res.status}):`, data?.error?.message ?? "");
    }
  } catch (error) {
    console.error(`Meta CAPI ${event.eventName} gönderilemedi:`, error instanceof Error ? error.name : "bilinmeyen hata");
  }
}

// Yaniti bekletmeden gonderir. Rıza kontrolu cagiran taraftadir.
export function sendMetaEvent(event: MetaServerEvent) {
  if (!capiEnabled()) return;
  after(() => postEvent(event));
}

// --- Purchase ---
// Siparis olusurken cagrilir: pazarlama rizasi varsa Purchase icin gereken
// tarayici baglami siparisle saklanir (odeme onayi webhook/cron gibi baska bir
// istekte gelebilir). Rıza yoksa veya takip kapaliysa null -> Purchase gitmez.
export function buildOrderMetaContext(cookies: CookieReader, headers: HeaderReader): string | null {
  if (!metaTrackingEnabled() || !hasMarketingConsent(cookies)) return null;
  return JSON.stringify({
    fbp: cookies.get("_fbp")?.value ?? null,
    fbc: cookies.get("_fbc")?.value ?? null,
    ua: headers.get("user-agent")?.slice(0, 500) ?? null,
    test: isMetaTestMode()
  });
}

export function purchaseEventId(orderNumber: string) {
  return `purchase_${orderNumber}`;
}

// Odeme dogrulaninca (reconcile.ts afterPaid) cagrilir. metaPurchaseSentAt
// kosullu guncellemesi Purchase'in siparis basina yalniz BIR kez gitmesini
// saglar (callback + webhook cakissa bile). Hata firlatmaz.
export async function sendPurchaseToMeta(orderId: string) {
  if (!capiEnabled()) return;
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { variant: { select: { sku: true } } } } }
    });
    if (!order?.metaCapiContext || order.metaPurchaseSentAt) return;
    const context = JSON.parse(order.metaCapiContext) as { fbp: string | null; fbc: string | null; ua: string | null; test: boolean };
    // Test ortaminda olusan siparisin Purchase'i yalniz test ortamindan,
    // production siparisi yalniz production'dan gider (ortak DB).
    if (context.test !== isMetaTestMode()) return;

    const claimed = await prisma.order.updateMany({
      where: { id: orderId, metaPurchaseSentAt: null },
      data: { metaPurchaseSentAt: new Date() }
    });
    if (claimed.count !== 1) return;

    sendMetaEvent({
      eventName: "Purchase",
      eventId: purchaseEventId(order.orderNumber),
      sourceUrl: `${getSiteUrl()}/odeme/tesekkurler?siparis=${encodeURIComponent(order.orderNumber)}`,
      user: {
        email: order.customerEmail,
        phone: order.customerPhone,
        fullName: order.customerName,
        city: order.city,
        zip: order.postalCode,
        externalId: order.customerId,
        userAgent: context.ua,
        fbp: context.fbp,
        fbc: context.fbc
      },
      customData: purchaseCustomData(order)
    });
  } catch (error) {
    console.error("Meta Purchase hazırlanamadı:", error instanceof Error ? error.message : error);
  }
}

// Tarayici (tesekkurler sayfasi) ve sunucu ayni parametreleri kullanir.
export function purchaseCustomData(order: {
  totalCents: number;
  items: { variantId: string | null; quantity: number; unitPriceCents: number; variant: { sku: string } | null }[];
}) {
  const contents: MetaContent[] = order.items.map((item) => ({
    id: item.variant?.sku ?? item.variantId ?? "",
    quantity: item.quantity,
    item_price: item.unitPriceCents / 100
  }));
  return {
    currency: "TRY",
    value: order.totalCents / 100,
    content_type: "product",
    content_ids: contents.map((c) => c.id),
    contents,
    num_items: contents.reduce((sum, c) => sum + c.quantity, 0)
  };
}
