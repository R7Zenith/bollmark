"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const navItems = [
  { href: "/hesap", label: "Özet" },
  { href: "/hesap/siparislerim", label: "Siparişlerim" },
  { href: "/hesap/adreslerim", label: "Adreslerim" },
  { href: "/hesap/puanlarim", label: "Puanlarım" }
];

export function HesapNav() {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
      <nav className="flex flex-wrap gap-6 text-sm uppercase tracking-wide">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={pathname === item.href ? "text-ink" : "text-ink/50 hover:text-ink"}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/" })}
        className="text-sm uppercase tracking-wide text-ink/50 hover:text-ink"
      >
        Çıkış Yap
      </button>
    </div>
  );
}
