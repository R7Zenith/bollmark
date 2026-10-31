/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ana sayfadaki Instagram galerisi (components/home/instagram-grid.tsx)
  // public/instagram/ dosyalarinin var olup olmadigini istek aninda fs ile
  // kontrol eder; Vercel'de public/ islev paketine kendiliginden girmedigi
  // icin bu klasor "/" rotasinin izine elle eklenir. public/magaza/ da ayni
  // sekilde (magaza fotograflari, bkz. components/home/faq-and-store.tsx).
  outputFileTracingIncludes: { "/": ["./public/instagram/**/*", "./public/magaza/**/*"] },
  // Ayni bilesendeki path.join(process.cwd(), "public", ...) tum public/
  // klasorunu ana sayfa function'ina (~8 MB) sokuyor; bu gorseller Vercel'de
  // CDN'den servis edildigi icin lambda'da gereksiz. public/instagram haric.
  // Kalp Topla T9: Favorilerim -> Kaydedilenler (eski adres 301 ile yonlenir).
  async redirects() {
    return [{ source: "/hesap/favorilerim", destination: "/hesap/kaydedilenler", statusCode: 301 }];
  },
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
    // KALICI KARAR (13 Eki 2026): Vercel Pro'ya geçildi, urun gorselleri R2'de ve yuklemede zaten 1600px WebP'ye sikistiriliyor.
    // Vercel goruntu donusturmesi (ucretli) bilerek kapali. Kullanici onayi olmadan kaldirma.
    unoptimized: true
  }
};

export default nextConfig;
