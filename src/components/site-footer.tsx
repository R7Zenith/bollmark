import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-section border-t border-line bg-white">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 md:grid-cols-3">
        <div>
          <p className="font-display text-xl uppercase tracking-widest2">Bollmark</p>
          <p className="mt-4 text-sm text-ink/60">
            Özenle seçilmiş kumaşlar ve zamansız kesimlerle tasarlanan modern giyim markası.
          </p>
        </div>
        <div>
          <p className="text-sm uppercase tracking-wide text-ink/50">Kurumsal</p>
          <ul className="mt-4 space-y-3 text-sm text-ink/70">
            <li>
              <Link href="/sayfa/hakkimizda" className="hover:text-accent">
                Hakkımızda
              </Link>
            </li>
            <li>
              <Link href="/siparis-durumu" className="hover:text-accent">
                İade &amp; Değişim
              </Link>
            </li>
            <li>
              <Link href="/sayfa/kargo-bilgisi" className="hover:text-accent">
                Kargo Bilgisi
              </Link>
            </li>
            <li>
              <Link href="/sayfa/gizlilik-politikasi" className="hover:text-accent">
                Gizlilik Politikası
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-sm uppercase tracking-wide text-ink/50">İletişim</p>
          <ul className="mt-4 space-y-3 text-sm text-ink/70">
            <li>destek@bollmark.com</li>
            <li>+90 555 000 00 00</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line py-6 text-center text-xs text-ink/40">
        © {new Date().getFullYear()} Bollmark. Tüm hakları saklıdır.
      </div>
    </footer>
  );
}
