import type { Metadata } from "next";
import { siteIcons } from "@/lib/site-metadata";

export const metadata: Metadata = {
  icons: siteIcons
};

export default function GateLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      {/* Bu layout globals.css'i import etmiyor, bu yuzden tarayicinin
          varsayilan `body { margin: 8px }` kurali hic sifirlanmiyordu -
          sayfanin kenarlarinda gorunen beyaz cerceve buydu. */}
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
