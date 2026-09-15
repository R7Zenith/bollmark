import Image from "next/image";
import Link from "next/link";
import { FooterNewsletterForm } from "./footer-newsletter-form";

// logo-white.png'nin gercek en-boy orani (bkz. site-header.tsx LOGO_ASPECT_RATIO,
// 1400x273px).
const LOGO_ASPECT_RATIO = 1400 / 273;
const LOGO_HEIGHT = 96;

// Alışveriş sütunu: UST_MENU_MEGA_MENU_PLANI.md'de listelenen 9 ortak ürün
// tipinden ilk 6'sı. Slug'lar DB'deki gerçek Category.slug değerleriyle
// doğrulandı (bkz. FOOTER_RELEASE_TARZI_YENIDEN_TASARIM_PLANI.md).
const SHOP_LINKS = [
  { slug: "tisort", label: "Tişört" },
  { slug: "gomlek", label: "Gömlek" },
  { slug: "pantolon", label: "Pantolon" },
  { slug: "sweatshirt", label: "Sweatshirt" },
  { slug: "ceket", label: "Ceket" },
  { slug: "mont-kaban", label: "Mont & Kaban" }
];

const FOOTER_LINK_CLASS = "nav-underline inline-block text-cream/70 hover:text-cream";

function InstagramIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M14 4v10.5a3.5 3.5 0 1 1-3.5-3.5" />
      <path d="M14 4c.4 2.2 2 4 4.5 4.3" />
    </svg>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-section bg-ink text-cream">
      <div className="w-full px-6 py-16 xl:px-9">
        {/* Üst blok: bülten + link sütunları */}
        <div className="grid gap-12 md:grid-cols-2 md:gap-16">
          <div>
            <p className="text-sm uppercase tracking-wide text-cream/50">Bültenimize katılın</p>
            <p className="mt-4 max-w-sm text-sm text-cream/60">
              Yeni koleksiyonlardan ve fırsatlardan ilk siz haberdar olun.
            </p>
            <FooterNewsletterForm />
          </div>

          <div className="grid gap-10 sm:grid-cols-3">
            <div>
              <p className="text-sm uppercase tracking-wide text-cream/50">Kurumsal</p>
              <ul className="mt-4 space-y-3 text-sm">
                <li>
                  <Link href="/sayfa/hakkimizda" className={FOOTER_LINK_CLASS}>
                    Hakkımızda
                  </Link>
                </li>
                <li>
                  <Link href="/#hikaye" className={FOOTER_LINK_CLASS}>
                    Hikayemiz
                  </Link>
                </li>
                <li>
                  <Link href="/siparis-durumu" className={FOOTER_LINK_CLASS}>
                    İade &amp; Değişim
                  </Link>
                </li>
                <li>
                  <Link href="/sayfa/kargo-bilgisi" className={FOOTER_LINK_CLASS}>
                    Kargo Bilgisi
                  </Link>
                </li>
                <li>
                  <Link href="/sayfa/gizlilik-politikasi" className={FOOTER_LINK_CLASS}>
                    Gizlilik Politikası
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <p className="text-sm uppercase tracking-wide text-cream/50">İletişim</p>
              <ul className="mt-4 space-y-3 text-sm">
                <li>
                  <a href="mailto:destek@bollmark.com" className={FOOTER_LINK_CLASS}>
                    destek@bollmark.com
                  </a>
                </li>
                <li>
                  <a href="tel:+905550000000" className={FOOTER_LINK_CLASS}>
                    +90 555 000 00 00
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <p className="text-sm uppercase tracking-wide text-cream/50">Alışveriş</p>
              <ul className="mt-4 space-y-3 text-sm">
                {SHOP_LINKS.map((item) => (
                  <li key={item.slug}>
                    <Link href={`/urunler?kategori=${item.slug}`} className={FOOTER_LINK_CLASS}>
                      {item.label}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link href="/urunler" className={FOOTER_LINK_CLASS}>
                    Tüm Ürünler
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Orta blok: dev logo */}
        <div className="mt-16 flex flex-col gap-6 border-t border-cream/10 pt-16 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <Image
              src="/logo-white.png"
              alt="Bollmark"
              width={Math.round(LOGO_HEIGHT * LOGO_ASPECT_RATIO)}
              height={LOGO_HEIGHT}
              className="h-12 w-auto sm:h-16 md:h-24 lg:h-32 xl:h-40"
            />
            <p className="mt-4 max-w-md text-sm text-cream/60">
              Özenle seçilmiş kumaşlar ve zamansız kesimlerle tasarlanan modern giyim markası.
            </p>
          </div>
          {/* Gerçek sosyal medya hesap linkleri girilene kadar placeholder. */}
          <div className="flex shrink-0 items-center gap-4">
            <a href="#" aria-label="Instagram" className="text-cream/70 hover:text-cream">
              <InstagramIcon />
            </a>
            <a href="#" aria-label="TikTok" className="text-cream/70 hover:text-cream">
              <TikTokIcon />
            </a>
          </div>
        </div>
      </div>

      {/* Alt bar */}
      <div className="border-t border-cream/10 px-6 py-6 xl:px-9">
        <div className="flex w-full flex-wrap items-center gap-2 text-xs text-cream/40">
          © {new Date().getFullYear()} Bollmark. Tüm hakları saklıdır.
        </div>
      </div>
    </footer>
  );
}
