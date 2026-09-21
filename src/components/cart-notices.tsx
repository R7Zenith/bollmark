"use client";

import { X } from "lucide-react";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/format";

// Sepet, cekmece ve odeme sayfasinda ortak: fiyati guncellenen satirlar
// (kapatilabilir) ile yayindan kalkmis / stogu bitmis satirlar icin uyari.
export function CartNotices() {
  const { lines, priceNotices, dismissPriceNotice, lineIssues } = useCart();
  const issueLines = lines.filter((l) => l.variantId in lineIssues);
  if (priceNotices.length === 0 && issueLines.length === 0) return null;

  return (
    <div className="space-y-2" role="status">
      {issueLines.map((l) => (
        <p key={l.variantId} className="border border-red-300 bg-white px-3 py-2 text-sm text-red-600">
          {l.name}:{" "}
          {lineIssues[l.variantId] === "OUT_OF_STOCK" ? "stokta kalmadı" : "artık satışta değil"}. Ödemeye geçmek için
          sepetinizden kaldırın.
        </p>
      ))}
      {priceNotices.map((n) => (
        <div
          key={n.variantId}
          className="flex items-start justify-between gap-3 border border-line bg-white px-3 py-2 text-sm text-ink/80"
        >
          <p>
            <strong className="font-medium">{n.name}</strong> ürününün fiyatı güncellendi:{" "}
            <span className="line-through">{formatPrice(n.oldPriceCents)}</span> →{" "}
            <span className="font-medium">{formatPrice(n.newPriceCents)}</span>
          </p>
          <button
            type="button"
            aria-label="Bildirimi kapat"
            onClick={() => dismissPriceNotice(n.variantId)}
            className="shrink-0 p-0.5 text-ink/50 hover:text-ink"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
