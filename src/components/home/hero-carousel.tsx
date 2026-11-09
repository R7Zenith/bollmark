"use client";

import {
  Children,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode
} from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";

// Anasayfa hero carousel'i (bkz. KALP_TOPLA_HERO_CAROUSEL_PLANI.md). Slayt
// icerikleri server'da hazirlanip children olarak gelir. Tek slayt varsa
// hicbir kontrol/otomatik gecis render edilmez, duz statik hero gibi davranir.
// Otomatik gecis 6 sn; klavye odagi icerideyken bekler, kullanici
// kaydirinca/ok-noktaya basinca tamamen durur (yalniz Oynat ile yeniden
// baslar). Fare ustundeyken DURMAZ ve prefers-reduced-motion kontrolu
// bilerek yok (kullanici istegi, 9 Kasim 2026: her halukarda oynasin).
const AUTOPLAY_MS = 6000;
// Ilk slayt disindaki slaytlarin gorselleri ilk yuklemede (LCP'ye rakip
// olarak) inmesin: hydration'dan bu kadar sonra ya da ilk etkilesimde render
// edilir - 6 sn'lik otomatik gecisten once hazir olurlar.
const WARM_MS = 2500;

const SlideContext = createContext({ active: true, warm: true });

// Slayt icindeki client parcalar (orn. Kalp Topla animasyonu) kendi
// slaytlarinin aktif olup olmadigini buradan okur.
export function useHeroSlideActive() {
  return useContext(SlideContext).active;
}

// Slaytin gorsellerini sarar; ertelenen slaytta "isinana" kadar render etmez.
export function HeroSlideDeferred({ children }: { children: ReactNode }) {
  return useContext(SlideContext).warm ? <>{children}</> : null;
}

export function HeroCarousel({ children }: { children: ReactNode }) {
  const slides = Children.toArray(children);
  if (slides.length <= 1) return <>{slides}</>;
  return <Carousel slides={slides} />;
}

function Carousel({ slides }: { slides: ReactNode[] }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const [selected, setSelected] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [focused, setFocused] = useState(false);
  const [warm, setWarm] = useState(false);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelected(emblaApi.selectedScrollSnap());
    const onPointerDown = () => setPlaying(false);
    emblaApi.on("select", onSelect).on("reInit", onSelect).on("pointerDown", onPointerDown);
    return () => {
      emblaApi.off("select", onSelect).off("reInit", onSelect).off("pointerDown", onPointerDown);
    };
  }, [emblaApi]);

  useEffect(() => {
    const t = window.setTimeout(() => setWarm(true), WARM_MS);
    return () => window.clearTimeout(t);
  }, []);

  // Her slayta tam 6 sn: selected degisince zamanlayici bastan kurulur.
  useEffect(() => {
    if (!emblaApi || !playing || focused) return;
    const t = window.setTimeout(() => {
      if (emblaApi.canScrollNext()) emblaApi.scrollNext();
      else emblaApi.scrollTo(0);
    }, AUTOPLAY_MS);
    return () => window.clearTimeout(t);
  }, [emblaApi, playing, focused, selected]);

  const goTo = useCallback(
    (index: number) => {
      setPlaying(false);
      emblaApi?.scrollTo(index);
    },
    [emblaApi]
  );

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Öne çıkanlar"
      className="relative"
      onPointerEnter={() => setWarm(true)}
      onPointerDown={() => setWarm(true)}
      onFocus={(e) => {
        setWarm(true);
        if (!e.target.closest("[data-hero-playpause]")) setFocused(true);
      }}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setFocused(false)}
    >
      <div ref={emblaRef} className="overflow-hidden">
        <div className="flex" aria-live={playing ? "off" : "polite"}>
          {slides.map((slide, i) => {
            const active = i === selected;
            return (
              <div
                key={i}
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} / ${slides.length}`}
                inert={!active}
                data-hero-inactive={active ? undefined : ""}
                className="min-w-0 shrink-0 grow-0 basis-full"
              >
                <SlideContext.Provider value={{ active, warm: warm || i === 0 }}>{slide}</SlideContext.Provider>
              </div>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          setPlaying(false);
          emblaApi?.scrollPrev();
        }}
        aria-label="Önceki slayt"
        className="absolute left-4 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center text-cream transition-opacity hover:opacity-60 md:flex"
      >
        <ChevronLeft size={32} strokeWidth={1.25} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => {
          setPlaying(false);
          emblaApi?.scrollNext();
        }}
        aria-label="Sonraki slayt"
        className="absolute right-4 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center text-cream transition-opacity hover:opacity-60 md:flex"
      >
        <ChevronRight size={32} strokeWidth={1.25} aria-hidden="true" />
      </button>

      {/* Noktalar + durdur/oynat ortada tek satir: sag-alt kose "Bize yaz"
          sohbet butonunun altinda kaliyordu. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex items-center justify-center md:bottom-5">
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => goTo(i)}
            aria-label={`${i + 1}. slayta git`}
            aria-current={i === selected ? "true" : undefined}
            className="pointer-events-auto p-1.5"
          >
            <span
              className={`block h-1.5 rounded-full transition-all duration-300 ${
                i === selected ? "w-6 bg-cream" : "w-1.5 bg-cream/50"
              }`}
            />
          </button>
        ))}
        <button
          type="button"
          data-hero-playpause=""
          onClick={() => setPlaying(!playing)}
          aria-label={playing ? "Otomatik geçişi durdur" : "Otomatik geçişi başlat"}
          className="pointer-events-auto ml-1 flex h-8 w-8 items-center justify-center text-cream/80 transition hover:text-cream"
        >
          {playing ? (
            <Pause size={14} strokeWidth={1.5} aria-hidden="true" />
          ) : (
            <Play size={14} strokeWidth={1.5} aria-hidden="true" />
          )}
        </button>
      </div>
    </section>
  );
}
