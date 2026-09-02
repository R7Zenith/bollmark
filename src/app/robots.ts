import type { MetadataRoute } from "next";

const BASE_URL = "https://bollmark.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/hesap"]
    },
    sitemap: `${BASE_URL}/sitemap.xml`
  };
}
