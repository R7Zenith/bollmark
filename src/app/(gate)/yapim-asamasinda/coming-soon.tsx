"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type TimeLeft = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

const ZERO: TimeLeft = { days: 0, hours: 0, minutes: 0, seconds: 0 };

function getTimeLeft(targetMs: number): TimeLeft {
  const diff = Math.max(0, targetMs - Date.now());
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1_000)
  };
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

// Serit genisligi (145vw) UST SINIRSIZ (bkz. .cs .ribbon yorumu - 2K/4K
// monitorlerde kenara tam yaslanabilmesi icin max-width kaldirildi), bu
// yuzden tekrar sayisi cok genis ekranlarda (5K/ultra-wide, ~5100px'e
// kadar) bile tek bir ribbon-seq'in gorunur serit genisliginden fazla
// olacak sekilde ayarlandi - aksi halde metin "sagdan bitip" bosluk
// birakiyor, sonra ikinci tur yetisip dolduruyordu (kullanicinin
// bildirdigi hata). 390px'den 5120px'e kadar test edilip dogrulandi.
const MARQUEE_REPEATS = 56;
const MARQUEE_WORD = "Çok Yakında";

// Referanstaki (slink) gibi seridin bazi harflerin ONUNDEN, bazilarinin
// ARKASINDAN gecmesiyle olusan "dokuma" efekti - her harf kendi
// position:relative + z-index'ini tasiyor (bkz. .cs h1 .letter.front/back).
// "front" = seridin onunde (harf tam okunur), "back" = seridin arkasinda
// (serit harfin bir kismini orter).
const WEAVE_ROWS: { word: string; pattern: ("front" | "back")[] }[] = [
  { word: "COMING", pattern: ["back", "front", "front", "back", "front", "back"] },
  { word: "SOON", pattern: ["back", "front", "front", "back"] }
];

const SOCIAL_LINKS = [{ label: "Instagram", href: "https://www.instagram.com/koton.karacabey/" }];

function InstagramGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" />
    </svg>
  );
}

export function ComingSoon({ launchDateMs }: { launchDateMs: number }) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(ZERO);

  useEffect(() => {
    const update = () => setTimeLeft(getTimeLeft(launchDateMs));
    const initial = setTimeout(update, 0);
    const id = setInterval(update, 1000);
    return () => {
      clearTimeout(initial);
      clearInterval(id);
    };
  }, [launchDateMs]);

  return (
    <div className="cs">
      <style>{`
        .cs {
          --bg: #f1ede4;
          --ink: #141414;
          --muted: #9a9690;
          --lemon: #d9df8c;
          --line: rgba(20,20,20,0.14);
          /* h1 ile serit kalinligi/pozisyonu ayni degiskene bagli - boylece
             oran her ekran genisliginde ayni kalir (bkz. asagidaki .ribbon
             ve .ribbon-item yorumu, mobilde seridin COMING/SOON'u orandan
             fazla kapatmasi sorunu). */
          --h1-size: clamp(48px, 13vw, 120px);
          position: relative;
          min-height: 100vh;
          min-height: 100dvh;
          background-color: var(--bg);
          color: var(--ink);
          font-family: var(--bm-coming-font-body), system-ui, sans-serif;
          overflow-x: hidden;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .cs, .cs * { box-sizing: border-box; }

        .cs .grain {
          position: fixed;
          inset: 0;
          pointer-events: none;
          opacity: 0.5;
          mix-blend-mode: multiply;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0, 0 0 0 0 0, 0 0 0 0 0, 0 0 0 0.06 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-repeat: repeat;
        }

        .cs .top {
          position: relative;
          z-index: 1;
          width: 100%;
          display: flex;
          justify-content: center;
          padding: 32px 24px 0;
        }
        .cs .wordmark {
          font-family: var(--bm-coming-font-display), sans-serif;
          font-weight: 600;
          font-size: 15px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--ink);
          text-decoration: none;
        }

        .cs .hero {
          position: relative;
          z-index: 1;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: clamp(28px, 6vw, 56px) 0 clamp(56px, 11vw, 150px);
        }
        .cs h1 {
          margin: 0;
          text-align: center;
          font-family: var(--bm-coming-font-display), sans-serif;
          font-weight: 600;
          text-transform: uppercase;
          line-height: 0.92;
          letter-spacing: -0.015em;
          font-size: var(--h1-size);
        }
        .cs h1 .row {
          display: block;
          overflow: hidden;
        }
        /* Referanstaki (slink) gibi serit tum satirin ARKASINDAN degil,
           harf harf ONDEN/ARKADAN geciyor (ör. C arkada, O onde, M onde,
           I arkada...) - z-index artik satir degil TEK TEK HARF
           seviyesinde. Harfler position:static kalan .row/h1 icinde
           konumlandirilmis (position:relative) oldugu icin z-index'leri
           yine .hero'nun stacking context'inde ribbon-wrap (z-index:2) ile
           dogru sekilde kiyaslaniyor. */
        .cs h1 .letter {
          display: inline-block;
          position: relative;
          opacity: 0;
          transform: translateY(0.5em);
          animation: csRise 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        .cs h1 .letter.front { z-index: 3; }
        .cs h1 .letter.back { z-index: 1; }
        @keyframes csRise {
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .cs h1 .letter { animation: none; opacity: 1; transform: none; }
        }

        /* Serit -8deg dondurulmus oldugu icin tam ekran genisliginde bile
           kucuk aci uzun kenar boyunca buyuk bir dikey sapma yaratiyor
           (genislik * sin(8deg)) - sarma kutusu bu sapmayi tam
           karsilamayacak kadar kisa olursa (ör. sadece bandin kendi
           yuksekligi kadar) serit ortadan sivri/badem seklinde kirpiliyor.
           Kirpma kutusunun yuksekligi bu geometriye gore olceklenmeli.

           Dikey konum, hero'nun toplam kutusunun %50'si (top:50%) DEGIL,
           doğrudan satirlarin kendi olcumlerinden hesaplaniyor: hero'nun
           padding-top'u + h1 font-size'inin (line-height * 1.0) kati -
           yani TAM COMING/SOON dikisi (1 satir = line-height 0.92). Serit
           harf harf dokuma efekti verebilmesi icin COMING'in alt kismina
           VE SOON'un ust kismina esit sekilde girmesi lazim (referanstaki
           gibi) - onceki 1.12 degeri seridi neredeyse tamamen SOON'un
           icine itiyordu, COMING'e hic dokunmuyordu, bu da harf bazli
           on/arka farkinin COMING'de gorunmemesine yol aciyordu. */
        .cs .ribbon-wrap {
          position: absolute;
          left: 0;
          right: 0;
          top: calc(clamp(28px, 6vw, 56px) + var(--h1-size) * 1);
          transform: translateY(-50%);
          height: calc(16vw + 60px);
          max-height: 340px;
          z-index: 2;
          overflow: hidden;
          pointer-events: none;
        }
        /* 2K/4K monitorlerde (1920px+) serit viewport kenarina tam
           yaslanabilsin diye genislik ust siniri YOK - vw ile sinirsiz
           buyuyor (bkz. bounding-box olcumleri: 2560px genislikte
           max-width:2200px varken seridin solunda/saginda ~188px bos
           krem alan kaliyordu, kullanici ekran goruntusunde yakaladi).
           Bunun yerine "metin sagdan bitip bosluk birakiyor" bugini
           MARQUEE_REPEATS'i (bkz. yukarida) cok genis ekranlari da
           (4K/ultra-wide, ~5600px'e kadar) kapsayacak sekilde
           buyuterek cozduk - genislik sinirlamasi yerine icerik fazlasi. */
        .cs .ribbon {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 145vw;
          transform: translate(-50%, -50%) rotate(-8deg);
          background: var(--lemon);
          /* Kalinlik artik sabit px degil, --h1-size'a orantili (~%4) -
             boylece mobildeki kucuk basligin ustunde serit orantisiz
             kalin durmuyor, desktop'taki gorunumle ayni oranda kaliyor
             (kullanicinin bildirdigi "mobilde serit COMING SOON'u fazla
             kapatiyor" sorunu). */
          padding: clamp(3px, calc(var(--h1-size) * 0.045), 8px) 0;
          pointer-events: auto;
        }
        /* Kullanicinin acik talebiyle: marquee prefers-reduced-motion'a
           bakmaksizin her zaman akiyor (yalnizca giris fade animasyonu
           erisilebilirlik icin durduruluyor, bkz. yukaridaki csRise blogu). */
        .cs .ribbon-track {
          display: flex;
          width: max-content;
          animation: csMarquee 22s linear infinite;
          will-change: transform;
        }
        .cs .ribbon-seq {
          display: flex;
          flex-shrink: 0;
        }
        .cs .ribbon-item {
          flex-shrink: 0;
          font-family: var(--bm-coming-font-display), sans-serif;
          font-weight: 500;
          font-size: clamp(11px, calc(var(--h1-size) * 0.16), 19px);
          letter-spacing: 0.01em;
          color: #141414;
          padding: 0 1.1em;
          white-space: nowrap;
        }
        @keyframes csMarquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }

        .cs .countdown-label {
          position: relative;
          z-index: 1;
          font-size: 12px;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          color: var(--muted);
          margin: 0 0 18px;
        }
        .cs .countdown {
          position: relative;
          z-index: 1;
          display: flex;
          gap: clamp(10px, 3vw, 22px);
          padding: 0 20px;
        }
        .cs .unit {
          display: flex;
          flex-direction: column;
          align-items: center;
          min-width: 64px;
        }
        .cs .unit strong {
          font-family: var(--bm-coming-font-display), sans-serif;
          font-weight: 600;
          font-size: clamp(28px, 6vw, 48px);
          letter-spacing: -0.01em;
          line-height: 1;
          font-variant-numeric: tabular-nums;
        }
        .cs .unit span {
          margin-top: 6px;
          font-size: 11px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--muted);
        }

        .cs .divider {
          position: relative;
          z-index: 1;
          width: 56px;
          height: 1px;
          background: var(--line);
          margin: clamp(36px, 6vw, 56px) 0 clamp(28px, 5vw, 40px);
        }

        .cs .about {
          position: relative;
          z-index: 1;
          max-width: 460px;
          text-align: center;
          padding: 0 28px;
        }
        .cs .about .eyebrow {
          font-size: 11px;
          letter-spacing: 0.24em;
          text-transform: uppercase;
          color: var(--muted);
          margin: 0 0 14px;
        }
        .cs .about p {
          margin: 0;
          font-size: 15px;
          line-height: 1.7;
          color: var(--ink);
        }

        .cs .socials {
          position: relative;
          z-index: 1;
          display: flex;
          gap: 10px;
          margin: clamp(28px, 5vw, 40px) 0 clamp(24px, 4vw, 36px);
        }
        .cs .socials a {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          border: 1px solid var(--line);
          color: var(--ink);
          opacity: 0.82;
          transition: opacity 0.25s ease, transform 0.25s ease;
        }
        .cs .socials a:hover,
        .cs .socials a:focus-visible {
          opacity: 1;
          transform: scale(1.08);
        }

        .cs .copyright {
          position: relative;
          z-index: 1;
          margin: 0 0 clamp(20px, 4vw, 32px);
          font-size: 11px;
          letter-spacing: 0.06em;
          color: var(--muted);
        }
      `}</style>

      <div className="grain" aria-hidden="true" />

      <div className="top">
        <Link className="wordmark" href="/">
          Bollmark
        </Link>
      </div>

      <div className="hero">
        <h1>
          {WEAVE_ROWS.map((row, rowIndex) => (
            <span className="row" key={row.word}>
              {row.word.split("").map((letter, letterIndex) => (
                <span
                  key={letterIndex}
                  className={`letter ${row.pattern[letterIndex]}`}
                  style={{ animationDelay: `${0.05 + rowIndex * 0.17 + letterIndex * 0.025}s` }}
                >
                  {letter}
                </span>
              ))}
            </span>
          ))}
        </h1>

        <div className="ribbon-wrap">
          <div className="ribbon">
            <div className="ribbon-track">
              {Array.from({ length: 2 }).map((_, seqIndex) => (
                <div className="ribbon-seq" key={seqIndex} aria-hidden={seqIndex === 1}>
                  {Array.from({ length: MARQUEE_REPEATS }).map((_, itemIndex) => (
                    <span className="ribbon-item" key={itemIndex}>
                      {MARQUEE_WORD}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <p className="countdown-label">Lansmana kalan süre</p>
      <div className="countdown" role="timer" aria-live="polite">
        <div className="unit">
          <strong>{pad(timeLeft.days)}</strong>
          <span>Gün</span>
        </div>
        <div className="unit">
          <strong>{pad(timeLeft.hours)}</strong>
          <span>Saat</span>
        </div>
        <div className="unit">
          <strong>{pad(timeLeft.minutes)}</strong>
          <span>Dakika</span>
        </div>
        <div className="unit">
          <strong>{pad(timeLeft.seconds)}</strong>
          <span>Saniye</span>
        </div>
      </div>

      <div className="divider" />

      <div className="about">
        <p className="eyebrow">Bollmark Hakkında</p>
        <p>
          Bollmark, özenle seçilmiş kumaşlar ve minimal kesimlerle gündelik giyimde sade ve kendine
          has bir alışveriş deneyimi sunuyor. Yeni sitemizi sizin için hazırlıyoruz.
        </p>
      </div>

      <div className="socials">
        {SOCIAL_LINKS.map((social) => (
          <a key={social.href} href={social.href} target="_blank" rel="noreferrer noopener" aria-label={social.label}>
            <InstagramGlyph />
          </a>
        ))}
      </div>

      <p className="copyright">© {new Date().getFullYear()} Bollmark. Tüm hakları saklıdır.</p>
    </div>
  );
}
