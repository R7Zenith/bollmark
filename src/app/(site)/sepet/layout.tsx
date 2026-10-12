import type { Metadata } from "next";

// Sepet sayfasi client component oldugu icin metadata buradan verilir.
export const metadata: Metadata = { title: "Sepetim", robots: { index: false, follow: false } };

export default function SepetLayout({ children }: { children: React.ReactNode }) {
  return children;
}
