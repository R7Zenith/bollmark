import { formatExactPrice } from "@/lib/format";
import { EFSANE_LINE_LABEL, EFSANE_RED, EFSANE_SINGLE_ITEM_NOTE } from "@/lib/efsane-cuma";
import type { EfsanePreview } from "@/components/coupon-field";

// Sepet ve odeme ozetindeki Efsane Cuma satiri, satir bazli indirim ve notlar.

export function efsaneLineDiscountCents(variantId: string, efsane: EfsanePreview | undefined): number {
  const line = efsane?.lines.find((l) => l.variantId === variantId);
  return line ? (line.originalUnitCents - line.unitCents) * line.count : 0;
}

export function EfsaneSatirEtiketi({ variantId, efsane }: { variantId: string; efsane: EfsanePreview | undefined }) {
  const line = efsane?.lines.find((l) => l.variantId === variantId);
  if (!line) return null;
  return (
    <p className="mt-1 text-xs font-semibold" style={{ color: EFSANE_RED }}>
      {line.count} adet 2. ürün olarak {formatExactPrice(line.unitCents)}
    </p>
  );
}

export function EfsaneOzetSatiri({ efsane }: { efsane: EfsanePreview | undefined }) {
  if (!efsane || efsane.discountCents <= 0) return null;
  return (
    <div className="flex items-center justify-between text-sm font-semibold" style={{ color: EFSANE_RED }}>
      <span>{EFSANE_LINE_LABEL}</span>
      <span>−{formatExactPrice(efsane.discountCents)}</span>
    </div>
  );
}

export function EfsaneSepetNotu({ efsane, itemCount }: { efsane: EfsanePreview | undefined; itemCount: number }) {
  if (!efsane?.active) return null;
  const notes = [efsane.combineNote, itemCount === 1 ? EFSANE_SINGLE_ITEM_NOTE : null].filter(Boolean);
  if (notes.length === 0) return null;
  return (
    <div className="space-y-1 border px-4 py-3 text-sm" style={{ borderColor: EFSANE_RED, color: EFSANE_RED }}>
      {notes.map((note) => (
        <p key={note}>{note}</p>
      ))}
    </div>
  );
}
