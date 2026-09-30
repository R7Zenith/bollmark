import type { Metadata } from "next";
import { Suspense } from "react";
import { Poppins, Cormorant } from "next/font/google";
import "../globals.css";
import { CartProvider } from "@/lib/cart";
import { WishlistProvider } from "@/lib/wishlist";
import { CustomerSessionProvider } from "@/components/customer-session-provider";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getMegaMenuData } from "@/lib/site-nav";
import { baseOpenGraph, siteIcons } from "@/lib/site-metadata";
import { getSiteUrl } from "@/lib/site-url";

// Shopify "Release" temasi referansi: tek govde/baslik fontu Poppins
// (400-600 agirlik - 600 katalog karti urun basligi icin, bkz.
// KATALOG_ROZET_HOVER_PLANI.md 7 ve product-card.tsx). Cumle icinde tek tek
// vurgulanan kelimeler icin (ornegin bir basligin bir kelimesi <em> ile)
// ikinci, italik serif font: Cormorant. Turkce karakterler (ç, ğ, ı, ö, ş, ü)
// icin latin-ext alt kumesi de dahil edildi.
const poppins = Poppins({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-poppins",
  display: "swap"
});
const cormorant = Cormorant({
  subsets: ["latin", "latin-ext"],
  weight: ["500"],
  style: ["italic"],
  variable: "--font-cormorant",
  display: "swap"
});

// title.template alt sayfalarin basligina " | Bollmark" ekler - sayfalarda elle
// yazilmaz. metadataBase goreli canonical/OG adreslerini tam adrese cevirir.
export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: { default: "Bollmark | Modern Giyim", template: "%s | Bollmark" },
  description:
    "Bollmark - özenle seçilmiş kumaşlar, minimal kesimler. Sezonun öne çıkan giyim parçaları.",
  icons: siteIcons,
  openGraph: baseOpenGraph,
  twitter: { card: "summary_large_image" },
  // Google Merchant Center site dogrulamasi (bollmark.com, HTML etiketi).
  verification: { google: "NIBZYEzJhd5qSu63XhW18W53Dt6QA9SSfGwy214ZDsk" }
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const menuData = await getMegaMenuData();

  return (
    <html lang="tr" className={`${poppins.variable} ${cormorant.variable}`}>
      <body className="storefront flex min-h-screen flex-col font-sans antialiased">
        <CustomerSessionProvider>
          <CartProvider>
            <WishlistProvider>
              {/* BUILD HATASI (13 Eylul 2026): SiteHeader `useSearchParams()`
                  kullaniyor (banner/saydam header kontrolu icin, bkz.
                  site-header.tsx) - Next.js 16 statik sayfa uretiminde bu bir
                  Suspense siniri icinde olmadan kullanilirsa build'i hata ile
                  durduruyor ("should be wrapped in a suspense boundary").
                  Vercel build log'unda /hesap/adreslerim'de patladi ama kok
                  neden layout'taki bu bilesen oldugu icin ayni build
                  siradaki her (site) sayfasini (belki hepsini) etkiliyordu -
                  tek tek her sayfaya `export const dynamic` eklemek yerine
                  kaynagi burada Suspense'e aliyoruz. */}
              <Suspense fallback={<div className="h-[72px]" />}>
                <SiteHeader menuData={menuData} />
              </Suspense>
              {/* flex-1: hukuki/yasal sayfalar gibi kisa icerikli sayfalarda
                  govde viewport'u doldurmuyordu, footer yukari yapisip altta
                  bosluk birakiyordu - main'i esneterek footer'i her zaman
                  sayfanin en altina sabitliyoruz. */}
              <main className="flex-1">{children}</main>
              <SiteFooter />
            </WishlistProvider>
          </CartProvider>
        </CustomerSessionProvider>
      </body>
    </html>
  );
}
