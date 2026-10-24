"use client";

import { useEffect } from "react";
import { trackPurchase } from "@/lib/meta/track";

// Tesekkurler sayfasinda (odeme dogrulanmissa) Pixel Purchase - event_id
// sunucudaki CAPI Purchase ile ayni (bkz. lib/meta/capi.ts).
export function MetaPurchase({ orderNumber, customData }: { orderNumber: string; customData: Record<string, unknown> }) {
  useEffect(() => {
    trackPurchase(orderNumber, customData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderNumber]);
  return null;
}
