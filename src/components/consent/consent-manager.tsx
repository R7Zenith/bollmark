"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { CONSENT_OPEN_EVENT } from "@/lib/consent";
import { useConsent } from "@/lib/use-consent";

// Bant + tercih paneli ayri bir JS parcasinda: tercihi zaten kayitli
// ziyaretcide hic indirilmez, yalniz bant gosterilecekse veya footer'dan
// "Cerez Tercihleri" acilinca yuklenir. SSR yok - sunucuda hesaplama yok.
const CookieBanner = dynamic(() => import("./cookie-banner"), { ssr: false });

// Yalniz (site) layout'unda kullanilir; /admin ve yapim-asamasinda ayri
// layout'larda oldugu icin bant oralarda hic yok.
export function ConsentManager() {
  const { consent, ready } = useConsent();
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  useEffect(() => {
    const open = () => setPreferencesOpen(true);
    window.addEventListener(CONSENT_OPEN_EVENT, open);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, open);
  }, []);

  const showBar = ready && consent === null;
  // Bir kez yuklendikten sonra mount'ta kalir - aksi halde panel kapanirken
  // (preferencesOpen=false) cikis animasyonu oynamadan kaybolurdu.
  const [loaded, setLoaded] = useState(false);
  if ((showBar || preferencesOpen) && !loaded) setLoaded(true);
  if (!loaded && !showBar && !preferencesOpen) return null;

  return (
    <CookieBanner
      showBar={showBar}
      current={consent}
      preferencesOpen={preferencesOpen}
      onPreferencesOpenChange={setPreferencesOpen}
    />
  );
}
