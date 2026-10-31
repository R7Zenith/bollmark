// Kalp Topla kupon atamasi (KALP_TOPLA_PLANI.md 5.6, T5, T17). Saf fonksiyonlar:
// DB'ye dokunmaz, istemci de tip olarak kullanabilir. Tutarlar tam sayi kurus.

export type KalpSelection = { manual: string[]; removed: string[] };

export type KalpPriceLine = {
  variantId: string;
  priceCents: number;
  compareAtCents: number | null;
  // Kuponsuz odenecek en iyi birim fiyat: manuel ve otomatik kampanya fiyatinin en dusugu.
  currentBestCents: number;
  excluded: boolean;
};

export type KalpCouponRef = { id: string; expiresAt: Date; discountPercent: number };

export type KalpAssignment = {
  couponId: string;
  variantId: string;
  unitCents: number;
  originalUnitCents: number;
};

export function parseKalpSelection(raw: unknown): KalpSelection {
  let value = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      value = null;
    }
  }
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((id): id is string => typeof id === "string") : []);
  const object = (value ?? {}) as { manual?: unknown; removed?: unknown };
  return { manual: list(object.manual), removed: list(object.removed) };
}

// Plan 5.6 madde 2: yuzde her zaman indirimsiz esas fiyat uzerinden hesaplanir.
export function couponPriceFor(line: Pick<KalpPriceLine, "priceCents" | "compareAtCents">, percent: number): number {
  return Math.round(((line.compareAtCents ?? line.priceCents) * (100 - percent)) / 100);
}

export function couponGain(line: KalpPriceLine, percent: number): number {
  if (line.excluded) return 0;
  return Math.max(0, line.currentBestCents - couponPriceFor(line, percent));
}

// Sira: once manual, sonra en cok kazandiran satirlar (T5); esitlikte sepet sirasi.
// En erken bitecek kupon once harcanir. forcedCouponId kod kutusundan gelir:
// kuponsuz kalan en cok kazandiran tek satira gider, `removed` onu engellemez.
export function assignKalpCoupons(
  lines: KalpPriceLine[],
  coupons: KalpCouponRef[],
  selection: KalpSelection,
  forcedCouponId: string | null = null
): KalpAssignment[] {
  const queue = [...coupons].sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime());
  const forced = queue.find((c) => c.id === forcedCouponId) ?? null;
  const pool = queue.filter((c) => c !== forced);
  const gainOf = (line: KalpPriceLine, coupon: KalpCouponRef | undefined) => (coupon ? couponGain(line, coupon.discountPercent) : 0);
  const percent = queue[0]?.discountPercent ?? 0;

  const ranked = lines
    .map((line, index) => ({ line, index, gain: couponGain(line, percent) }))
    .filter((c) => c.gain > 0)
    .sort((a, b) => b.gain - a.gain || a.index - b.index);
  const manual = ranked.filter((c) => selection.manual.includes(c.line.variantId));
  const automatic = ranked.filter((c) => !selection.manual.includes(c.line.variantId) && !selection.removed.includes(c.line.variantId));

  const assigned: KalpAssignment[] = [];
  const taken = new Set<string>();
  const assign = (line: KalpPriceLine, coupon: KalpCouponRef) => {
    if (gainOf(line, coupon) <= 0) return false;
    taken.add(line.variantId);
    assigned.push({
      couponId: coupon.id,
      variantId: line.variantId,
      unitCents: couponPriceFor(line, coupon.discountPercent),
      originalUnitCents: line.currentBestCents
    });
    return true;
  };

  for (const { line } of [...manual, ...automatic]) {
    const coupon = pool[0];
    if (!coupon) break;
    if (assign(line, coupon)) pool.shift();
  }
  if (forced) {
    const target = ranked.find((c) => !taken.has(c.line.variantId));
    if (target) assign(target.line, forced);
  }
  return assigned;
}

// Kuponlu adet ayri satir olur, kalan adetler normal fiyatla kalir (plan 5.6).
export function splitOrderItems(
  lines: { productId: string; variantId: string; quantity: number; priceCents: number }[],
  assignments: KalpAssignment[]
) {
  const assignmentOf = new Map(assignments.map((a) => [a.variantId, a]));
  return lines.flatMap((line) => {
    const base = { productId: line.productId, variantId: line.variantId };
    const assignment = assignmentOf.get(line.variantId);
    const rest = line.quantity - (assignment ? 1 : 0);
    return [
      ...(assignment
        ? [
            {
              ...base,
              quantity: 1,
              unitPriceCents: assignment.unitCents,
              totalCents: assignment.unitCents,
              kalpCouponId: assignment.couponId,
              kalpOriginalUnitCents: assignment.originalUnitCents
            }
          ]
        : []),
      ...(rest > 0 ? [{ ...base, quantity: rest, unitPriceCents: line.priceCents, totalCents: line.priceCents * rest }] : [])
    ];
  });
}
