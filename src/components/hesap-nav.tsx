"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const navItems = [
  { href: "/hesap", label: "Özet" },
  { href: "/hesap/siparislerim", label: "Siparişlerim" },
  { href: "/hesap/adreslerim", label: "Adreslerim" },
  { href: "/hesap/puanlarim", label: "Puanlarım" },
  { href: "/hesap/favorilerim", label: "Favorilerim" }
];

export function HesapNav() {
  const pathname = usePathname();

  return (
    <div>
      <ul className="divide-y divide-line">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center justify-between px-9 py-8 text-xl font-normal text-ink hover:bg-ink/[0.024] ${
                  active ? "bg-ink/[0.024]" : ""
                }`}
              >
                {item.label}
                <span aria-hidden="true">›</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="px-9 py-6">
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="text-[10px] uppercase tracking-[1px] underline text-ink/60 hover:text-ink"
        >
          Çıkış Yap
        </button>
      </div>
    </div>
  );
}
