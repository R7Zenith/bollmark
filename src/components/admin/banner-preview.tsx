"use client";

import { useEffect, useState } from "react";
import type { HomeSlideData } from "@/lib/home-slides";
import { HomeSlideView } from "@/components/home/home-slide";

type Message = { slide: HomeSlideData; guides: boolean; frame: "desktop" | "mobile" };

// Guvenli alan (plan bolum 2): masaustu ust/alt %15, yanlar %8; mobil ust %15, alt %8, yanlar %5.
const SAFE = {
  desktop: { top: "15%", bottom: "15%", left: "8%", right: "8%" },
  mobile: { top: "15%", bottom: "8%", left: "5%", right: "5%" }
};

// Panel formundan postMessage ile gelen slayti magazadaki bilesenle cizer.
export function BannerPreview() {
  const [data, setData] = useState<Message | null>(null);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.data?.type !== "banner-onizleme") return;
      setData({ slide: e.data.slide, guides: e.data.guides, frame: e.data.frame });
    };
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: "banner-onizleme-hazir" }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  if (!data) return null;
  const { slide, guides, frame } = data;
  const hasImage = Boolean(slide.desktopImageUrl);

  return (
    <div className="relative min-h-svh overflow-hidden bg-ink">
      {hasImage ? (
        <HomeSlideView slide={slide} first />
      ) : (
        <div className="flex min-h-svh items-center justify-center text-3xl text-cream/50">Masaüstü görseli yükleyin</div>
      )}
      {guides && (
        <div className="pointer-events-none absolute inset-0 z-30 text-[13px] font-medium text-white">
          {/* Ustte kampanya seridi (32px, kampanya varken) + menu (72px). */}
          <div className="absolute inset-x-0 top-0 flex h-8 items-center justify-center bg-[#D0021B]/60">Kampanya şeridi</div>
          <div className="absolute inset-x-0 top-8 flex h-[72px] items-center justify-center border-b-2 border-white/80 bg-black/35">
            Menü
          </div>
          {/* Slayt noktalari + durdur/oynat (karusel altinda ~56px). */}
          <div className="absolute inset-x-0 bottom-0 flex h-14 items-center justify-center border-t-2 border-white/80 bg-black/35">
            Slayt noktaları
          </div>
          <div className="absolute border-[3px] border-dashed border-yellow-300" style={SAFE[frame]} />
        </div>
      )}
    </div>
  );
}
