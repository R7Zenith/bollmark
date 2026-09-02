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
