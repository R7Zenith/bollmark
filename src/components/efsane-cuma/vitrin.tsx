"use client";

import Link from "next/link";
import { formatExactPrice } from "@/lib/format";
import { EFSANE_PATH, EFSANE_RED, efsaneHalfCents, type EfsaneWindow } from "@/lib/efsane-cuma";
import { CampaignCountdown } from "@/components/home/campaign-countdown";
import { useEfsane } from "./efsane-context";

// Efsane Cuma vitrin yazilari: yalniz kampanya suresince (tarayici saatiyle) gorunur.

const dayMonth = (iso: string) =>
  new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "long", timeZone: "Europe/Istanbul" }).split(" ");

// "26–29 Kasım" (ayni ay) ya da "30 Kasım – 2 Aralık".
export function efsaneDateRange(window: EfsaneWindow): string {
  const [startDay, startMonth] = dayMonth(window.startsAt);
  const [endDay, endMonth] = dayMonth(window.endsAt);
  return startMonth === endMonth ? `${startDay}–${endDay} ${endMonth}` : `${startDay} ${startMonth} – ${endDay} ${endMonth}`;
}

// Her sayfanin en ustunde sabit serit; gorunurken header 32px asagi iner (site-header.tsx).
export function EfsaneSerit() {
  const { active, window } = useEfsane();
  if (!active || !window) return null;
  const range = efsaneDateRange(window);
  return (
    <Link
      href={EFSANE_PATH}
      data-efsane-serit
      className="fixed inset-x-0 top-0 z-[41] flex h-8 items-center justify-center overflow-hidden whitespace-nowrap px-3 text-[11px] font-semibold text-white md:text-[13px]"
      style={{ backgroundColor: EFSANE_RED }}
    >
      <span className="md:hidden">MUHTEŞEM KASIM: 2. ürüne %50 indirim — {range}</span>
      <span className="hidden md:inline">MUHTEŞEM KASIM: Tüm ürünlerde 2. ürüne %50 indirim — {range}</span>
    </Link>
  );
}

// Urun karti (fiyatin alti) ve urun sayfasi (size="lg", kosullar baglantisiyla).
export function EfsaneFiyatYazisi({ priceCents, size = "card" }: { priceCents: number; size?: "card" | "lg" }) {
  const { active } = useEfsane();
  if (!active) return null;
  const lg = size === "lg";
  return (
    <div className={lg ? "mt-3" : "mt-1 px-2 md:px-0"} style={{ color: EFSANE_RED }}>
      <p className={`font-bold ${lg ? "text-base" : "text-[12px] leading-[15px]"}`}>2. Ürüne %50 İndirim</p>
      <p className={`font-semibold ${lg ? "text-sm" : "text-[11px] leading-[14px]"}`}>
        2. ürün olarak {formatExactPrice(efsaneHalfCents(priceCents))}
      </p>
      {lg && (
        <Link href={EFSANE_PATH} className="mt-1 inline-block text-xs text-ink/60 underline underline-offset-2 hover:text-ink">
          Kampanya koşulları
        </Link>
      )}
    </div>
  );
}

// Ana sayfanin en ustundeki genis bant (header saydam: hero gibi ustune biner).
export function EfsaneAnasayfaBandi() {
  const { active, window } = useEfsane();
  if (!active || !window) return null;
  return (
    <section
      data-nosnippet
      className="px-6 pb-12 pt-[128px] text-center text-white md:pb-16 md:pt-[152px]"
      style={{ backgroundColor: EFSANE_RED }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/80 md:text-xs">Muhteşem Kasım · {efsaneDateRange(window)}</p>
      <h2 className="mx-auto mt-4 max-w-3xl font-display text-4xl font-semibold leading-[1.05] tracking-[-0.03em] md:text-7xl">
        Tüm ürünlerde 2. ürüne %50 indirim
      </h2>
      <CampaignCountdown endsAt={window.endsAt} />
      <div className="mt-8 flex flex-col items-center gap-3">
        <Link
          href="/urunler"
          className="inline-flex items-center rounded-full bg-white px-8 py-3.5 text-sm font-semibold uppercase tracking-wide text-ink transition hover:bg-ink hover:text-white"
        >
          Alışverişe başla
        </Link>
        <Link href={EFSANE_PATH} className="text-xs text-white/80 underline underline-offset-2 hover:text-white">
          Kampanya koşulları
        </Link>
      </div>
    </section>
  );
}
