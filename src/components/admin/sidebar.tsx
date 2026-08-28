"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingBag,
  Tag,
  Package,
  Truck,
  Users,
  Settings
} from "lucide-react";

const navItems = [
  { href: "/admin", label: "Panel", icon: LayoutDashboard, exact: true },
  { href: "/admin/urunler", label: "Urunler", icon: ShoppingBag },
  { href: "/admin/kategoriler", label: "Kategoriler", icon: Tag },
  { href: "/admin/siparisler", label: "Siparisler", icon: Package },
  { href: "/admin/kargolar", label: "Kargolar", icon: Truck },
  { href: "/admin/musteriler", label: "Musteriler", icon: Users },
  { href: "/admin/ayarlar", label: "Ayarlar", icon: Settings }
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 flex-shrink-0 border-r border-admin-border bg-admin-surface px-4 py-6">
      <div className="px-2">
        <p className="text-lg font-semibold tracking-tight text-admin-text">Bollmark</p>
        <p className="mt-0.5 text-xs text-admin-text-muted">Yonetim Paneli</p>
      </div>
      <nav className="mt-8 space-y-0.5">
        {navItems.map((item) => {
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-indigo-50 text-admin-accent"
                  : "text-admin-text-muted hover:bg-admin-bg hover:text-admin-text"
              }`}
            >
              <Icon size={17} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
