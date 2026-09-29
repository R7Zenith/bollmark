import type { MetadataRoute } from "next";

const BASE_URL = "https://bollmark.com";

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
        allow: "/",
        // Filtre parametreli URL'ler sinirsiz kombinasyon uretiyor; ?kategori=
        // sitemap'te oldugu icin engellenmiyor.
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
    sitemap: `${BASE_URL}/sitemap.xml`
  };
}
