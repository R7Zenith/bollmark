import type { Metadata } from "next";

export const siteIcons: Metadata["icons"] = {
  icon: [
    { url: "/icon.png", type: "image/png", sizes: "48x48" },
    { url: "/favicon.ico", sizes: "any" }
  ],
  apple: [{ url: "/apple-icon.png", sizes: "180x180" }]
};
