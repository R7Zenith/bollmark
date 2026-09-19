import type { Metadata } from "next";
import Link from "next/link";
import { ContactForm } from "@/components/contact-form";

export const metadata: Metadata = {
  title: "Bize Ulaşın | Bollmark",
  description:
    "Bir sorunuz mu var? Bollmark'a yazın, bir iş günü içinde size dönüş yapalım. Çalışma saatleri ve mağaza adresimiz bu sayfada."
};

// Koton Karacabey magazasi: Google Haritalar bu sorguyu "Koton Leventoglu,
// Rungus pasa, 75. Sk. No:6, 16700 Karacabey/Bursa" kaydina cozumluyor (Yandex
// kaydi da "75. Sok., 6A" diyor). Anahtarsiz embed adresi kullanilir.
const STORE_ADDRESS = "Runguşpaşa, 75. Sk. No: 6, 16700 Karacabey / Bursa";
const MAP_QUERY = "Koton Karacabey, 75. Sok. 6A, Karacabey, Bursa";
const MAP_SRC = `https://maps.google.com/maps?q=${encodeURIComponent(MAP_QUERY)}&hl=tr&z=16&output=embed`;

const sectionTitleClass = "text-[10px] font-medium tracking-[1px] uppercase text-ink";

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
              <li>Pazartesi - Cumartesi: 10:00 - 19:00</li>
              <li>Pazar: Kapalı</li>
            </ul>
          </section>

          <div className="mt-10">
            <ContactForm />
          </div>

          <section className="mt-10">
            <h2 className={sectionTitleClass}>Mağaza Adresi</h2>
            <p className="mt-3 text-sm text-ink/80">{STORE_ADDRESS}</p>
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
