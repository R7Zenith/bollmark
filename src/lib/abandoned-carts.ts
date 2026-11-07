import { formatExactPrice } from "@/lib/format";
import { badge, button, emailImageUrl, emailSiteUrl, heading, paragraph, productRows, renderEmail, secondaryLink, spacer, totals, whatsappUrl, type RenderedEmail } from "@/lib/email/layout";

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
  // Eski kayitlarda yok: satir gorselsiz cikar.
  image?: string;
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
        priceCents: Number(v.priceCents) || 0,
        image: typeof v.image === "string" ? v.image : undefined
      }));
  } catch {
    return [];
  }
}

// Admin tablosunda "Ürün Adı (Renk, Beden) ×Adet, ..." seklinde tek satirlik ozet.
export function summarizeCartLines(lines: CartLineSnapshot[]): string {
  return lines.map((l) => `${l.name} (${l.color}, ${l.size}) ×${l.quantity}`).join(", ");
}

// MAIL_TASARIMLARI_PLANI.md 07. Kargo anlik goruntude yok: yalniz kayitli toplam gosterilir.
// Abonelikten cikma mekanizmasi olmadigi icin link eklenmez.
export function buildAbandonedCartReminderEmail(lines: CartLineSnapshot[], totalCents: number, siteUrl = emailSiteUrl()): RenderedEmail {
  const cartUrl = `${siteUrl}/sepet`;
  const whatsapp = whatsappUrl();
  return renderEmail({
    siteUrl,
    subject: "Sepetinizde ürünler sizi bekliyor",
    preheader: "Sepetindeki ürünler tükenmeden siparişini tamamla.",
    footer: "transactional",
    blocks: [
      badge("SEPETİN SENİ BEKLİYOR", "red", "🛒"),
      heading("Bir şey mi unuttun?"),
      paragraph("Sepetine eklediğin ürünler hâlâ seni bekliyor. Stoklar sınırlı, bedenin tükenmeden siparişini tamamla.", { margin: "0 0 14px" }),
      productRows(
        lines.map((l) => ({
          name: l.name,
          detail: [l.color, l.size, `${l.quantity} adet`].filter(Boolean).join(" · "),
          priceLabel: formatExactPrice(l.priceCents * l.quantity),
          imageUrl: emailImageUrl(l.image)
        }))
      ),
      totals([{ label: "Toplam", value: formatExactPrice(totalCents) }]),
      spacer(22),
      button("Sepetime dön", cartUrl),
      whatsapp ? secondaryLink("Sorun mu yaşadın? WhatsApp'tan yaz", whatsapp) : ""
    ],
    textLines: [
      "Bir şey mi unuttun? Sepetindeki ürünler seni bekliyor:",
      ...lines.map((l) => `- ${l.name} (${l.color}, ${l.size}) × ${l.quantity}`),
      `Toplam: ${formatExactPrice(totalCents)}`,
      "",
      `Sepetime dön: ${cartUrl}`
    ]
  });
}
