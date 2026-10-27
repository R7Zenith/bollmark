"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { INSTAGRAM_DM_URL, phoneDisplay, STORE_INFO, whatsappHref } from "@/lib/store-info";
import { trackContact } from "@/lib/meta/track";
import { useConsent } from "@/lib/use-consent";

// WhatsApp ve Instagram DM linkleri - tiklama Meta "Contact" + GA4 "contact"
// gonderir (rızaya bagli, bkz. lib/meta/track.ts). Numara/kullanici adi yalniz
// STORE_INFO'dan okunur.

// brand: marka renkleri (yuzen buton menusu). Gradyan id'si sabit - menu
// sayfada tek oldugu icin cakismaz.
export function InstagramIcon({ size = 18, brand = false }: { size?: number; brand?: boolean }) {
  const color = brand ? "url(#ig-brand-gradient)" : "currentColor";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" aria-hidden="true">
      {brand && (
        <defs>
          <linearGradient id="ig-brand-gradient" x1="3" y1="21" x2="21" y2="3" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#FEDA75" />
            <stop offset="0.3" stopColor="#FA7E1E" />
            <stop offset="0.55" stopColor="#D62976" />
            <stop offset="0.8" stopColor="#962FBF" />
            <stop offset="1" stopColor="#4F5BD5" />
          </linearGradient>
        </defs>
      )}
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill={color} stroke="none" />
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

// WhatsApp logosu, InstagramIcon ile ayni cizgi dilinde (konusma balonu + ahize).
export function WhatsAppIcon({ size = 18, brand = false }: { size?: number; brand?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={brand ? "#25D366" : "currentColor"} strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.5 20.5l1.2-4.3a8.5 8.5 0 1 1 3.1 3.1z" />
      <path d="M9.2 7.8c-.4 0-.9.4-.9 1.2 0 2.9 3.8 6.6 6.6 6.6.8 0 1.2-.5 1.2-.9v-.8l-1.8-.9-.8.8c-1.1-.4-2.1-1.4-2.6-2.6l.8-.8-.9-1.8z" />
    </svg>
  );
}

const WHATSAPP_GREETING = "Merhaba, bilgi almak istiyorum.";

const FLOATING_PILL_CLASS =
  "flex h-10 items-center gap-2 rounded-[50px] border border-cream/60 px-[11px] text-[10px] uppercase tracking-[1.4px] shadow-[0_2px_10px_rgba(0,0,0,0.25)] transition duration-300 hover:bg-cream hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink md:px-4";
const FLOATING_POSITION_CLASS = "fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-40 md:right-6 md:bottom-6";
const MENU_ITEM_CLASS =
  "flex items-center gap-3 px-4 py-3 text-[10px] uppercase tracking-[1.4px] text-ink outline-none transition duration-300 hover:bg-line/60 focus-visible:bg-line/60";

// Sag altta yuzen buton. Odeme (/odeme ve alt sayfalari, tesekkurler dahil)
// akisinda gizli; admin ayri layout'ta oldugu icin orada hic yok. Cerez bandi
// acikken (tercih yok) gizli - bantla ust uste binmez. Footer ekrana girince
// gizlenir (footer'da zaten WhatsApp/Instagram linkleri var).
// WhatsApp aciksa tiklama iki secenekli menuyu acar (acmak olay gondermez,
// secenege tiklamak gonderir); kapaliysa buton dogrudan Instagram DM'e gider.
// Menu dis tiklama, Esc ve sayfa degisince kapanir (openOn: acildigi sayfa).
export function FloatingContactButton() {
  const pathname = usePathname();
  const { consent, ready } = useConsent();
  const [footerVisible, setFooterVisible] = useState(false);
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const footer = document.querySelector("footer");
    if (!footer) return;
    const observer = new IntersectionObserver(([entry]) => setFooterVisible(entry.isIntersecting));
    observer.observe(footer);
    return () => observer.disconnect();
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpenOn(null);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpenOn(null);
      buttonRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (pathname.startsWith("/odeme") || !ready || consent === null || footerVisible) return null;

  if (!STORE_INFO.phone || !STORE_INFO.whatsappActive) {
    return (
      // Acik cerceve + golge: koyu zeminde (footer, koyu gorseller) ink buton
      // kaybolmasin; acik zeminde cerceve gorunmez, ink govde yeterli.
      <InstagramDmLink className={`${FLOATING_POSITION_CLASS} ${FLOATING_PILL_CLASS} bg-ink text-cream`}>
        <InstagramIcon size={16} />
        <span className="sr-only md:not-sr-only">Instagram&apos;dan yaz</span>
      </InstagramDmLink>
    );
  }

  // Ok tuslari / Home / End menude gezer; Tab menuden cikinca kapatir.
  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: items.length - 1 }[e.key];
    if (e.key === "Tab") setOpenOn(null);
    if (next === undefined) return;
    e.preventDefault();
    items[(next + items.length) % items.length]?.focus();
  };

  return (
    <div ref={rootRef} className={FLOATING_POSITION_CLASS}>
      {open && (
        <div
          ref={menuRef}
          id="floating-contact-menu"
          role="menu"
          aria-label="Bize yaz"
          onKeyDown={onMenuKeyDown}
          className="absolute bottom-full right-0 mb-2 min-w-[210px] overflow-hidden rounded-[20px] border border-line bg-cream py-1.5 shadow-[0_2px_10px_rgba(0,0,0,0.25)]"
        >
          <a
            role="menuitem"
            href={whatsappHref(STORE_INFO.phone, WHATSAPP_GREETING)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              trackContact("whatsapp");
              setOpenOn(null);
            }}
            className={MENU_ITEM_CLASS}
          >
            <WhatsAppIcon size={18} brand />
            WhatsApp&apos;tan yaz
          </a>
          <a
            role="menuitem"
            href={INSTAGRAM_DM_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              trackContact("instagram");
              setOpenOn(null);
            }}
            className={MENU_ITEM_CLASS}
          >
            <InstagramIcon size={18} brand />
            Instagram&apos;dan yaz
          </a>
        </div>
      )}
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? "floating-contact-menu" : undefined}
        onClick={() => setOpenOn(open ? null : pathname)}
        className={`${FLOATING_PILL_CLASS} ${open ? "bg-cream text-ink" : "bg-ink text-cream"}`}
      >
        <MessageCircle size={16} strokeWidth={1.5} aria-hidden="true" />
        <span className="sr-only md:not-sr-only">Bize yaz</span>
      </button>
    </div>
  );
}

type ProductInquiry = {
  productName: string;
  color: string | null;
  size: string | null;
  productCode: string;
};

// "Merhaba, ...: <ad> – <renk / beden> – Ürün kodu: <kod> – <URL>"; secilmeyen parca atlanir.
function productInquiryText({ productName, color, size, productCode }: ProductInquiry) {
  const variant = [color, size].filter(Boolean).join(" / ");
  return `Merhaba, bu ürün hakkında bilgi almak istiyorum: ${[productName, variant, `Ürün kodu: ${productCode}`, window.location.href]
    .filter(Boolean)
    .join(" – ")}`;
}

// Urun sayfasi Instagram akisi: urun bilgisini panoya kopyalar, kisa not
// gosterir, DM'i acar. Kopyalama sayfa odaktayken baslatilir, pencere ayni
// tiklamada (await beklemeden) acilir - aksi halde popup engelleyici yeni
// sekmeyi bloklar. Kopyalama basarisiz olsa da DM acilir.
function useAskOnInstagram(product: ProductInquiry) {
  const [copied, setCopied] = useState(false);

  const ask = () => {
    trackContact("instagram", product.productCode);
    navigator.clipboard
      ?.writeText(productInquiryText(product))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 6000);
      })
      .catch(() => {});
    window.open(INSTAGRAM_DM_URL, "_blank", "noopener,noreferrer");
  };

  const note = copied && (
    <p role="status" className="mt-1.5 text-xs text-ink/70">
      Ürün bilgisi kopyalandı, Instagram&apos;da mesaja yapıştırabilirsin
    </p>
  );

  return { ask, note };
}

const ASK_LINK_CLASS =
  "flex items-center gap-1.5 text-ink underline decoration-ink/30 underline-offset-4 transition duration-300 hover:decoration-ink";

// Urun sayfasi: Iade ve Degisim / Bakim / Beden Tablosu satirlarinin altinda,
// ayni dilde bir satir - solda "Sorunuz mu var?", sagda ikonlu WhatsApp ve
// Instagram linkleri. WhatsApp hazir mesajla acilir (wa.me?text=, panoya
// kopyalama yok, pencere ayni tiklamada); Instagram kopyala + DM akisi.
// WhatsApp kapaliysa satirda yalniz Instagram kalir.
export function AskAboutProduct(product: ProductInquiry) {
  const { ask, note } = useAskOnInstagram(product);
  const phone = STORE_INFO.whatsappActive ? STORE_INFO.phone : null;

  const askOnWhatsApp = (phone: string) => {
    trackContact("whatsapp", product.productCode);
    window.open(whatsappHref(phone, productInquiryText(product)), "_blank", "noopener,noreferrer");
  };

  return (
    <div className="border-b border-line py-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <span className="text-[16px] tracking-[-0.64px] text-ink">Sorunuz mu var?</span>
        <span className="flex items-center gap-4 text-xs">
          {phone && (
            <button type="button" onClick={() => askOnWhatsApp(phone)} aria-label="WhatsApp'tan sor" className={ASK_LINK_CLASS}>
              <WhatsAppIcon size={14} />
              WhatsApp
            </button>
          )}
          <button type="button" onClick={ask} aria-label="Instagram'dan sor" className={ASK_LINK_CLASS}>
            <InstagramIcon size={14} />
            Instagram
          </button>
        </span>
      </div>
      {note}
    </div>
  );
}
