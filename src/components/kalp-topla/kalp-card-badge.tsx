"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Heart } from "lucide-react";
import { useKalpDurum } from "./use-kalp-durum";

// Katalog karti rozeti (plan 6.2): sayfadaki kartlarin urun kimlikleri
// toplanir, 60'arli tek istekle /api/kalp-topla/barlar'dan alinir. Kartta
// kalp verme butonu yoktur; yalniz points > 0 ise rozet gorunur.
type Bar = { points: number; threshold: number };

const bars = new Map<string, Bar | null>();
const queued = new Set<string>();
const listeners = new Set<() => void>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let version = 0;

function notify() {
  version += 1;
  for (const listener of listeners) listener();
}

async function flush() {
  flushTimer = null;
  const ids = [...queued].sort();
  queued.clear();
  for (let i = 0; i < ids.length; i += 60) {
    const chunk = ids.slice(i, i + 60);
    try {
      const res = await fetch(`/api/kalp-topla/barlar?ids=${chunk.join(",")}`);
      const data = res.ok ? ((await res.json()) as { bars: (Bar & { productId: string })[] }) : { bars: [] };
      for (const id of chunk) bars.set(id, null);
      for (const bar of data.bars) bars.set(bar.productId, { points: bar.points, threshold: bar.threshold });
    } catch {
      for (const id of chunk) bars.set(id, null);
    }
  }
  notify();
}

function request(productId: string) {
  if (bars.has(productId) || queued.has(productId)) return;
  queued.add(productId);
  flushTimer ??= setTimeout(flush, 50);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function KalpCardBadge({ productId }: { productId: string }) {
  const state = useKalpDurum();
  const active = state === "ACTIVE";
  useSyncExternalStore(subscribe, () => version, () => 0);

  useEffect(() => {
    if (active) request(productId);
  }, [active, productId]);

  const bar = active ? bars.get(productId) : null;
  if (!bar) return null;
  const near = bar.threshold - bar.points <= 2;
  return (
    <span
      className={`absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium tabular-nums leading-none sm:bottom-3 sm:left-3 ${
        near ? "bg-sale text-white" : "bg-white/95 text-ink"
      }`}
      title={`Kalp Topla: ${bar.points}/${bar.threshold} kalp`}
    >
      <Heart size={11} fill="currentColor" className={near ? "" : "text-sale"} aria-hidden="true" />
      {bar.points}/{bar.threshold}
    </span>
  );
}
