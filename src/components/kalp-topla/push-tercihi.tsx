"use client";

import { useEffect, useState } from "react";
import { currentPushSubscription, pushSupported, subscribePush, unsubscribePush } from "@/lib/kalp-topla/push-client";
import { CONSENT_TEXTS } from "@/lib/kalp-topla/consent-texts";
import { useKalpDurum } from "./use-kalp-durum";

// Iletisim tercihleri push satiri (KALP_TOPLA_PLANI.md 6.5): yalniz destekleyen
// tarayicida gorunur. Kaydet'i beklemez, tarayici izni tiklamayla istenir.
export function PushTercihi() {
  const state = useKalpDurum();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!state || !pushSupported()) return;
    let alive = true;
    currentPushSubscription()
      .then((subscription) => {
        if (alive) setEnabled(Boolean(subscription));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [state]);

  if (enabled === null) return null;

  const change = async (next: boolean) => {
    setBusy(true);
    setNote(null);
    if (next) {
      const result = await subscribePush();
      if (result === "ok") setEnabled(true);
      else setNote(result === "denied" ? "Bildirim izni kapalı. Tarayıcı ayarlarından izin verebilirsin." : "Bildirimler açılamadı, tekrar dene.");
    } else {
      await unsubscribePush();
      setEnabled(false);
    }
    setBusy(false);
  };

  return (
    <label className="flex items-start gap-3 text-sm text-ink/80">
      <input
        type="checkbox"
        checked={enabled}
        disabled={busy}
        onChange={(e) => change(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0"
      />
      <span>
        {CONSENT_TEXTS.PUSH.text}
        {note && <span className="block text-xs text-sale">{note}</span>}
      </span>
    </label>
  );
}
