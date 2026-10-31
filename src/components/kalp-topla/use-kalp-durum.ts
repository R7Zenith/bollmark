"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import type { KalpCampaignState } from "@/lib/kalp-topla/settings";

// Kalp Topla gorunurlugu istemcide oturuma gore cozulur (plan 5.0): ISR
// onbellekli sayfalar gizli yayini sizdirmasin diye. Ayni oturum icin sayfa
// basina tek istek; INVISIBLE (404) null doner. undefined = henuz bilinmiyor.
export type KalpDurum = { state: KalpCampaignState; threshold: number; discountPercent: number };

const cache = new Map<string, Promise<KalpDurum | null>>();

function fetchDurum(key: string) {
  let promise = cache.get(key);
  if (!promise) {
    promise = fetch("/api/kalp-topla/durum", { cache: "no-store" })
      .then(async (res) => (res.ok ? ((await res.json()) as KalpDurum) : null))
      .catch(() => null);
    cache.set(key, promise);
  }
  return promise;
}

export function useKalpDurumDetay(): KalpDurum | null | undefined {
  const { data, status } = useSession();
  const key = status === "loading" ? null : (data?.user?.id ?? "misafir");
  const [resolved, setResolved] = useState<{ key: string; durum: KalpDurum | null } | null>(null);

  useEffect(() => {
    if (!key) return;
    let alive = true;
    fetchDurum(key).then((durum) => {
      if (alive) setResolved({ key, durum });
    });
    return () => {
      alive = false;
    };
  }, [key]);

  return resolved && resolved.key === key ? resolved.durum : undefined;
}

export function useKalpDurum(): KalpCampaignState | null | undefined {
  const durum = useKalpDurumDetay();
  return durum === undefined ? undefined : (durum?.state ?? null);
}
