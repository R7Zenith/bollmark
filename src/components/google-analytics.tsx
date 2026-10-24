"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { initGoogleConsent } from "@/lib/consent";
import { useConsent } from "@/lib/use-consent";
import { flushPendingGa4Events, ga4PageKey, trackGa4PageView } from "@/lib/meta/track";

// gtag config bir kez (rıza geri cekilip yeniden verilse de).
let configured = false;

// Yalniz (site) layout'unda ve GA4 etkinse (production ya da
// NEXT_PUBLIC_GA4_DEBUG, bkz. lib/ga4.ts) render edilir - /admin'de hic yok.
// Consent Mode "temel": gtag.js yalniz analitik rizasi varsa indirilir, rıza
// sonradan verilirse o an yuklenir. Rıza geri cekilince consent.ts saveConsent
// consent update (denied) gonderir ve _ga/_ga_* cerezlerini siler; ga-disable
// bayragi da yuklu kalan gtag.js'in cerezsiz ping dahil hicbir istek atmamasini saglar.
//
// page_view'i biz gondeririz (send_page_view: false) - GA4 web akisinda Gelismis
// olcum > "Tarayici gecmisi olaylarina gore sayfa degisiklikleri" KAPALI olmali,
// yoksa App Router gecisleri iki kez sayilir (bkz. GA4_KURULUM_PLANI.md Adim 3).
export function GoogleAnalytics({ measurementId, debug }: { measurementId: string; debug: boolean }) {
  const { consent } = useConsent();
  const analytics = consent?.analytics === true;
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pageKey = ga4PageKey(pathname, searchParams);
  const lastTrackedPage = useRef<string | null>(null);

  useEffect(() => {
    (window as unknown as Record<string, boolean>)[`ga-disable-${measurementId}`] = !analytics;
    if (!analytics) return;
    if (!configured) {
      configured = true;
      initGoogleConsent();
      window.gtag!("js", new Date());
      window.gtag!("config", measurementId, { send_page_view: false, ...(debug && { debug_mode: true }) });
    }
    if (lastTrackedPage.current !== pageKey) {
      lastTrackedPage.current = pageKey;
      trackGa4PageView();
    }
    // gtag kurulmadan once tetiklenen olaylar (orn. ilk yuklemede view_item).
    flushPendingGa4Events();
  }, [analytics, measurementId, debug, pageKey]);

  if (!analytics) return null;
  return (
    <Script
      id="ga4"
      src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
      strategy="afterInteractive"
    />
  );
}
