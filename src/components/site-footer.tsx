import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-section bg-ink text-cream">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 py-16 md:grid-cols-3">
        <div>
          <p className="font-display text-xl uppercase tracking-widest2">Bollmark</p>
          <p className="mt-4 text-sm text-cream/60">
            Özenle seçilmiş kumaşlar ve zamansız kesimlerle tasarlanan modern giyim markası.
          </p>
        </div>
        <div>
          <p className="text-sm uppercase tracking-wide text-cream/50">Kurumsal</p>
          <ul className="mt-4 space-y-3 text-sm text-cream/70">
            <li>
              <Link href="/sayfa/hakkimizda" className="hover:text-clay">
                Hakkımızda
              </Link>
            </li>
            <li>
              <Link href="/siparis-durumu" className="hover:text-clay">
                İade &amp; Değişim
              </Link>
            </li>
            <li>
              <Link href="/sayfa/kargo-bilgisi" className="hover:text-clay">
                Kargo Bilgisi
              </Link>
            </li>
            <li>
              <Link href="/sayfa/gizlilik-politikasi" className="hover:text-clay">
                Gizlilik Politikası
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-sm uppercase tracking-wide text-cream/50">İletişim</p>
          <ul className="mt-4 space-y-3 text-sm text-cream/70">
            <li>destek@bollmark.com</li>
            <li>+90 555 000 00 00</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-cream/10 py-6 text-center text-xs text-cream/40">
        © {new Date().getFullYear()} Bollmark. Tüm hakları saklıdır.
      </div>
    </footer>
  );
}
