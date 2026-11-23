"use client";

import { efsaneActiveAt, EFSANE_RED, type EfsaneWindow } from "@/lib/efsane-cuma";
import { useEfsaneNow } from "./efsane-context";

// /efsane-cuma durum notu: sayfa ISR'da oldugu icin tarayici saatiyle secilir.
export function EfsaneDurum({ window }: { window: EfsaneWindow }) {
  const now = useEfsaneNow();
  if (now === null) return null;
  const ended = now > new Date(window.endsAt).getTime();
  const text = efsaneActiveAt(window, now)
    ? "Kampanya şu an geçerli."
    : ended
      ? "Kampanya sona erdi."
      : now < new Date(window.startsAt).getTime()
        ? "Kampanya henüz başlamadı."
        : "Kampanya şu an geçerli değil.";
  return (
    <p className="mt-6 border px-4 py-3 text-sm font-semibold" style={{ borderColor: EFSANE_RED, color: EFSANE_RED }}>
      {text}
    </p>
  );
}
