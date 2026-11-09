import Image from "next/image";
import Link from "next/link";
import { HeroSlideDeferred } from "./hero-carousel";
import { KalpHeroBar, KalpHeroHearts } from "./hero-kalp-topla-motion";

// Anasayfa hero carousel'inin Kalp Topla slayti (bkz.
// KALP_TOPLA_HERO_CAROUSEL_PLANI.md). Yalniz kampanya LIVE iken eklenir
// (page.tsx). Gorselde kisiler masaustunde sagda, sol taraf bos mavi duvar:
// metin solda dikey ortali. Mobilde kisiler ustte, metin slayt 1 gibi sol-altta.
// Baslik h2: sayfadaki tek h1 ilk slaytta.
export function HeroKalpToplaSlide({ threshold, discountPercent }: { threshold: number; discountPercent: number }) {
  const offer = discountPercent === 50 ? "yarı fiyat" : `%${discountPercent} indirim`;
  return (
    <div className="relative flex min-h-svh items-end overflow-hidden bg-ink text-cream md:items-center">
      <HeroSlideDeferred>
        <Image
          src="/anasayfa/kalp-topla-mobile.jpg"
          alt="Mavi duvar önünde kol kola gülerek yürüyen iki genç kadın"
          fill
          sizes="100vw"
          className="object-cover md:hidden"
          style={{ objectPosition: "50% 30%" }}
        />
        <Image
          src="/anasayfa/kalp-topla-desktop.jpg"
          alt="Mavi duvar önünde kol kola gülerek yürüyen iki genç kadın"
          fill
          sizes="100vw"
          className="hidden object-cover md:block"
          style={{ objectPosition: "75% 30%" }}
        />
      </HeroSlideDeferred>
      <div className="absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-t from-ink/75 via-ink/35 to-transparent md:hidden" />
      <div className="absolute inset-0 hidden bg-gradient-to-r from-ink/70 via-ink/25 to-transparent md:block" />
      <KalpHeroHearts />
      <div className="relative z-10 mx-auto w-full max-w-7xl px-6 pb-14 md:max-w-none md:px-[54px] md:pb-0 md:pt-[72px]">
        <div className="hero-reveal">
          <p className="text-[10px] uppercase tracking-widest2 text-cream/70 md:text-xs">Kalp Topla</p>
        </div>
        <div className="hero-reveal">
          <div>
            <h2 className="mt-2 max-w-[13rem] pb-[0.15em] font-display text-3xl font-light leading-[1.05] md:mt-6 md:max-w-xl md:text-[clamp(3.8125rem,1.7013rem+3.2986vw,5rem)] md:leading-[1.15]">
              {threshold} kalp, <span className="whitespace-nowrap">{offer}</span>
            </h2>
            <div className="mt-3 md:mt-5">
              <KalpHeroBar threshold={threshold} discountPercent={discountPercent} />
            </div>
            <p className="mt-3 max-w-[40ch] text-sm text-cream/80 md:mt-5 md:text-base">
              Beğendiğin ürüne kalp ver, bar dolunca kalp verenler indirimli alsın.
            </p>
          </div>
        </div>
        <div className="hero-reveal">
          <Link
            href="/kalp-topla"
            className="mt-5 inline-flex items-center rounded-full bg-cream px-6 py-2.5 text-xs uppercase tracking-wide text-ink transition hover:bg-clay hover:text-cream md:mt-10 md:border md:border-cream md:bg-transparent md:px-8 md:py-3.5 md:text-sm md:text-cream md:hover:bg-cream md:hover:text-ink"
          >
            Kalp vermeye başla
          </Link>
        </div>
      </div>
    </div>
  );
}
