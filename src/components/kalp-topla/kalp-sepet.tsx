"use client";

import type { KalpPreview } from "@/components/coupon-field";
import { useCart, type CartLine } from "@/lib/cart";
import { formatPrice } from "@/lib/format";

// Sepet ve odemenin Kalp Topla ust kutusu (KALP_TOPLA_PLANI.md 6.3).
export function KalpSepetKutusu({ kalp }: { kalp: KalpPreview | undefined }) {
  if (!kalp || kalp.couponCount === 0) return null;
  const applied = kalp.lines.length;
  return (
    <p className="rounded-xl bg-[#fff0f1] px-4 py-3 text-sm text-ink">
      ❤️ {kalp.couponCount} Kalp Topla kuponun var
      {applied > 0
        ? ` · %50 indirim uygulandı. En çok kazandıran ${applied} ürününe otomatik uyguladık.`
        : ". Sepetine kampanyalı bir ürün ekle, otomatik uygulayalım."}
    </p>
  );
}

// Satir tutari: 1 adet kuponlu fiyattan, kalanlar normal fiyattan.
export function kalpLineCents(line: CartLine, kalp: KalpPreview | undefined): number {
  const applied = kalp?.lines.find((l) => l.variantId === line.variantId);
  return applied ? applied.unitCents + line.priceCents * (line.quantity - 1) : line.priceCents * line.quantity;
}

export function KalpSatirKontrolu({ line, kalp }: { line: CartLine; kalp: KalpPreview | undefined }) {
  const { applyKalpCoupon, removeKalpCoupon } = useCart();
  if (!kalp) return null;
  const applied = kalp.lines.find((l) => l.variantId === line.variantId);
  const buttonClass = "underline underline-offset-2 hover:text-clay";

  if (applied) {
    return (
      <p className="mt-2 text-xs text-sale">
        <s className="text-ink/40">{formatPrice(applied.originalUnitCents)}</s> {formatPrice(applied.unitCents)} · Kupon uygulandı{" "}
        <button type="button" className={buttonClass} onClick={() => removeKalpCoupon(line.variantId)}>
          Kaldır
        </button>
      </p>
    );
  }
  if (!kalp.applicable.includes(line.variantId)) return null;
  return (
    <button type="button" className={`mt-2 text-xs ${buttonClass}`} onClick={() => applyKalpCoupon(line.variantId)}>
      Kupon uygula
    </button>
  );
}
