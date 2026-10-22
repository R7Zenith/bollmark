"use client";

import { useSyncExternalStore } from "react";

const MINUTE_MS = 60 * 1000;

// Dakikada bir yenilenen saat. Anlik deger dakikaya yuvarlanir ki
// useSyncExternalStore ayni dakika icinde hep ayni snapshot'i gorsun.
function subscribe(onTick: () => void) {
  const id = setInterval(onTick, 15 * 1000);
  return () => clearInterval(id);
}
const currentMinute = () => Math.floor(Date.now() / MINUTE_MS) * MINUTE_MS;
// Sunucuda (ve hidrasyonda) null: sayfa ISR ile onbellekte durdugu icin
// sunucu saatiyle hesaplanan sure yanlis olurdu; sayac yalniz tarayicida cizilir.
const serverMinute = () => null;

// Kampanya bandindaki geri sayim. endsAt: kampanyanin son gununun Istanbul
// saatiyle 23:59:59'u (bkz. page.tsx). Sure dolunca kendini gizler.
export function CampaignCountdown({ endsAt }: { endsAt: string }) {
  const now = useSyncExternalStore(subscribe, currentMinute, serverMinute);
  if (now === null) return null;
  const left = new Date(endsAt).getTime() - now;
  if (left <= 0) return null;

  const minutes = Math.floor(left / MINUTE_MS);
  const parts = [
    { value: Math.floor(minutes / (24 * 60)), label: "gün" },
    { value: Math.floor(minutes / 60) % 24, label: "saat" },
    { value: minutes % 60, label: "dakika" }
  ];

  return (
    <div className="mt-8">
      <p className="text-xs text-cream/70">Kampanyanın bitmesine</p>
      <dl className="mt-3 flex justify-center gap-6 md:gap-10">
        {parts.map((p) => (
          <div key={p.label} className="flex flex-col-reverse items-center">
            <dt className="mt-1 text-[10px] font-medium uppercase tracking-[0.1em] text-cream/70">{p.label}</dt>
            <dd className="font-display text-3xl font-light tabular-nums md:text-4xl">
              {String(p.value).padStart(2, "0")}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
