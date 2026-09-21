/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ana sayfadaki Instagram galerisi (components/home/instagram-grid.tsx)
  // public/instagram/ dosyalarinin var olup olmadigini istek aninda fs ile
  // kontrol eder; Vercel'de public/ islev paketine kendiliginden girmedigi
  // icin bu klasor "/" rotasinin izine elle eklenir.
  outputFileTracingIncludes: { "/": ["./public/instagram/**/*"] },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com" }
    ]
  }
};

export default nextConfig;
