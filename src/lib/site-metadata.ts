import type { Metadata } from "next";

export const siteIcons: Metadata["icons"] = {
  icon: [
    { url: "/icon.png", type: "image/png", sizes: "48x48" },
    { url: "/favicon.ico", sizes: "any" }
  ],
  apple: [{ url: "/apple-icon.png", sizes: "180x180" }]
};

// Next.js alt sayfada tanimlanan openGraph'i ust layout'unkiyle birlestirmez,
// tamamen degistirir - kendi openGraph'ini yazan sayfalar bunu yaymali.
export const baseOpenGraph = {
  siteName: "Bollmark",
  locale: "tr_TR",
  type: "website",
  images: [{ url: "/og-default.jpg", width: 1200, height: 630, alt: "Bollmark" }]
} satisfies Metadata["openGraph"];
