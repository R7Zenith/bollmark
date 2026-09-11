import type { Metadata } from "next";
import "../globals.css";
import { CartProvider } from "@/lib/cart";
import { WishlistProvider } from "@/lib/wishlist";
import { CustomerSessionProvider } from "@/components/customer-session-provider";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getMegaMenuData } from "@/lib/site-nav";
import { siteIcons } from "@/lib/site-metadata";

export const metadata: Metadata = {
  title: "Bollmark | Modern Giyim",
  description:
    "Bollmark - özenle seçilmiş kumaşlar, minimal kesimler. Sezonun öne çıkan giyim parçaları.",
  icons: siteIcons
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const menuData = await getMegaMenuData();

  return (
    <html lang="tr">
      <body className="font-sans antialiased">
        <CustomerSessionProvider>
          <CartProvider>
            <WishlistProvider>
              <SiteHeader menuData={menuData} />
              <main>{children}</main>
              <SiteFooter />
            </WishlistProvider>
          </CartProvider>
        </CustomerSessionProvider>
      </body>
    </html>
  );
}
