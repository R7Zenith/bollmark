import type { Metadata } from "next";

// Sayfa client component oldugu icin metadata buradan verilir.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function SiparisDurumuLayout({ children }: { children: React.ReactNode }) {
  return children;
}
