import type { Metadata } from "next";

// Giris dahil tum hesap sayfalari dizin disi.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function HesapRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
