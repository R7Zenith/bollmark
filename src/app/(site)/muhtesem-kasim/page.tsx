import type { Metadata } from "next";
import Link from "next/link";
import { getEfsaneWindow } from "@/lib/efsane-cuma-server";
import { EFSANE_NAME, EFSANE_RED } from "@/lib/efsane-cuma";
import { formatPrice } from "@/lib/format";
import { SHIPPING_THRESHOLD_CENTS } from "@/lib/shipping";
import { EfsaneDurum } from "@/components/efsane-cuma/durum";

// Kampanya kosullari. Kampanya bitince de acik kalir (404 vermez); durum notu
// tarayicida o anki saatle secilir. Ayar kaydinda admin bu yolu tazeler.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Efsane Cuma Kampanya Koşulları",
  description: "Efsane Cuma: tüm ürünlerde sepetteki 2. ürüne %50 indirim. Kampanya tarihleri ve koşulları.",
  alternates: { canonical: "/efsane-cuma" }
};

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul"
  });

export default async function EfsaneCumaPage() {
  const window = await getEfsaneWindow();
  const conditions = [
    `Kampanya ${dateTime(window.startsAt)} – ${dateTime(window.endsAt)} (Türkiye saati) arasında geçerlidir.`,
    "Sitedeki tüm ürünlerde geçerlidir; kampanya dışı ürün yoktur.",
    "Sepetteki ürünler adet adet sayılır (aynı üründen 2 adet, 2 ürün sayılır) ve birim fiyata göre yüksekten düşüğe sıralanır. 2., 4., 6. … sıradaki ürünlere %50 indirim uygulanır; yani her iki üründen düşük fiyatlı olana %50 indirim yapılır.",
    "İndirimli ürünlerde %50, ürünün sitedeki mevcut indirimli satış fiyatından hesaplanır.",
    "İndirim tutarı kuruşa yuvarlanır; sepette gördüğün tutar ödeme tutarıyla aynıdır.",
    "Kalp Topla kuponu ile birleşmez. Sepette ikisi birden uygulanabilir durumdaysa sana daha avantajlı olan otomatik olarak uygulanır.",
    "Kampanya süresince indirim kodları, kombin indirimi ve puan kullanımı geçerli değildir.",
    `İndirim sonrası ${formatPrice(SHIPPING_THRESHOLD_CENTS)} ve üzeri siparişlerde kargo ücretsizdir.`,
    "Kampanyalı ürünlerde değişim yalnız Karacabey mağazamızda yapılır."
  ];

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: EFSANE_RED }}>
        Kampanya koşulları
      </p>
      <h1 className="mt-3 font-display text-3xl md:text-5xl">{EFSANE_NAME}</h1>
      <EfsaneDurum window={window} />
      <ul className="mt-8 list-disc space-y-3 pl-5 text-sm leading-relaxed text-ink/80">
        {conditions.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <Link
        href="/urunler"
        className="mt-10 inline-flex items-center rounded-full bg-ink px-8 py-3.5 text-sm uppercase tracking-wide text-cream transition hover:bg-clay"
      >
        Alışverişe başla
      </Link>
    </div>
  );
}
