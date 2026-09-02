"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingBag,
  Tag,
  Award,
  Percent,
  Package,
  Truck,
  Users,
  Users2,
  Settings,
  SlidersHorizontal,
  BarChart3,
  RotateCcw,
  History,
  FileText,
  MessageSquare
} from "lucide-react";
import { isPathAllowedForRole } from "@/lib/roles";

const navItems = [
  { href: "/admin", label: "Panel", icon: LayoutDashboard, exact: true },
  { href: "/admin/urunler", label: "Ürünler", icon: ShoppingBag },
  { href: "/admin/kategoriler", label: "Kategoriler", icon: Tag },
  { href: "/admin/markalar", label: "Markalar", icon: Award },
  { href: "/admin/kampanyalar", label: "Kampanyalar", icon: Percent },
  { href: "/admin/siparisler", label: "Siparişler", icon: Package },
  { href: "/admin/iadeler", label: "İadeler", icon: RotateCcw },
  { href: "/admin/kargolar", label: "Kargolar", icon: Truck },
  { href: "/admin/yorumlar", label: "Yorumlar", icon: MessageSquare },
  { href: "/admin/musteriler", label: "Müşteriler", icon: Users },
  { href: "/admin/personel", label: "Personel", icon: Users2 },
  { href: "/admin/raporlar", label: "Raporlar", icon: BarChart3 },
  { href: "/admin/islem-gecmisi", label: "İşlem Geçmişi", icon: History },
  { href: "/admin/yasal-sayfalar", label: "Yasal Sayfalar", icon: FileText },
  { href: "/admin/ayarlar/varyant-ozellikleri", label: "Varyant Özellikleri", icon: SlidersHorizontal },
  { href: "/admin/ayarlar", label: "Ayarlar", icon: Settings, exact: true }
];

export function Sidebar({ role }: { role?: string }) {
  const pathname = usePathname();
  const visibleItems = navItems.filter((item) => isPathAllowedForRole(role ?? "ADMIN", item.href));

  return (
    <aside className="w-60 flex-shrink-0 border-r border-admin-border bg-admin-surface px-4 py-6">
      <div className="px-2">
        <p className="text-lg font-semibold tracking-tight text-admin-text">Bollmark</p>
        <p className="mt-0.5 text-xs text-admin-text-muted">Yonetim Paneli</p>
      </div>
      <nav className="mt-8 space-y-0.5">
        {visibleItems.map((item) => {
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
