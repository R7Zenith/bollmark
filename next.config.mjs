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
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "img.bollmark.com" }
    ],
    // Blob'daki kaynaklar yuklenirken zaten max 1600px'e sikistiriliyor
    // (lib/image-compress.ts); ustundeki genislikler bos yere donusum sayar.
    deviceSizes: [640, 828, 1200, 1600],
    imageSizes: [256, 384],
    qualities: [75],
    formats: ["image/webp"],
    // Blob URL'leri addRandomSuffix ile degismez -> 31 gun onbellekte kalsin,
    // ayni gorsel tekrar tekrar donusturulup Vercel sayacini doldurmasin.
    minimumCacheTTL: 2678400,
    // GECICI (30 Eyl 2026): Vercel Image Transformations kotasi doldu,
    // onbellekte olmayan her donusum 402 donuyor. Kota sifirlaninca kaldir.
    unoptimized: true
  }
};

export default nextConfig;
