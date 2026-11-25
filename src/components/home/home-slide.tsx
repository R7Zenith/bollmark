import Link from "next/link";
import type { CSSProperties } from "react";
import type { HomeSlideData } from "@/lib/home-slides";
import { CampaignCountdown } from "./campaign-countdown";
import { HeroSlideDeferred } from "./hero-carousel";

// Panelden yonetilen anasayfa hero slayti (bkz. ANASAYFA_BANNER_YONETIMI_PLANI.md).
// Iki tur: "Yazili gorsel" (yazi gorselin icinde, tum slayt tiklanir) ve
// "Gorsel + site yazisi" (etiket/baslik/aciklama/buton HTML olarak basilir).
// CENTER hizasi eski sabit sezon hero'sunun duzeni (mobilde sol-alt, masaustunde
// orta-alt), LEFT Kalp Topla slaytinin duzeni (masaustunde sol, dikey orta) -
// siniflar oradan birebir alindi; ayrintili gerekceleri page.tsx gecmisinde.
// Baslik h2: sayfanin tek h1'i page.tsx'te sabit ve gorunmez.

// Gorsel <picture> ile: md (768px) ve ustunde masaustu, altinda mobil kaynak -
// images.unoptimized oldugu icin yalniz ekrana uyan dosya iner. Ilk slayt LCP
// adayi (eager + yuksek oncelik); digerleri HeroSlideDeferred ile hydration'dan
// sonra render edilir, kayarak gelirken bos gorunmesin diye onlar da eager.
function SlidePicture({ slide, first, alt }: { slide: HomeSlideData; first: boolean; alt: string }) {
  const style = { "--focus-m": slide.mobileFocus, "--focus-d": slide.desktopFocus } as CSSProperties;
  return (
    <picture>
      {slide.mobileImageUrl && <source media="(min-width: 768px)" srcSet={slide.desktopImageUrl} />}
      <img
        src={slide.mobileImageUrl ?? slide.desktopImageUrl}
        alt={alt}
        loading="eager"
        fetchPriority={first ? "high" : undefined}
        decoding={first ? "sync" : "async"}
        className="absolute inset-0 h-full w-full object-cover object-[var(--focus-m)] md:object-[var(--focus-d)]"
        style={style}
      />
    </picture>
  );
}

// Karartma: LIGHT tonda koyu, DARK tonda krem perde. MEDIUM eski sezon hero'sununki.
const OVERLAY: Record<string, string> = {
  "LIGHT:MEDIUM": "bg-gradient-to-r from-ink/70 via-ink/20 to-transparent",
  "LIGHT:LIGHT": "bg-gradient-to-r from-ink/50 via-ink/10 to-transparent",
  "DARK:MEDIUM": "bg-gradient-to-r from-cream/80 via-cream/30 to-transparent",
  "DARK:LIGHT": "bg-gradient-to-r from-cream/60 via-cream/10 to-transparent"
};

export function HomeSlideView({ slide, first }: { slide: HomeSlideData; first: boolean }) {
  if (slide.kind === "IMAGE_ONLY") {
    return (
      <div className="relative min-h-svh overflow-hidden bg-ink">
        <HeroSlideDeferred>
          {/* Baglanti varsa ad (alt metin) baglantida; gorsel tekrar okunmasin. */}
          <SlidePicture slide={slide} first={first} alt={slide.href ? "" : slide.altText} />
        </HeroSlideDeferred>
        {slide.href && <Link href={slide.href} aria-label={slide.altText} className="absolute inset-0 z-10" />}
      </div>
    );
  }

  const dark = slide.textTone === "DARK";
  const center = slide.textAlign === "CENTER";
  const overlay = OVERLAY[`${slide.textTone}:${slide.overlay}`];
  const muted = dark ? "text-ink/70" : "text-cream/70";
  return (
    <div
      className={`relative flex min-h-svh items-end overflow-hidden ${dark ? "bg-cream text-ink" : "bg-ink text-cream"} ${
        center ? "md:items-end" : "md:items-center"
      }`}
    >
      <HeroSlideDeferred>
        <SlidePicture slide={slide} first={first} alt={slide.altText} />
      </HeroSlideDeferred>
      {overlay && <div className={`absolute inset-0 ${overlay}`} />}
      {/* Acik gorselde header (saydam, beyaz yazi) okunabilsin diye ustte hafif koyu gecis. */}
      {dark && <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-ink/35 to-transparent" />}
      <div
        className={`relative z-10 mx-auto w-full max-w-7xl px-6 pb-14 md:max-w-none md:px-[54px] ${
          center ? "md:pb-16 md:pt-[97px] md:text-center" : "md:pb-0 md:pt-[72px]"
        }`}
      >
        {slide.eyebrow && (
          <div className="hero-reveal">
            <p className={`text-[10px] uppercase tracking-widest2 ${muted} md:text-xs`}>{slide.eyebrow}</p>
          </div>
        )}
        <div className="hero-reveal">
          <div>
            {slide.title && (
              <h2
                className={`mt-2 max-w-[13rem] pb-[0.15em] font-display text-3xl font-light leading-[1.05] md:mt-6 md:text-[clamp(3.8125rem,1.7013rem+3.2986vw,5rem)] md:leading-[1.15] ${
                  center ? "md:mx-auto md:max-w-3xl" : "md:max-w-xl"
                }`}
              >
                {slide.title}
              </h2>
            )}
            {slide.subtitle && (
              <p
                className={`mt-3 max-w-[40ch] text-sm md:mt-5 md:text-base ${dark ? "text-ink/80" : "text-cream/80"} ${
                  center ? "md:mx-auto" : ""
                }`}
              >
                {slide.subtitle}
              </p>
            )}
            {slide.showCountdown && slide.endsAt && (
              <CampaignCountdown
                endsAt={slide.endsAt}
                listClassName={center ? "justify-start md:justify-center" : "justify-start"}
                mutedClassName={muted}
              />
            )}
          </div>
        </div>
        {slide.href && slide.buttonLabel && (
          <div className="hero-reveal">
            <Link
              href={slide.href}
              className={
                dark
                  ? "mt-5 inline-flex items-center rounded-full bg-ink px-6 py-2.5 text-xs uppercase tracking-wide text-cream transition hover:bg-clay md:mt-10 md:px-8 md:py-3.5 md:text-sm"
                  : "mt-5 inline-flex items-center rounded-full bg-cream px-6 py-2.5 text-xs uppercase tracking-wide text-ink transition hover:bg-clay hover:text-cream md:mt-10 md:border md:border-cream md:bg-transparent md:px-8 md:py-3.5 md:text-sm md:text-cream md:hover:bg-cream md:hover:text-ink"
              }
            >
              {slide.buttonLabel}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
