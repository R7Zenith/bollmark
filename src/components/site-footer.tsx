export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line bg-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 md:grid-cols-3">
        <div>
          <p className="font-display text-xl uppercase tracking-widest2">Bollmark</p>
          <p className="mt-3 text-sm text-ink/70">
            Ozenle secilmis kumaslar ve zamansiz kesimlerle tasarlanan modern giyim markasi.
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide">Kurumsal</p>
          <ul className="mt-3 space-y-2 text-sm text-ink/70">
            <li>Hakkimizda</li>
            <li>Iade &amp; Degisim</li>
            <li>Kargo Bilgisi</li>
            <li>Gizlilik Politikasi</li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide">Iletisim</p>
          <ul className="mt-3 space-y-2 text-sm text-ink/70">
            <li>destek@bollmark.com</li>
            <li>+90 555 000 00 00</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line py-6 text-center text-xs text-ink/50">
        © {new Date().getFullYear()} Bollmark. Tum haklari saklidir.
      </div>
    </footer>
  );
}
