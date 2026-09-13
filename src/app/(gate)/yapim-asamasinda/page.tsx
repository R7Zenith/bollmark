import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import localFont from "next/font/local";
import { ComingSoon } from "./coming-soon";

// Fontshare'den self-host edilen "General Sans" - referans tasarimdaki
// (slink-nextjs demo-4) ince/orta kalinlikta, yuvarlak harflerde (O/C/G)
// hafif duzlesmis gorunumlu geometrik baslik fontuna en yakin ucretsiz
// alternatif. Google Fonts'ta karsiligi yok, bu yuzden dosyalar
// ./fonts altinda yerel olarak barindiriliyor (next/font/local).
const generalSans = localFont({
  src: [
    { path: "./fonts/GeneralSans-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/GeneralSans-Semibold.woff2", weight: "600", style: "normal" }
  ],
  variable: "--bm-coming-font-display"
});

const poppins = Poppins({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  variable: "--bm-coming-font-body"
});

export const metadata: Metadata = {
  title: "BOLLMARK — Çok yakında",
  description:
    "Yeni sitemizi sizin için hazırlıyoruz. Bollmark, gündelik giyimde sade ve kendine has bir alışveriş deneyimiyle yakında burada."
};

// NEXT_PUBLIC_LAUNCH_DATE tanimli degilse (ör. yerel gelistirme) bugunden
// 30 gun sonrasina duser - kullanicinin belirledigi varsayilan.
const DEFAULT_LAUNCH_DATE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

export default function YapimAsamasindaPage() {
  const launchDateIso = process.env.NEXT_PUBLIC_LAUNCH_DATE || DEFAULT_LAUNCH_DATE;
  const launchDateMs = new Date(launchDateIso).getTime();

  return (
    <div className={`${generalSans.variable} ${poppins.variable}`}>
      <ComingSoon launchDateMs={launchDateMs} />
    </div>
  );
}
