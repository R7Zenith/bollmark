import { formatPrice } from "@/lib/format";

// Terk edilmis sepet anlik goruntusu - checkout formunda e-posta girilip
// siparis tamamlanmadan birakildiginda kaydedilir (bkz. api/sepet-kaydet).
// Hem otomatik gunluk hatirlatma (api/cron/sepet-hatirlatma) hem de admin
// panelden elle gonderilen hatirlatma (admin/terk-edilmis-sepetler) bu
// dosyadaki ayni parse/HTML fonksiyonlarini kullanir - iki yerde farkli
// mail icerigi olusmasin diye.
export interface CartLineSnapshot {
  name: string;
  size: string;
  color: string;
  quantity: number;
  priceCents: number;
}

export function parseCartLines(raw: string): CartLineSnapshot[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null)
      .map((v) => ({
        name: String(v.name ?? ""),
        size: String(v.size ?? ""),
        color: String(v.color ?? ""),
        quantity: Number(v.quantity) || 0,
        priceCents: Number(v.priceCents) || 0
      }));
  } catch {
    return [];
  }
}

// Admin tablosunda "Ürün Adı (Renk, Beden) ×Adet, ..." seklinde tek satirlik ozet.
export function summarizeCartLines(lines: CartLineSnapshot[]): string {
  return lines.map((l) => `${l.name} (${l.color}, ${l.size}) ×${l.quantity}`).join(", ");
}

export function buildAbandonedCartReminderHtml(lines: CartLineSnapshot[], totalCents: number): string {
  const itemsHtml = lines.map((l) => `<li>${l.name} (${l.color}, ${l.size}) × ${l.quantity}</li>`).join("");
  return `<p>Sepetinizde sizi bekleyen ürünler var:</p><ul>${itemsHtml}</ul><p>Toplam: ${formatPrice(totalCents)}</p><p><a href="https://bollmark.com/sepet">Sepetine dön</a></p>`;
}
