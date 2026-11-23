"use client";

import { createContext, useContext, useSyncExternalStore } from "react";
import { efsaneActiveAt, kalpPausedAt, type EfsaneWindow } from "@/lib/efsane-cuma";

// Efsane Cuma penceresi layout'tan gelir (ISR). Aktiflik tarayicinin saatiyle
// dakika hassasiyetinde hesaplanir: 00:00'da sayfa yeniden uretilmeden acilir/kapanir.
// Hidrasyonda sunucunun render ani kullanilir (uyumsuzluk ve sayfa zıplaması olmasin).
type Value = { window: EfsaneWindow; renderedAt: number };

const EfsaneContext = createContext<Value | null>(null);

export function EfsaneProvider({ value, children }: { value: Value; children: React.ReactNode }) {
  return <EfsaneContext.Provider value={value}>{children}</EfsaneContext.Provider>;
}

const MINUTE_MS = 60 * 1000;
function subscribe(onTick: () => void) {
  const id = setInterval(onTick, 15 * 1000);
  return () => clearInterval(id);
}
const currentMinute = () => Math.floor(Date.now() / MINUTE_MS) * MINUTE_MS;

export function useEfsaneNow(): number | null {
  const value = useContext(EfsaneContext);
  return useSyncExternalStore(subscribe, currentMinute, () => value?.renderedAt ?? null);
}

export function useEfsane(): { active: boolean; kalpPaused: boolean; window: EfsaneWindow | null } {
  const value = useContext(EfsaneContext);
  const now = useEfsaneNow();
  if (!value || now === null) return { active: false, kalpPaused: false, window: value?.window ?? null };
  return { active: efsaneActiveAt(value.window, now), kalpPaused: kalpPausedAt(value.window, now), window: value.window };
}
