import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

type Tx = PrismaClient | Prisma.TransactionClient;

export interface BundleLine {
  productId: string;
  priceCents: number;
  quantity: number;
}

// v1 kurali: bir bundle'in TUM urunlerinden en az 1'er adet sepette olmali
// (kismi eslesme indirim tetiklemez). Birden fazla bundle eslesirse en
// yuksek indirimli olan TEK bir tanesi uygulanir (ust uste binmesin).
// Indirim, kupon/puan ile ayni gerekce ile HER ZAMAN burada sunucuda
// (istemciden gelen degere guvenmeden) hesaplanir.
export async function resolveBundleDiscount(
  tx: Tx,
  lines: BundleLine[]
): Promise<{ discountCents: number }> {
  const bundles = await tx.bundle.findMany({
    where: { isActive: true },
    include: { products: { select: { id: true } } }
  });

  const cartProductIds = new Set(lines.map((l) => l.productId));
  let bestDiscountCents = 0;
  let bestPercent = -1;

  for (const bundle of bundles) {
    if (bundle.products.length === 0) continue;
    const allPresent = bundle.products.every((p) => cartProductIds.has(p.id));
    if (!allPresent) continue;

    const bundleProductIds = new Set(bundle.products.map((p) => p.id));
    const matchingTotalCents = lines
      .filter((l) => bundleProductIds.has(l.productId))
      .reduce((sum, l) => sum + l.priceCents * l.quantity, 0);
    const discountCents = Math.round((matchingTotalCents * bundle.discountPercent) / 100);

    if (bundle.discountPercent > bestPercent) {
      bestPercent = bundle.discountPercent;
      bestDiscountCents = discountCents;
    }
  }

  return { discountCents: bestDiscountCents };
}

// Anasayfa "Kombini Tamamla" fotografindaki "+" noktalari - x/y fotografin
// yuzdesi. Bundle.hotspotsJson'dan okunur; bozuk kayit, bundle'da olmayan urun
// ve ayni urune ikinci nokta atilir, koordinatlar 0-100'e sikistirilir.
export type BundleHotspot = { productId: string; x: number; y: number };

export function parseHotspots(raw: string, productIds: string[]): BundleHotspot[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const allowed = new Set(productIds);
  const seen = new Set<string>();
  const clamp = (n: number) => Math.round(Math.min(100, Math.max(0, n)) * 10) / 10;
  const hotspots: BundleHotspot[] = [];
  for (const h of parsed) {
    if (!h || typeof h !== "object") continue;
    const { productId, x, y } = h as Record<string, unknown>;
    if (typeof productId !== "string" || !allowed.has(productId) || seen.has(productId)) continue;
    if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) continue;
    seen.add(productId);
    hotspots.push({ productId, x: clamp(x), y: clamp(y) });
  }
  return hotspots;
}

// Kombin urunlerinin admin'de belirlenen sirasi (Bundle.productOrderJson).
// Kayitli sirada olup bundle'da artik olmayan urun atilir; sirada olmayan
// (sonradan eklenen) urunler productIds'teki siralariyla sona eklenir.
export function parseProductOrder(raw: string, productIds: string[]): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = [];
  }
  const allowed = new Set(productIds);
  const ordered = Array.isArray(parsed)
    ? [...new Set(parsed.filter((id): id is string => typeof id === "string" && allowed.has(id)))]
    : [];
  return [...ordered, ...productIds.filter((id) => !ordered.includes(id))];
}

// Urun sayfasindaki bilgilendirici rozet icin - urunun dahil oldugu aktif
// bir bundle varsa diger urun adlarini ve indirim yuzdesini dondurur.
export async function getBundleForProduct(productId: string) {
  const bundle = await prisma.bundle.findFirst({
    where: { isActive: true, products: { some: { id: productId } } },
    include: { products: { select: { id: true, name: true } } }
  });
  if (!bundle) return null;

  return {
    discountPercent: bundle.discountPercent,
    otherProductNames: bundle.products.filter((p) => p.id !== productId).map((p) => p.name)
  };
}
