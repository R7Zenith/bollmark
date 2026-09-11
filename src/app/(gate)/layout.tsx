import type { Metadata } from "next";
import { siteIcons } from "@/lib/site-metadata";

export const metadata: Metadata = {
  icons: siteIcons
};

export default function GateLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
