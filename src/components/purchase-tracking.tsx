"use client";

import { useEffect } from "react";
import { trackPurchase, type Ga4Purchase } from "@/lib/meta/track";

// Tesekkurler sayfasinda (odeme dogrulanmissa) Meta Pixel Purchase + GA4 purchase.
// Meta event_id sunucudaki CAPI Purchase ile ayni (bkz. lib/meta/capi.ts).
export function PurchaseTracking({
  orderNumber,
  metaData,
  ga4Data
}: {
  orderNumber: string;
  metaData: Record<string, unknown> | null;
  ga4Data: Ga4Purchase | null;
}) {
  useEffect(() => {
    trackPurchase(orderNumber, metaData, ga4Data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderNumber]);
  return null;
}
