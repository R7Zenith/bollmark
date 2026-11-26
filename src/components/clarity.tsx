"use client";

import { useEffect } from "react";
import Script from "next/script";
import { CLARITY_PROJECT_ID, clarity } from "@/lib/clarity";
import { useEfsane } from "@/components/efsane-cuma/efsane-context";

// Yalniz (site) layout'unda render edilir - /admin ve (gate) ayri kok layout'larda,
// orada hic yok. Rizadan bagimsiz (bkz. lib/clarity.ts). lazyOnload: betik sayfa
// yuklendikten sonra tarayici bosta iken iner (bkz. docs/reklam/clarity-kurulum-raporu.md).
export function Clarity() {
  const { active } = useEfsane();

  useEffect(() => {
    if (active) clarity("set", "kampanya", "muhtesem-kasim");
  }, [active]);

  if (!CLARITY_PROJECT_ID) return null;
  return <Script id="clarity" src={`https://www.clarity.ms/tag/${CLARITY_PROJECT_ID}`} strategy="lazyOnload" />;
}
