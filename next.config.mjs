/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ana sayfadaki Instagram galerisi (components/home/instagram-grid.tsx)
  // public/instagram/ dosyalarinin var olup olmadigini istek aninda fs ile
  // kontrol eder; Vercel'de public/ islev paketine kendiliginden girmedigi
  // icin bu klasor "/" rotasinin izine elle eklenir.
  outputFileTracingIncludes: { "/": ["./public/instagram/**/*"] },
  // Ayni bilesendeki path.join(process.cwd(), "public", ...) tum public/
  // klasorunu ana sayfa function'ina (~8 MB) sokuyor; bu gorseller Vercel'de
  // CDN'den servis edildigi icin lambda'da gereksiz. public/instagram haric.
  outputFileTracingExcludes: {
    "/": [
      "./public/menu/**",
      "./public/anasayfa/**",
      "./public/hero-model.jpg",
      "./public/catalog-banner.jpg",
      "./public/payment/**"
    ]
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com" }
    ]
  }
};

export default nextConfig;
