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
import { siteIcons } from "@/lib/site-metadata";

// Shopify "Release" temasi referansi: tek govde/baslik fontu Poppins
// (400-500 agirlik). Cumle icinde tek tek vurgulanan kelimeler icin
// (ornegin bir basligin bir kelimesi <em> ile) ikinci, italik serif font:
// Cormorant. Turkce karakterler (ç, ğ, ı, ö, ş, ü) icin latin-ext alt
// kumesi de dahil edildi.
const poppins = Poppins({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
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

export const metadata: Metadata = {
  title: "Bollmark | Modern Giyim",
  description:
    "Bollmark - özenle seçilmiş kumaşlar, minimal kesimler. Sezonun öne çıkan giyim parçaları.",
  icons: siteIcons
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const menuData = await getMegaMenuData();

  return (
    <html lang="tr" className={`${poppins.variable} ${cormorant.variable}`}>
      <body className="storefront font-sans antialiased">
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
              <main>{children}</main>
              <SiteFooter />
            </WishlistProvider>
          </CartProvider>
        </CustomerSessionProvider>
      </body>
    </html>
  );
}
