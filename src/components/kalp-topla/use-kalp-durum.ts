"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import type { KalpCampaignState } from "@/lib/kalp-topla/settings";

// Kalp Topla gorunurlugu istemcide oturuma gore cozulur (plan 5.0): ISR
// onbellekli sayfalar gizli yayini sizdirmasin diye. Ayni oturum icin sayfa
// basina tek istek; INVISIBLE (404) null doner. undefined = henuz bilinmiyor.
const cache = new Map<string, Promise<KalpCampaignState | null>>();

function fetchDurum(key: string) {
  let promise = cache.get(key);
  if (!promise) {
    promise = fetch("/api/kalp-topla/durum", { cache: "no-store" })
      .then(async (res) => (res.ok ? ((await res.json()).state as KalpCampaignState) : null))
      .catch(() => null);
    cache.set(key, promise);
  }
  return promise;
}

export function useKalpDurum(): KalpCampaignState | null | undefined {
  const { data, status } = useSession();
  const key = status === "loading" ? null : (data?.user?.id ?? "misafir");
  const [resolved, setResolved] = useState<{ key: string; state: KalpCampaignState | null } | null>(null);

  useEffect(() => {
    if (!key) return;
    let alive = true;
    fetchDurum(key).then((state) => {
      if (alive) setResolved({ key, state });
    });
    return () => {
      alive = false;
    };
  }, [key]);

  return resolved && resolved.key === key ? resolved.state : undefined;
}
