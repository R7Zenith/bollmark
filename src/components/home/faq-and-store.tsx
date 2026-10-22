import { existsSync } from "node:fs";
import path from "node:path";
import Image from "next/image";
import Link from "next/link";
import { Minus, Plus } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { SHIPPING_THRESHOLD_CENTS } from "@/lib/shipping";

// SSS ve magaza bolumu (anasayfada ayri yerlerde). Cevaplar yalniz kodda /
// yasal sayfalarda dogrulanabilen bilgilerden yazildi (uydurma yok):
// - kargo: sure "Teslimat Sartlari" (kargo-bilgisi) sayfasindan, ucret ve esik
//   StoreSettings.defaultShippingCents + lib/shipping.ts'ten (gercek deger);
// - iade: "Iade Kosullari" (iade-kosullari) sayfasindan;
// - beden: urun sayfasindaki "Beden Tablosu" (size-guide-modal.tsx);
// - odeme: odeme sayfasindaki iyzico/3D Secure metni (checkout-form.tsx),
//   taksit vb. vaat edilmez; takip: /siparis-durumu (siparis no + e-posta);
// - degisim: magaza sahibinin karari (22 Ekim 2026) - siteden alinan urun
//   YALNIZ Karacabey magazasinda degistirilebilir; bu yuzden sitede yaziliyor.
// Calisma saati ve "magazadan teslim" gibi dogrulanamayan bilgiler bilincli
// olarak yazilmadi.
const STORE_NAME_LINE = "Bollmark Karacabey Mağazası";
const STORE_ADDRESS = "Runguçpaşa Mah. 75. Sk. No:6/A Karacabey/Bursa";
const DIRECTIONS_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(STORE_ADDRESS)}`;
const EXCHANGE_SENTENCE = "Siteden aldığınız ürünleri Karacabey mağazamızda değiştirebilirsiniz.";

type Faq = { question: string; answer: string; link?: { href: string; label: string } };

function buildFaqs(defaultShippingCents: number): Faq[] {
  const shippingCost =
    defaultShippingCents > 0
      ? `Kargo ücreti ${formatPrice(defaultShippingCents)}; ${formatPrice(SHIPPING_THRESHOLD_CENTS)} ve üzeri siparişlerde kargo ücretsizdir.`
      : "Kargo ücretsizdir.";
  return [
    {
      question: "Kargo ne kadar sürer, ücreti nedir?",
      answer: `Siparişleriniz, ödemenin onaylanmasının ardından 1-3 iş günü içinde hazırlanıp kargoya teslim edilir; takip bilgileri e-posta ve/veya SMS ile iletilir. ${shippingCost}`,
      link: { href: "/sayfa/kargo-bilgisi", label: "Teslimat şartları" }
    },
    {
      question: "İade nasıl yapılır?",
      answer:
        "Teslim aldığınız üründen 14 gün içinde, gerekçe göstermeksizin cayma hakkınızı kullanabilirsiniz. Ürünü faturası, orijinal ambalajı ve etiketleriyle, kullanılmamış ve hasarsız şekilde göndermeniz gerekir. İade kargo ücreti alıcıya aittir.",
      link: { href: "/sayfa/iade-kosullari", label: "İade koşulları" }
    },
    {
      question: "Ürünü mağazada değiştirebilir miyim?",
      answer: `Evet. Sitemizden aldığınız ürünler yalnızca Karacabey mağazamızda değiştirilebilir. Mağazamızın adresi: ${STORE_ADDRESS}.`,
      link: { href: "/iletisim", label: "İletişim" }
    },
    {
      question: "Beden nasıl seçerim?",
      answer:
        "Her ürün sayfasında bir Beden Tablosu bulunur. Ölçülerinizi tablodaki değerlerle karşılaştırarak size uygun bedeni seçebilirsiniz."
    },
    {
      question: "Nasıl ödeme yapabilirim?",
      answer:
        "Ödemeniz kart ile, iyzico güvencesiyle ve 3D Secure doğrulamasıyla alınır. Kart bilgileriniz sitemizde saklanmaz."
    },
    {
      question: "Siparişimi nasıl takip ederim?",
      answer:
        "Sipariş Durumu sayfasında sipariş numaranız ve e-posta adresinizle siparişinizin durumunu ve kargo takip bilgisini görebilirsiniz.",
      link: { href: "/siparis-durumu", label: "Sipariş durumu" }
    }
  ];
}

// Magaza fotograflari public/magaza/ altina elle konur: magaza-1.jpg genis,
// magaza-2/3/4.jpg kucuk. Yalniz var olan dosyalar gosterilir; hic yoksa
// yalniz metin karti kalir (bos kutu ya da stok fotograf yok). Dosya
// kontrolu istek aninda fs ile (Instagram galerisiyle ayni yol) - klasor
// next.config.mjs outputFileTracingIncludes ile "/" function'ina eklendi.
const STORE_PHOTOS = ["magaza-1.jpg", "magaza-2.jpg", "magaza-3.jpg", "magaza-4.jpg"];
const SMALL_GRID_COLS = ["", "grid-cols-1", "grid-cols-2", "grid-cols-3"];

// Sol: SSS, sag: magaza (fotograflar + kart); mobilde alt alta. Alt bosluk
// yok: sayfanin son bolumu, footer kendi mt-section'ini getiriyor.
export function FaqAndStore({
  contactPhone,
  contactEmail,
  defaultShippingCents
}: {
  contactPhone: string;
  contactEmail: string;
  defaultShippingCents: number;
}) {
  const faqs = buildFaqs(defaultShippingCents);
  const present = STORE_PHOTOS.filter((file) => existsSync(path.join(process.cwd(), "public", "magaza", file)));
  const wide = present.includes(STORE_PHOTOS[0]) ? STORE_PHOTOS[0] : null;
  const small = present.filter((file) => file !== wide);
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer }
    }))
  };

  return (
    <section className="grid gap-12 px-4 md:grid-cols-2 md:gap-10 md:px-6 xl:px-9">
      {/* Next.js JSON-LD kilavuzu: "<" karakteri < ile kacirilir (XSS). */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c") }}
      />
      <div>
        <h2 className="mb-8 font-display text-3xl font-normal tracking-[-0.04em] md:mb-10 md:text-5xl">
          Sıkça Sorulan Sorular
        </h2>
        <div className="border-t border-line">
          {faqs.map((f) => (
            <details key={f.question} className="group border-b border-line">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-base text-ink [&::-webkit-details-marker]:hidden">
                {f.question}
                <Plus size={18} strokeWidth={1.5} aria-hidden="true" className="shrink-0 group-open:hidden" />
                <Minus size={18} strokeWidth={1.5} aria-hidden="true" className="hidden shrink-0 group-open:block" />
              </summary>
              <div className="pb-5 pr-8 text-sm leading-relaxed text-ink/70">
                <p>{f.answer}</p>
                {f.link && (
                  <Link href={f.link.href} className="link-shrink-underline mt-3 inline-block text-ink">
                    {f.link.label}
                  </Link>
                )}
              </div>
            </details>
          ))}
        </div>
      </div>

      <div className="grid gap-3 self-start md:gap-4">
        {wide && (
          <div className="relative aspect-[4/3] overflow-hidden bg-line">
            <Image
              src={`/magaza/${wide}`}
              alt="Bollmark Karacabey mağazası"
              fill
              sizes="(min-width: 768px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
        )}
        {small.length > 0 && (
          <div className={`grid gap-3 md:gap-4 ${SMALL_GRID_COLS[small.length]}`}>
            {small.map((file) => (
              <div key={file} className="relative aspect-square overflow-hidden bg-line">
                <Image
                  src={`/magaza/${file}`}
                  alt="Bollmark Karacabey mağazasından bir görünüm"
                  fill
                  sizes="(min-width: 768px) 17vw, 33vw"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        )}
        <div className="bg-line p-6 md:p-10">
          <h2 className="font-display text-3xl font-normal tracking-[-0.04em] md:text-4xl">
            Karacabey&apos;de bir mağaza
          </h2>
          <p className="mt-6 text-base text-ink">{STORE_NAME_LINE}</p>
          <address className="mt-2 text-sm not-italic leading-relaxed text-ink/70">{STORE_ADDRESS}</address>
          {(contactPhone || contactEmail) && (
            <ul className="mt-4 space-y-1 text-sm text-ink/70">
              {contactPhone && <li>{contactPhone}</li>}
              {contactEmail && <li>{contactEmail}</li>}
            </ul>
          )}
          <p className="mt-6 max-w-md text-base leading-relaxed text-ink md:text-lg">
            {EXCHANGE_SENTENCE}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={DIRECTIONS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-full bg-ink px-8 py-3.5 text-sm uppercase tracking-wide text-cream transition hover:bg-cream hover:text-ink"
            >
              Yol tarifi al
            </a>
            <Link
              href="/iletisim"
              className="inline-flex items-center rounded-full border border-ink px-8 py-3.5 text-sm uppercase tracking-wide text-ink transition hover:bg-ink hover:text-cream"
            >
              İletişim
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
