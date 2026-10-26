import { buildMerchantFeed } from "@/lib/merchant-feed";

// Meta (Facebook/Instagram) katalog feed'i: /feed/meta.xml. Google feed'iyle ayni
// mantik; farklar lib/merchant-feed.ts'te (bkz. META_KATALOG_PLANI.md). Saatte bir
// yeniden uretilir - Commerce Manager gunde bir ceker.
export const revalidate = 3600;

export async function GET() {
  return new Response(await buildMerchantFeed("meta"), {
    headers: { "Content-Type": "application/xml; charset=utf-8" }
  });
}
