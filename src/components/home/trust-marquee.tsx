import { formatPrice } from "@/lib/format";
import { percentWithDative } from "@/lib/home-products";
import { SHIPPING_THRESHOLD_CENTS } from "@/lib/shipping";

// Yeni Gelenler'in altindaki ince siyah serit. Metin dizisi iki kez yazilir,
// iz -50% kayinca ikinci kopya birincinin yerine oturur (dikis yok); ikinci
// kopya ekran okuyucudan gizli. Kayma globals.css .home-marquee'de. Kargo cumlesi FaqSection'daki gibi: varsayilan ucret 0
// ise kargo zaten hep ucretsiz, esik yazilmaz.
// 5 metnin tek dizisi masaustunde ~1.700px; 3 tekrar 2.560px ekrani da doldurur.
const REPEAT = 3;

export function TrustMarquee({
  campaignPercent,
  defaultShippingCents
}: {
  campaignPercent: number;
  defaultShippingCents: number;
}) {
  const items = [
    ...(campaignPercent > 0 ? [`Sezon fırsatı: ${percentWithDative(campaignPercent)} varan indirim`] : []),
    defaultShippingCents > 0
      ? `${formatPrice(SHIPPING_THRESHOLD_CENTS)} ve üzeri ücretsiz kargo`
      : "Ücretsiz kargo",
    "14 gün içinde iade",
    "iyzico ile güvenli ödeme",
    "Karacabey mağazamızda değişim"
  ];

  return (
    <div className="home-marquee mb-10 overflow-hidden bg-ink py-3 text-cream md:mb-12">
      <div className="home-marquee__track flex w-max">
        {[0, 1].map((copy) => (
          <ul key={copy} aria-hidden={copy === 1 || undefined} className="flex shrink-0 items-center">
            {/* Her kopyada metinler REPEAT kez: tek dizi genis ekrandan (1920px+)
                kisa kaliyor, kayarken sagda bos alan aciliyordu. */}
            {Array.from({ length: REPEAT }, (_, r) => items.map((item) => ({ item, r }))).flat().map(({ item, r }) => (
              <li
                key={`${r}-${item}`}
                aria-hidden={r > 0 || undefined}
                className="flex items-center whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.1em] md:text-[11px]"
              >
                <span className="px-6 md:px-10">{item}</span>
                <span aria-hidden="true" className="h-1 w-1 rounded-full bg-cream/40" />
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}
