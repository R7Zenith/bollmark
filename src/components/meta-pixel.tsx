"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useConsent } from "@/lib/use-consent";
import { flushPendingMetaEvents, trackPageView } from "@/lib/meta/track";

declare global {
  interface Window {
    _fbq?: unknown;
  }
}

type FbqStub = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[];
  push: FbqStub;
  loaded: boolean;
  version: string;
  disablePushState?: boolean;
};

// Meta'nin resmi kurulum kodundaki fbq kuyrugu: fbevents.js yuklenene kadar
// cagrilar kuyruga girer.
function installFbq(pixelId: string) {
  if (window.fbq) return;
  const fbq = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue.push(args);
  } as FbqStub;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.queue = [];
  // App Router gecislerinde PageView'i biz gonderiyoruz - Pixel'in kendi
  // pushState takibi acik kalirsa her gecis iki kez sayilir.
  fbq.disablePushState = true;
  window.fbq = fbq;
  window._fbq = fbq;
  fbq("init", pixelId);
}

const FBC_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

// Reklamdan ?fbclid= ile gelindiyse Meta'nin bekledigi _fbc cerezi:
// fb.1.<olusturma zamani ms>.<fbclid>
function storeFbclid() {
  const fbclid = new URLSearchParams(location.search).get("fbclid");
  if (!fbclid) return;
  const current = document.cookie.match(/(?:^|; )_fbc=([^;]*)/)?.[1];
  if (current?.endsWith(`.${fbclid}`)) return;
  const host = location.hostname;
  // Pixel _fbc'yi kok alan adina yazar; ayni cerez iki kez olusmasin.
  const domain = host.includes(".") && !/^[\d.]+$/.test(host) ? `; Domain=.${host.replace(/^www\./, "")}` : "";
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `_fbc=fb.1.${Date.now()}.${fbclid}; Max-Age=${FBC_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${domain}${secure}`;
}

// Yalniz (site) layout'unda ve takip etkinse (production ya da test kodu)
// render edilir - /admin'de hic yok. Script yalniz pazarlama rizasi varsa
// indirilir; rıza sonradan verilirse o an yuklenir. Rıza geri cekilince
// consent.ts saveConsent fbq('consent','revoke') cagirir ve _fbp/_fbc'yi siler.
export function MetaPixel({ pixelId }: { pixelId: string }) {
  const { consent } = useConsent();
  const marketing = consent?.marketing === true;
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const url = `${pathname}?${searchParams.toString()}`;
  const lastTrackedUrl = useRef<string | null>(null);

  useEffect(() => {
    if (!marketing) return;
    installFbq(pixelId);
    storeFbclid();
    if (lastTrackedUrl.current !== url) {
      lastTrackedUrl.current = url;
      trackPageView();
    }
    // Pixel kurulmadan once tetiklenen olaylar (orn. ilk yuklemede ViewContent).
    flushPendingMetaEvents();
  }, [marketing, pixelId, url]);

  if (!marketing) return null;
  return <Script id="meta-pixel" src="https://connect.facebook.net/en_US/fbevents.js" strategy="afterInteractive" />;
}
