"use client";

import { Fragment, type ReactNode } from "react";
import { visibleSlides, type HomeSlideData } from "@/lib/home-slides";
import { useEfsane, useEfsaneNow } from "@/components/efsane-cuma/efsane-context";
import { HeroCarousel } from "./hero-carousel";
import { HomeSlideView } from "./home-slide";

// Anasayfa hero'su: hangi slaytin gorunecegine tarayici saatiyle dakika
// hassasiyetinde karar verilir (sayfa ISR ile 1 saat onbellekte kalabilir).
// Hidrasyonda sunucunun render ani kullanilir (Efsane ile ayni saat, bkz.
// efsane-context.tsx) - uyumsuzluk olmaz. Gizlenen slayt nokta birakmaz.
// kalpSlide: Kalp Topla slayti (server bileseni), yalniz kampanya LIVE iken verilir.
export function HomeHero({ slides, kalpSlide }: { slides: HomeSlideData[]; kalpSlide: ReactNode | null }) {
  const now = useEfsaneNow();
  const { kalpPaused } = useEfsane();
  if (now === null) return null;
  const visible = visibleSlides(slides, now, { live: kalpSlide !== null, paused: kalpPaused });
  if (visible.length === 0) return null;
  return (
    <HeroCarousel darkSlides={visible.map((s) => s.kind === "TEXT_OVERLAY" && s.textTone === "DARK")}>
      {visible.map((slide, i) =>
        slide.kind === "KALP_TOPLA" ? (
          <Fragment key={slide.id}>{kalpSlide}</Fragment>
        ) : (
          <HomeSlideView key={slide.id} slide={slide} first={i === 0} />
        )
      )}
    </HeroCarousel>
  );
}
