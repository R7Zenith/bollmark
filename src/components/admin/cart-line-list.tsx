import { Badge } from "@/components/admin/badge";
import { formatExactPrice } from "@/lib/format";
import type { ResolvedCartLine } from "@/lib/cart-shared";

// Uye sepetinin cozumlenmis satirlari - Aktif Sepetler detay paneli ve
// musteri detayindaki "Su anki sepeti" karti ortak kullanir.
export function CartLineList({ lines }: { lines: ResolvedCartLine[] }) {
  return (
    <ul className="divide-y divide-admin-border text-sm">
      {lines.map((line) => {
        const variant = [line.color, line.size].filter(Boolean).join(" / ");
        return (
          <li key={line.variantId} className="flex items-center gap-3 py-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={line.image} alt="" loading="lazy" className="h-14 w-11 shrink-0 rounded bg-admin-bg object-cover" />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-medium text-admin-text">
                {line.name}
                {line.issue === "OUT_OF_STOCK" && <Badge tone="red">Tükendi</Badge>}
                {line.issue === "UNAVAILABLE" && <Badge tone="yellow">Yayında değil</Badge>}
              </p>
              {variant && <p className="text-xs text-admin-text-muted">{variant}</p>}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-admin-text-muted">
                {line.quantity} × {formatExactPrice(line.priceCents)}
              </p>
              <p className="font-medium text-admin-text">{formatExactPrice(line.quantity * line.priceCents)}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
