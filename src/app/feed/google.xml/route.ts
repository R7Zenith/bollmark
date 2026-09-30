import { buildGoogleMerchantFeed } from "@/lib/merchant-feed";

// Google Merchant Center urun feed'i: /feed/google.xml. Saatte bir yeniden
// uretilir - Merchant Center feed'i gunde birkac kez ceker, her istekte DB'ye
// gidip Vercel fonksiyon kullanimini artirmasin.
export const revalidate = 3600;

export async function GET() {
  return new Response(await buildGoogleMerchantFeed(), {
    headers: { "Content-Type": "application/xml; charset=utf-8" }
  });
}
