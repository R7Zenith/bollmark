import type { Prisma, PrismaClient } from "@/generated/prisma/client";

type Tx = PrismaClient | Prisma.TransactionClient;

export class CouponInvalidError extends Error {}

export interface CouponLine {
  productId: string;
  priceCents: number;
  quantity: number;
  categoryId: string | null;
  brandId: string | null;
}

export type CouponValidation =
  | { valid: true; couponId: string; discountCents: number; freeShipping: boolean }
  | { valid: false; message: string };

type CouponRecord = {
  id: string;
  code: string | null;
  name: string | null;
  type: string;
  value: number;
  minOrderCents: number;
  usageLimit: number | null;
  usedCount: number;
  startsAt: Date | null;
  expiresAt: Date | null;
  isActive: boolean;
  categoryId: string | null;
  brandId: string | null;
};

// Bir kampanyanin (kodlu ya da otomatik) genel gecerlilik sartlarini
// (aktiflik, tarih araligi, kullanim limiti, min. sepet tutari) kontrol eder.
// Hem validateCoupon (tek kod) hem de resolveBestDiscount (tum otomatik
// kampanyalar) tarafindan paylasilir - kod tekrarini onler.
function checkCouponEligibility(coupon: CouponRecord, subtotalCents: number): string | null {
  if (!coupon.isActive) return "Bu kupon artık aktif değil.";
  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) return "Bu kupon henüz başlamadı.";
  if (coupon.expiresAt && coupon.expiresAt < now) return "Bu kuponun süresi doldu.";
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) return "Bu kuponun kullanım limiti doldu.";
  if (subtotalCents < coupon.minOrderCents) {
    return `Bu kupon en az ${(coupon.minOrderCents / 100).toFixed(2)} TL'lik sepetlerde geçerli.`;
  }
  return null;
}

// Bir kampanyanin kategori/marka kisitlamasina uyan sepet satirlarini ve
// bunlarin uzerinden hesaplanan indirim tutarini dondurur (kisitlama yoksa
// tum sepet). FREE_SHIPPING'de deger kullanilmadigi icin discountCents 0'dir.
function computeCouponDiscount(
  coupon: Pick<CouponRecord, "type" | "value" | "categoryId" | "brandId">,
  lines: CouponLine[]
): { discountCents: number; freeShipping: boolean; matchingLines: CouponLine[] } {
  const hasRestriction = coupon.categoryId != null || coupon.brandId != null;
  const matchingLines = hasRestriction
    ? lines.filter(
        (l) =>
          (coupon.categoryId == null || l.categoryId === coupon.categoryId) &&
          (coupon.brandId == null || l.brandId === coupon.brandId)
      )
    : lines;

  if (coupon.type === "FREE_SHIPPING") {
    return {
      discountCents: 0,
      freeShipping: matchingLines.length > 0 && (!hasRestriction || matchingLines.length === lines.length),
      matchingLines
    };
  }

  const matchingCents = matchingLines.reduce((sum, l) => sum + l.priceCents * l.quantity, 0);
  const discountCents =
    coupon.type === "PERCENT" ? Math.round((matchingCents * coupon.value) / 100) : Math.min(coupon.value, matchingCents);

  return { discountCents, freeShipping: false, matchingLines };
}

// Kupon dogrulama mantigi hem onizleme endpoint'i (/api/kuponlar/dogrula,
// baglayici olmayan anlik geri bildirim icin) hem de nihai siparis olusturma
// (orders/route.ts, $transaction icinde) tarafindan kullanilir - indirim
// tutari ASLA istemciden gelen degerle degil, HER ZAMAN burada sunucuda
// yeniden hesaplanir. orders/route.ts tarafinda tx (Prisma.TransactionClient)
// gecirilir ki usedCount artisiyla ayni transaction icinde atomik calissin
// ve yaris durumunda (iki musterinin son kullanim hakkini ayni anda
// tuketmesi) limit asilmasin.
//
// Kupon bir kategori/marka ile kisitlanmissa (categoryId/brandId doluysa),
// min. sepet tutari kontrolu yine sepetin TAM ara toplami uzerinden yapilir,
// ama indirim tutari sadece kisitlamaya uyan satirlarin toplami uzerinden
// hesaplanir (bkz. resolveBundleDiscount, lib/bundles.ts - benzer satir
// bazli pattern).
export async function validateCoupon(tx: Tx, rawCode: string, lines: CouponLine[]): Promise<CouponValidation> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { valid: false, message: "Kod girilmedi." };

  const coupon = await tx.coupon.findUnique({ where: { code } });
  if (!coupon) return { valid: false, message: "Kupon kodu bulunamadı." };

  const subtotalCents = lines.reduce((sum, l) => sum + l.priceCents * l.quantity, 0);
  const eligibilityError = checkCouponEligibility(coupon, subtotalCents);
  if (eligibilityError) return { valid: false, message: eligibilityError };

  const { discountCents, freeShipping, matchingLines } = computeCouponDiscount(coupon, lines);
  const hasRestriction = coupon.categoryId != null || coupon.brandId != null;
  if (hasRestriction && matchingLines.length === 0) {
    return { valid: false, message: "Bu kupon sepetinizdeki ürünler için geçerli değil." };
  }

  return { valid: true, couponId: coupon.id, discountCents, freeShipping };
}

export type BestDiscountResult = {
  couponId: string | null;
  discountCents: number;
  freeShipping: boolean;
  appliedName: string | null;
  // Girilen kod gecersizse (kod bulunamadi, suresi doldu vb.) hata mesaji -
  // otomatik kampanya yine de sonuca yansir, sadece kullaniciya kodun neden
  // kazanmadigi ayrica bildirilir.
  codeMessage: string | null;
};

// Kodsuz (otomatik) kampanyalar ile elle girilen kupon kodu arasindan
// musteriye en avantajli olani secer - ikisi birden ASLA uygulanmaz.
//
// Otomatik kampanyalar satir bazinda degerlendirilir: her sepet satirina
// (ayni urune iki otomatik kampanya ust uste binmesin diye) en yuksek
// indirimi veren TEK otomatik kampanya atanir, sonra bu satir bazli
// indirimler toplanir. Girilen kod varsa onun toplam indirimiyle
// karsilastirilir, hangisi daha yuksekse o kazanir (esitlikte kupon kazanir
// - musteri bilerek kod girmis).
export async function resolveBestDiscount(
  tx: Tx,
  enteredCode: string | null,
  lines: CouponLine[]
): Promise<BestDiscountResult> {
  const subtotalCents = lines.reduce((sum, l) => sum + l.priceCents * l.quantity, 0);

  const automaticCoupons = await tx.coupon.findMany({ where: { code: null } });
  const eligibleAutomatic = automaticCoupons.filter((c) => checkCouponEligibility(c, subtotalCents) === null);

  // Her satir icin en yuksek indirimi veren otomatik kampanyayi bul (kargo
  // kampanyalari FREE_SHIPPING satir indirimine katilmaz, ayri degerlendirilir).
  const bestPerLine = new Map<string, { coupon: (typeof eligibleAutomatic)[number]; discountCents: number }>();
  let automaticFreeShipping = false;

  for (const coupon of eligibleAutomatic) {
    const { discountCents, freeShipping, matchingLines } = computeCouponDiscount(coupon, lines);
    if (freeShipping) automaticFreeShipping = true;
    if (coupon.type === "FREE_SHIPPING" || matchingLines.length === 0) continue;

    const matchingCents = matchingLines.reduce((sum, l) => sum + l.priceCents * l.quantity, 0);
    for (const line of matchingLines) {
      const lineShareCents =
        matchingCents === 0 ? 0 : Math.round((discountCents * (line.priceCents * line.quantity)) / matchingCents);
      const current = bestPerLine.get(line.productId);
      if (!current || lineShareCents > current.discountCents) {
        bestPerLine.set(line.productId, { coupon, discountCents: lineShareCents });
      }
    }
  }

  let automaticDiscountCents = 0;
  let automaticCouponId: string | null = null;
  let automaticName: string | null = null;
  const bestByCoupon = new Map<string, number>();
  for (const { coupon, discountCents } of bestPerLine.values()) {
    automaticDiscountCents += discountCents;
    bestByCoupon.set(coupon.id, (bestByCoupon.get(coupon.id) ?? 0) + discountCents);
  }
  // Rozet/isim icin en cok toplam indirim saglayan tek otomatik kampanyayi sec.
  let bestCouponTotal = -1;
  for (const [couponId, total] of bestByCoupon) {
    if (total > bestCouponTotal) {
      bestCouponTotal = total;
      automaticCouponId = couponId;
    }
  }
  if (automaticCouponId) {
    automaticName = eligibleAutomatic.find((c) => c.id === automaticCouponId)?.name ?? null;
  }
  // Sadece kargo kazandiran (satir indirimi olmayan) bir otomatik kampanya varsa
  // rozet icin onu kullan.
  if (!automaticCouponId && automaticFreeShipping) {
    const shippingOnly = eligibleAutomatic.find((c) => c.type === "FREE_SHIPPING");
    automaticCouponId = shippingOnly?.id ?? null;
    automaticName = shippingOnly?.name ?? null;
  }

  const automaticResult: BestDiscountResult = {
    couponId: automaticCouponId,
    discountCents: automaticDiscountCents,
    freeShipping: automaticFreeShipping,
    appliedName: automaticName,
    codeMessage: null
  };

  if (!enteredCode || !enteredCode.trim()) {
    return automaticResult;
  }

  const codeValidation = await validateCoupon(tx, enteredCode, lines);
  if (!codeValidation.valid) {
    return { ...automaticResult, codeMessage: codeValidation.message };
  }

  // Sadece indirim tutarina gore karsilastirilir - esitlikte kupon kazanir
  // (musteri bilerek kod girmis). Ucretsiz kargo, kazanan tarafin kendi
  // freeShipping degeriyle sonuca yansir, karsilastirmayi etkilemez.
  const automaticWins = automaticResult.discountCents > codeValidation.discountCents;
  if (automaticWins) {
    return {
      ...automaticResult,
      codeMessage:
        codeValidation.discountCents > 0
          ? `Zaten "${automaticResult.appliedName ?? "otomatik kampanya"}" indirimi uygulanıyor, bu kod daha düşük bir indirim sağlıyor.`
          : null
    };
  }

  const codedCoupon = await tx.coupon.findUnique({ where: { id: codeValidation.couponId } });
  return {
    couponId: codeValidation.couponId,
    discountCents: codeValidation.discountCents,
    freeShipping: codeValidation.freeShipping,
    appliedName: codedCoupon?.code ?? null,
    codeMessage: null
  };
}

export type ProductAutomaticDiscount = { percent: number; name: string | null };

type AutomaticPercentCampaign = {
  value: number;
  name: string | null;
  categoryId: string | null;
  brandId: string | null;
  startsAt: Date | null;
  expiresAt: Date | null;
  usageLimit: number | null;
  usedCount: number;
};

// Urun kartlarinin (liste sayfalari, ana sayfa, benzer urunler) her biri icin
// ayri sorgu atmamak amaciyla aktif otomatik PERCENT kampanyalar tek seferde
// cekilir, sonra matchAutomaticDiscount ile bellekte eslestirilir.
export async function getActiveAutomaticPercentCampaigns(tx: Tx): Promise<AutomaticPercentCampaign[]> {
  const now = new Date();
  const candidates = await tx.coupon.findMany({ where: { code: null, isActive: true, type: "PERCENT" } });
  return candidates.filter(
    (c) =>
      (!c.startsAt || c.startsAt <= now) &&
      (!c.expiresAt || c.expiresAt >= now) &&
      (c.usageLimit == null || c.usedCount < c.usageLimit)
  );
}

export function matchAutomaticDiscount(
  campaigns: AutomaticPercentCampaign[],
  product: { categoryId: string | null; brandId: string | null }
): ProductAutomaticDiscount | null {
  let best: ProductAutomaticDiscount | null = null;
  for (const c of campaigns) {
    if (c.categoryId != null && c.categoryId !== product.categoryId) continue;
    if (c.brandId != null && c.brandId !== product.brandId) continue;
    if (!best || c.value > best.percent) best = { percent: c.value, name: c.name };
  }
  return best;
}

// Tek bir urun icin (urun detay sayfasi) bilgilendirici rozet - kategori/
// marka kisitina giren aktif, kodsuz, PERCENT tipli bir otomatik kampanya
// varsa yuzdesini dondurur (FIXED/FREE_SHIPPING rozet icin uygun degil -
// urun bazinda sabit tutar/kargo indirimi gosterilmez).
export async function getApplicableAutomaticDiscountForProduct(
  tx: Tx,
  product: { categoryId: string | null; brandId: string | null }
): Promise<ProductAutomaticDiscount | null> {
  const campaigns = await getActiveAutomaticPercentCampaigns(tx);
  return matchAutomaticDiscount(campaigns, product);
}
