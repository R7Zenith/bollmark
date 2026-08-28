/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com" }
    ]
  },
  // next/og (@vercel/og) kullanilmiyor; wasm dosyalari (resvg, yoga) Worker
  // boyut limitini asmamak icin bundle'dan cikariliyor.
  outputFileTracingExcludes: {
    "*": ["./node_modules/next/dist/compiled/@vercel/og/**/*"]
  }
};

export default nextConfig;
