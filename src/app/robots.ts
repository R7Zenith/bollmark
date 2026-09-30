import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";


// Yapay zeka egitim/arama tarayicilari: 30 Eylul 2026'da meta-externalagent
// /_next/image'e binlerce istek atip Vercel gorsel limitini doldurdu.
// Googlebot, Bingbot ve link onizleme botlari (facebookexternalhit,
// Twitterbot, WhatsApp) bilerek listede yok.
const AI_BOTS = [
  "meta-externalagent",
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "anthropic-ai",
  "CCBot",
  "Google-Extended",
  "PerplexityBot",
  "Bytespider",
  "Amazonbot",
  "Applebot-Extended"
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        // Urun sayfasindaki ?renk= varyant adresidir (urun JSON-LD'sindeki
        // hasVariant url'leri) - Google'da daha uzun kural kazandigi icin
        // asagidaki "/*?*renk=" filtre engelini urun sayfalarinda asar.
        allow: ["/", "/urunler/*?renk="],
        // Katalog filtre parametreli URL'ler sinirsiz kombinasyon uretiyor.
        // Kategoriler artik temiz yollarda (/erkek/gomlek, /kategori/ayakkabi).
        disallow: [
          "/admin",
          "/hesap",
          "/odeme",
          "/api/",
          "/sepet",
          "/*?*renk=",
          "/*?*beden=",
          "/*?*fiyat-min=",
          "/*?*fiyat-max=",
          "/*?*stok=",
          "/*?*indirimli=",
          "/*?*ara="
        ]
      },
      { userAgent: AI_BOTS, disallow: "/" }
    ],
    sitemap: `${getSiteUrl()}/sitemap.xml`
  };
}
