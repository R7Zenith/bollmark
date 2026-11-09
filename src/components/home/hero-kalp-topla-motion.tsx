"use client";

import { useEffect, useState, useSyncExternalStore, type CSSProperties } from "react";
import { Heart } from "lucide-react";
import { useHeroSlideActive } from "./hero-carousel";

// Anasayfa hero'sundaki Kalp Topla slaytinin hareketli parcalari (bkz.
// hero-kalp-topla-slide.tsx): yukselen kalpler + kendi kendine dolan bar.
// Yalniz slayt aktif ve sekme gorunurken calisir. prefers-reduced-motion
// kontrolu bilerek yok (kullanici istegi, 9 Kasim 2026: her halukarda oynasin).

function subscribeVisibility(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

function useRunning() {
  const active = useHeroSlideActive();
  const visible = useSyncExternalStore(subscribeVisibility, () => !document.hidden, () => true);
  return active && visible;
}

// SSR/hydration uyumu icin sabit dizi (Math.random yok). Kalpler metnin
// USTUNDEN gecmesin diye: mobilde metin neredeyse tum genisligi kapliyor,
// kalpler sag kenardan (x: genisligin yuzdesi) yukselir; masaustunde metin
// sutunu ~54-440px, kalpler sol gutter'da ve metinle kisiler arasindaki mavi
// duvarda (dx: px). s: px, d/t: gecikme/sure (sn), w: yatay salinim (px).
const HEARTS = [
  { x: 80, dx: 14, s: 10, d: 0, t: 7, w: 6 },
  { x: 90, dx: 470, s: 14, d: 1.2, t: 6, w: 12 },
  { x: 84, dx: 530, s: 18, d: 2.6, t: 8, w: 16 },
  { x: 94, dx: 590, s: 12, d: 0.6, t: 6.5, w: 12 },
  { x: 78, dx: 500, s: 20, d: 3.4, t: 8.5, w: 16 },
  { x: 88, dx: 620, s: 11, d: 4.1, t: 6, w: 10 },
  { x: 82, dx: 560, s: 15, d: 1.8, t: 7.5, w: 14 },
  { x: 92, dx: 26, s: 9, d: 5, t: 6, w: 6 },
  { x: 86, dx: 485, s: 16, d: 3, t: 7, w: 12 },
  { x: 79, dx: 600, s: 13, d: 5.6, t: 7.8, w: 14 },
  { x: 95, dx: 545, s: 9, d: 4.8, t: 5.8, w: 8 },
  { x: 83, dx: 640, s: 17, d: 2.2, t: 8, w: 16 }
];

export function KalpHeroHearts() {
  const running = useRunning();
  return (
    <div
      aria-hidden="true"
      data-paused={running ? undefined : ""}
      className="hero-hearts pointer-events-none absolute inset-x-0 bottom-0 h-1/2 md:inset-y-0 md:h-full"
    >
      {HEARTS.map((h, i) => (
        <span
          key={i}
          className="hero-heart left-[var(--x)] md:left-[var(--dx)]"
          style={{ "--x": `${h.x}%`, "--dx": `${h.dx}px`, "--dur": `${h.t}s`, "--delay": `${h.d}s`, "--sway": `${h.w}px` } as CSSProperties}
        >
          <Heart size={h.s} className="block fill-badge-sale text-badge-sale" />
        </span>
      ))}
    </div>
  );
}

export function KalpHeroBar({ threshold, discountPercent }: { threshold: number; discountPercent: number }) {
  const running = useRunning();
  // Slayt pasiflesince/sekme gizlenince key degisir, bar sifirdan baslar.
  return <AnimatedBar key={running ? "on" : "off"} running={running} threshold={threshold} discountPercent={discountPercent} />;
}

function AnimatedBar({ running, threshold, discountPercent }: { running: boolean; threshold: number; discountPercent: number }) {
  const [filled, setFilled] = useState(0);

  // Parca parca ~250 ms'de dolar; dolunca ~2 sn bekleyip sifirlanir.
  // Ilk parca, metin girisi bitsin diye biraz daha gec baslar.
  useEffect(() => {
    if (!running) return;
    const delay = filled === 0 ? 700 : filled >= threshold ? 2000 : 250;
    const t = window.setTimeout(() => setFilled((f) => (f >= threshold ? 0 : f + 1)), delay);
    return () => window.clearTimeout(t);
  }, [running, filled, threshold]);

  return <BarView threshold={threshold} filled={filled} discountPercent={discountPercent} />;
}

function BarView({ threshold, filled, discountPercent }: { threshold: number; filled: number; discountPercent: number }) {
  const unlocked = filled >= threshold;
  return (
    <div aria-hidden="true" className="flex w-full max-w-[19rem] items-center gap-3 md:max-w-sm">
      <div className="flex flex-1 gap-1">
        {Array.from({ length: threshold }, (_, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-200 ${i < filled ? "bg-badge-sale" : "bg-cream/25"}`}
          />
        ))}
      </div>
      <div className="flex w-32 shrink-0 items-center">
        {unlocked ? (
          <span className="animate-kalp-pop rounded-full bg-badge-sale px-2.5 py-1 text-[11px] font-medium text-cream">
            %{discountPercent} kilit açıldı
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs tabular-nums text-cream/90">
            {filled}/{threshold}
            <Heart size={12} className="fill-badge-sale text-badge-sale" />
          </span>
        )}
      </div>
    </div>
  );
}
