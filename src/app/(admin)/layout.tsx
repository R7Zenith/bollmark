import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: "Bollmark Yönetim Paneli",
  description: "Bollmark admin paneli - ürün, sipariş, kargo ve müşteri yönetimi."
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
