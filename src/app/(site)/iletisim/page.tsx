import type { Metadata } from "next";
import Link from "next/link";
import { ContactForm } from "@/components/contact-form";
import { InstagramDmLink, WhatsAppLink } from "@/components/contact-links";
import { legalIdentityRows, openingHoursLines, phoneDisplay, STORE_INFO } from "@/lib/store-info";

export const metadata: Metadata = {
  title: "Bize Ulaşın",
  description:
    "Bir sorunuz mu var? Bollmark'a yazın, bir iş günü içinde size dönüş yapalım. Çalışma saatleri ve mağaza adresimiz bu sayfada.",
  alternates: { canonical: "/iletisim" }
};

// Harita yalniz adresle sorgulanir (magaza adi/marka yok); Google Haritalar
// 75. Sk. No:6/A, Rungucpasa, Karacabey adresini cozumler. Anahtarsiz embed
// adresi kullanilir.
const STORE_ADDRESS = "Runguçpaşa Mah. 75. Sk. No:6/A Karacabey/Bursa";
const MAP_QUERY = "75. Sk. No:6/A, Runguçpaşa, Karacabey, Bursa";
const MAP_SRC = `https://maps.google.com/maps?q=${encodeURIComponent(MAP_QUERY)}&hl=tr&z=16&output=embed`;

const sectionTitleClass = "text-[10px] font-medium tracking-[1px] uppercase text-ink";
const linkClass = "text-ink underline underline-offset-2";

export default function ContactPage() {
  return (
    <>
      <div className="mx-auto max-w-[1600px] px-9 pt-16">
        <nav className="flex items-center gap-2 text-[10px] uppercase tracking-[1px] text-ink/50">
          <Link href="/" className="hover:text-ink">
            Ana Sayfa
          </Link>
          <span>/</span>
          <span className="text-ink">Bize Ulaşın</span>
        </nav>

        <div className="mx-auto mt-10 w-full max-w-[560px] pb-16">
          <h1 className="font-display text-[32px] leading-[36px] tracking-[-1.28px] font-normal sm:text-[47px] sm:leading-[47px] sm:tracking-[-1.88px]">
            Bir sorunuz mu var? Bize yazın, bir iş günü içinde size dönüş yapalım.
          </h1>

          <section className="mt-10">
            <h2 className={sectionTitleClass}>Çalışma Saatleri</h2>
            <ul className="mt-3 space-y-1 text-sm text-ink/80">
              {openingHoursLines().map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>

          <section className="mt-10">
            <h2 className={sectionTitleClass}>İletişim</h2>
            <ul className="mt-3 space-y-1 text-sm text-ink/80">
              {STORE_INFO.whatsappActive && (
                <li>
                  <WhatsAppLink className={linkClass} />
                </li>
              )}
              <li>
                E-posta:{" "}
                <a href={`mailto:${STORE_INFO.email}`} className={linkClass}>
                  {STORE_INFO.email}
                </a>
              </li>
              <li>
                <InstagramDmLink className={linkClass}>Instagram&apos;dan mesaj gönder</InstagramDmLink>
              </li>
            </ul>
          </section>

          <div className="mt-10">
            <ContactForm />
          </div>

          <section className="mt-10">
            <h2 className={sectionTitleClass}>Mağaza Adresi</h2>
            <p className="mt-3 text-sm text-ink/80">{STORE_ADDRESS}</p>
          </section>

          <section className="mt-10">
            <h2 className={sectionTitleClass}>Satıcı Bilgileri</h2>
            <dl className="mt-3 space-y-1 text-sm text-ink/80">
              {legalIdentityRows().map((row) => (
                <div key={row.label}>
                  <dt className="inline">{row.label}: </dt>
                  <dd className="inline">{row.value}</dd>
                </div>
              ))}
              {/* Numara yalniz WhatsApp icin (aramalar acilmaz) - duz metin, tel: linki yok. */}
              {STORE_INFO.phone && (
                <div>
                  <dt className="inline">Telefon / WhatsApp: </dt>
                  <dd className="inline">{phoneDisplay(STORE_INFO.phone)}</dd>
                </div>
              )}
            </dl>
          </section>
        </div>
      </div>

      <iframe
        title="Mağaza konumu - Google Haritalar"
        src={MAP_SRC}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="-mb-section block h-[360px] w-full border-0 md:h-[450px]"
      />
    </>
  );
}
