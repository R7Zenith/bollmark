"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useKalpDurum } from "@/components/kalp-topla/use-kalp-durum";

const navItems = [
  { href: "/hesap", label: "Özet" },
  { href: "/hesap/siparislerim", label: "Siparişlerim" },
  { href: "/hesap/adreslerim", label: "Adreslerim" },
  { href: "/hesap/puanlarim", label: "Puanlarım" },
  { href: "/hesap/kaydedilenler", label: "Kaydedilenler" },
  { href: "/hesap/tercihler", label: "İletişim Tercihleri" }
];
// Kalp Topla (plan 6.4): yalniz kampanya bu uyeye gorunurken (INVISIBLE degil).
const kalpItems = [
  { href: "/hesap/kalplerim", label: "Kalplerim" },
  { href: "/hesap/bildirimler", label: "Bildirimler" }
];

export function HesapNav() {
  const pathname = usePathname();
  const kalpState = useKalpDurum();
  const items = kalpState ? [...navItems.slice(0, 5), ...kalpItems, ...navItems.slice(5)] : navItems;

  return (
    <div>
      <ul className="divide-y divide-line">
        {items.map((item) => {
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
