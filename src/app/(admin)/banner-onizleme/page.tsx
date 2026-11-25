import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { BannerPreview } from "@/components/admin/banner-preview";

// Panelin banner onizleme cercevesi (iframe icinde, bkz. banner-form.tsx).
// Yalniz yoneticiye acik (proxy.ts). Magaza fontu site layout'uyla ayni ayarla.
const poppins = Poppins({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-poppins",
  display: "swap"
});

export const metadata: Metadata = { title: "Banner önizleme", robots: { index: false, follow: false } };

export default function BannerPreviewPage() {
  return (
    <div className={`storefront ${poppins.variable}`} style={{ ["--font-sans" as string]: "var(--font-poppins), system-ui, sans-serif" }}>
      <BannerPreview />
    </div>
  );
}
