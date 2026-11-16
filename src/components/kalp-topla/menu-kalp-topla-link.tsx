"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { useKalpDurumDetay } from "./use-kalp-durum";

// Ust menunun sonundaki animasyonlu "Kalp Topla" linki (MENU_KALP_TOPLA_BUTONU_VE_TREND_PLANI.md).
// Yalniz ACTIVE iken gorunur; durum istemcide cozuldugu icin ISR'li header gizli
// yayini sizdirmaz. Animasyonlar globals.css'te (km- onekli), yalniz CSS.
const SPARKS = [0, 60, 120, 180, 240, 300];

export function MenuKalpToplaLink({
  transparent,
  className,
  onClick
}: {
  transparent: boolean;
  className: string;
  onClick?: () => void;
}) {
  const durum = useKalpDurumDetay();
  if (durum?.state !== "ACTIVE") return null;
  return (
    <Link href="/kalp-topla" onClick={onClick} className={`km-link ${className}`}>
      <span className="relative inline-flex h-[1.3em] w-[1.3em] shrink-0 items-center justify-center" aria-hidden="true">
        {SPARKS.map((angle) => (
          <span key={angle} className="km-spark" style={{ "--a": `${angle}deg` } as CSSProperties} />
        ))}
        <Heart className="km-beat h-full w-full fill-sale text-sale" strokeWidth={1.5} />
      </span>
      <span className={`km-text ${transparent ? "km-text-light" : ""}`}>Kalp Topla</span>
    </Link>
  );
}
