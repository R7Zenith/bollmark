"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { INSTAGRAM_DM_URL, phoneDisplay, STORE_INFO, whatsappHref } from "@/lib/store-info";
import { trackContact } from "@/lib/meta/track";
import { useConsent } from "@/lib/use-consent";

// WhatsApp ve Instagram DM linkleri - tiklama Meta "Contact" + GA4 "contact"
// gonderir (rızaya bagli, bkz. lib/meta/track.ts). Numara/kullanici adi yalniz
// STORE_INFO'dan okunur.

export function InstagramIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Numara yalniz WhatsApp icin; STORE_INFO.whatsappActive false iken hic render edilmez.
export function WhatsAppLink({ className }: { className?: string }) {
  if (!STORE_INFO.phone || !STORE_INFO.whatsappActive) return null;
  return (
    <a
      href={whatsappHref(STORE_INFO.phone)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackContact("whatsapp")}
      className={className}
    >
      WhatsApp: {phoneDisplay(STORE_INFO.phone)}
    </a>
  );
}

export function InstagramDmLink({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <a
      href={INSTAGRAM_DM_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackContact("instagram")}
      className={className}
    >
      {children}
    </a>
  );
}

// Sag altta yuzen buton. Odeme (/odeme ve alt sayfalari, tesekkurler dahil)
// akisinda gizli; admin ayri layout'ta oldugu icin orada hic yok. Cerez bandi
// acikken (tercih yok) gizli - bantla ust uste binmez. Footer ekrana girince
// gizlenir (footer'da zaten Instagram linki var).
export function FloatingInstagramButton() {
  const pathname = usePathname();
  const { consent, ready } = useConsent();
  const [footerVisible, setFooterVisible] = useState(false);

  useEffect(() => {
    const footer = document.querySelector("footer");
    if (!footer) return;
    const observer = new IntersectionObserver(([entry]) => setFooterVisible(entry.isIntersecting));
    observer.observe(footer);
    return () => observer.disconnect();
  }, [pathname]);

  if (pathname.startsWith("/odeme") || !ready || consent === null || footerVisible) return null;

  return (
    // Acik cerceve + golge: koyu zeminde (footer, koyu gorseller) ink buton
    // kaybolmasin; acik zeminde cerceve gorunmez, ink govde yeterli.
    <InstagramDmLink className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-40 flex h-10 items-center gap-2 rounded-[50px] border border-cream/60 bg-ink px-[11px] text-[10px] uppercase tracking-[1.4px] text-cream shadow-[0_2px_10px_rgba(0,0,0,0.25)] transition duration-300 hover:bg-cream hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink md:right-6 md:bottom-6 md:px-4">
      <InstagramIcon size={16} />
      <span className="sr-only md:not-sr-only">Instagram&apos;dan yaz</span>
    </InstagramDmLink>
  );
}

// Urun sayfasi: urun bilgisini panoya kopyalar, kisa not gosterir, DM'i acar.
// Kopyalama sayfa odaktayken baslatilir, pencere ayni tiklamada (await
// beklemeden) acilir - aksi halde popup engelleyici yeni sekmeyi bloklar.
// Kopyalama basarisiz olsa da DM acilir.
export function AskOnInstagramButton({
  productName,
  color,
  size,
  productCode
}: {
  productName: string;
  color: string | null;
  size: string | null;
  productCode: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleClick = () => {
    const variant = [color, size].filter(Boolean).join(" / ");
    const text = `Merhaba, bu ürün hakkında bilgi almak istiyorum: ${[productName, variant, `Ürün kodu: ${productCode}`, window.location.href]
      .filter(Boolean)
      .join(" – ")}`;
    trackContact("instagram", productCode);
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 6000);
      })
      .catch(() => {});
    window.open(INSTAGRAM_DM_URL, "_blank", "noopener,noreferrer");
  };

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        className="flex h-[46px] w-full items-center justify-center gap-2 rounded-[50px] border border-line bg-transparent text-[10px] uppercase tracking-[1.4px] text-ink transition duration-300 hover:border-ink"
      >
        <InstagramIcon size={16} />
        Instagram&apos;dan sor
      </button>
      {copied && (
        <p role="status" className="mt-2 text-center text-xs text-ink/70">
          Ürün bilgisi kopyalandı, Instagram&apos;da mesaja yapıştırabilirsin
        </p>
      )}
    </div>
  );
}
