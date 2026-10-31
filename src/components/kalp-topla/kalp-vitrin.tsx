"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, X } from "lucide-react";
import { campaignPitch, campaignSlogan, campaignStripText } from "@/lib/kalp-topla/messages";
import { useConsent } from "@/lib/use-consent";
import { useKalpDurumDetay } from "./use-kalp-durum";
import { KalpDialog } from "./kalp-dialog";

// Duyuru seridi ve ilk ziyaret penceresi (KALP_TOPLA_PLANI.md 6.9). Yalniz ACTIVE
// durumda gorunur: durum istemcide cozuldugu icin ISR gizli yayini sizdirmaz.
const SKIP_PATHS = ["/kalp-topla", "/odeme", "/hesap"];
const STRIP_KEY = "bm_kalp_serit";
const INTRO_KEY = "bm_kalp_tanitim";
const STRIP_HIDE_MS = 7 * 24 * 60 * 60 * 1000;
const INTRO_DELAY_MS = 1200;

function stripDismissed() {
  try {
    const closedAt = Number(localStorage.getItem(STRIP_KEY));
    return closedAt > 0 && Date.now() - closedAt < STRIP_HIDE_MS;
  } catch {
    return false;
  }
}

function dismissStrip() {
  try {
    localStorage.setItem(STRIP_KEY, String(Date.now()));
  } catch {
    // Kayit yazilamazsa serit yalniz bu sayfada kapanir.
  }
}

// Depolama yoksa "bir kez" sozu tutulamaz: pencere hic acilmaz.
function claimIntro() {
  try {
    if (localStorage.getItem(INTRO_KEY)) return false;
    localStorage.setItem(INTRO_KEY, "1");
    return true;
  } catch {
    return false;
  }
}

export function KalpVitrin() {
  const durum = useKalpDurumDetay();
  const pathname = usePathname();
  if (durum?.state !== "ACTIVE") return null;
  if (SKIP_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) return null;
  return (
    <>
      <KalpSerit text={campaignStripText(durum.threshold, durum.discountPercent)} />
      <KalpTanitim threshold={durum.threshold} discountPercent={durum.discountPercent} pathname={pathname} />
    </>
  );
}

// Header'in altina biner, sayfayla kayar: icerigi itmez, gec gelse de sayfa zipmaz.
function KalpSerit({ text }: { text: { short: string; long: string } }) {
  const [closed, setClosed] = useState(stripDismissed);
  if (closed) return null;
  return (
    <div data-kalp-serit className="absolute inset-x-0 top-[72px] z-30 flex h-8 items-center justify-center border-b border-sale/15 bg-[#FFF1F4] text-ink">
      <Link href="/kalp-topla" className="flex h-full items-center gap-1.5 whitespace-nowrap pl-2 pr-9 text-[12px] leading-none md:px-10 md:text-[13px]">
        <Heart size={13} className="shrink-0 fill-sale text-sale" aria-hidden="true" />
        <span className="md:hidden">{text.short}</span>
        <span className="hidden md:inline">{text.long}</span>
        <span className="hidden underline underline-offset-2 md:inline">Nasıl mı?</span>
      </Link>
      <button
        type="button"
        aria-label="Duyuruyu kapat"
        onClick={() => {
          dismissStrip();
          setClosed(true);
        }}
        className="absolute right-1 top-0 flex h-full w-9 items-center justify-center text-ink/60 hover:text-ink"
      >
        <X size={15} aria-hidden="true" />
      </button>
    </div>
  );
}

// Cerez tercihi verilmeden acilmaz (bant ile ayni anda gorunmesin); baska panel
// ya da cekmece aciksa o sayfada beklenir, sonraki sayfada yeniden denenir.
function KalpTanitim({ threshold, discountPercent, pathname }: { threshold: number; discountPercent: number; pathname: string }) {
  const { consent } = useConsent();
  const [open, setOpen] = useState(false);
  const hasConsent = consent !== null;

  useEffect(() => {
    if (!hasConsent) return;
    const timer = setTimeout(() => {
      if (document.body.style.overflow !== "hidden" && claimIntro()) setOpen(true);
    }, INTRO_DELAY_MS);
    return () => clearTimeout(timer);
  }, [hasConsent, pathname]);

  return (
    <KalpDialog open={open} onClose={() => setOpen(false)} title={campaignSlogan(threshold, discountPercent)}>
      <div className="flex justify-between rounded-xl bg-[#FFF1F4] px-3 py-3" aria-hidden="true">
        {Array.from({ length: Math.min(threshold, 10) }, (_, i) => (
          <Heart key={i} strokeWidth={1.6} className={`h-6 w-6 ${i < 7 ? "fill-sale text-sale" : "text-ink/25"}`} />
        ))}
      </div>
      <p className="mt-3 text-sm text-ink/70">{campaignPitch(threshold, discountPercent)}</p>
      <div className="mt-5 flex items-center gap-5">
        <Link
          href="/kalp-topla"
          onClick={() => setOpen(false)}
          className="rounded-full bg-ink px-6 py-3.5 text-center text-[11px] uppercase tracking-[1px] text-white hover:bg-ink/90"
        >
          Nasıl çalışır?
        </Link>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-ink/60 underline underline-offset-4 hover:text-ink">
          Şimdi değil
        </button>
      </div>
    </KalpDialog>
  );
}
