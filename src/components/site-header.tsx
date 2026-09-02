"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCart } from "@/lib/cart";

export function SiteHeader() {
  const { totalCount } = useCart();
  const { data: session } = useSession();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="font-display text-2xl tracking-widest2 uppercase">
          Bollmark
        </Link>
        <nav className="hidden gap-8 text-sm uppercase tracking-wide md:flex">
          <Link href="/urunler" className="hover:text-accent">Tüm Ürünler</Link>
          <Link href="/urunler?kategori=outerwear" className="hover:text-accent">Dış Giyim</Link>
          <Link href="/#hikaye" className="hover:text-accent">Hikayemiz</Link>
        </nav>
        <div className="flex items-center gap-4">
          <Link href={session?.user ? "/hesap" : "/hesap/giris"} className="text-sm uppercase tracking-wide hover:text-accent">
            {session?.user?.name ?? "Giriş Yap"}
          </Link>
          <Link
            href="/sepet"
            className="relative flex items-center gap-2 rounded-full border border-ink px-4 py-2 text-sm uppercase tracking-wide transition hover:bg-ink hover:text-paper"
          >
            Sepet
            {totalCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-xs text-white">
                {totalCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
