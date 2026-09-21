import Link from "next/link";
import { Minus, Plus } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { SHIPPING_THRESHOLD_CENTS } from "@/lib/shipping";

// Sol: SSS, sag: magaza karti (mobilde alt alta). Cevaplar yalniz kodda /
// yasal sayfalarda dogrulanabilen bilgilerden yazildi (uydurma yok):
// - kargo: sure "Teslimat Sartlari" (kargo-bilgisi) sayfasindan, ucret ve esik
//   StoreSettings.defaultShippingCents + lib/shipping.ts'ten (gercek deger);
// - iade: "Iade Kosullari" (iade-kosullari) sayfasindan;
// - beden: urun sayfasindaki "Beden Tablosu" (size-guide-modal.tsx);
// - odeme: odeme sayfasindaki iyzico/3D Secure metni (checkout-form.tsx),
//   taksit vb. vaat edilmez; takip: /siparis-durumu (siparis no + e-posta).
// Calisma saati ve "magazadan teslim" gibi kodda dogrulanamayan/ima edilebilecek
// bilgiler bilincli olarak yazilmadi.
const STORE_NAME_LINE = "Koton Corner Mağazası — 2016'dan beri";
const STORE_ADDRESS = "Runguçpaşa Mah. 75. Sk. No:6/A Karacabey/Bursa";
const DIRECTIONS_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(STORE_ADDRESS)}`;

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

      <div className="self-start bg-line p-8 md:p-10">
        <h2 className="font-display text-3xl font-normal tracking-[-0.04em] md:text-4xl">Mağazamız</h2>
        <p className="mt-6 text-base text-ink">{STORE_NAME_LINE}</p>
        <address className="mt-2 text-sm not-italic leading-relaxed text-ink/70">{STORE_ADDRESS}</address>
        {(contactPhone || contactEmail) && (
          <ul className="mt-4 space-y-1 text-sm text-ink/70">
            {contactPhone && <li>{contactPhone}</li>}
            {contactEmail && <li>{contactEmail}</li>}
          </ul>
        )}
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
    </section>
  );
}
