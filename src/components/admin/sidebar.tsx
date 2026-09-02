"use client";

import { useEffect, useState } from "react";
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
  MessageSquare,
  ChevronDown
} from "lucide-react";
import { isPathAllowedForRole } from "@/lib/roles";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
};

type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

// Panel (dashboard) her zaman en ustte, tek basina, grup disinda gosterilir.
const topItem: NavItem = { href: "/admin", label: "Panel", icon: LayoutDashboard, exact: true };

const navGroups: NavGroup[] = [
  {
    id: "katalog",
    label: "Katalog",
    items: [
      { href: "/admin/urunler", label: "Ürünler", icon: ShoppingBag },
      { href: "/admin/kategoriler", label: "Kategoriler", icon: Tag },
      { href: "/admin/markalar", label: "Markalar", icon: Award },
      { href: "/admin/ayarlar/varyant-ozellikleri", label: "Varyant Özellikleri", icon: SlidersHorizontal }
    ]
  },
  {
    id: "pazarlama",
    label: "Pazarlama",
    items: [
      { href: "/admin/kampanyalar", label: "Kampanyalar", icon: Percent },
      { href: "/admin/bundle-kampanyalari", label: "Bundle Kampanyaları", icon: Percent }
    ]
  },
  {
    id: "satis",
    label: "Satış & Lojistik",
    items: [
      { href: "/admin/siparisler", label: "Siparişler", icon: Package },
      { href: "/admin/iadeler", label: "İadeler", icon: RotateCcw },
      { href: "/admin/kargolar", label: "Kargolar", icon: Truck }
    ]
  },
  {
    id: "musteriler",
    label: "Müşteriler",
    items: [
      { href: "/admin/musteriler", label: "Müşteriler", icon: Users },
      { href: "/admin/yorumlar", label: "Yorumlar", icon: MessageSquare }
    ]
  },
  {
    id: "sistem",
    label: "Sistem",
    items: [
      { href: "/admin/personel", label: "Personel", icon: Users2 },
      { href: "/admin/raporlar", label: "Raporlar", icon: BarChart3 },
      { href: "/admin/islem-gecmisi", label: "İşlem Geçmişi", icon: History },
      { href: "/admin/yasal-sayfalar", label: "Yasal Sayfalar", icon: FileText },
      { href: "/admin/ayarlar", label: "Ayarlar", icon: Settings, exact: true }
    ]
  }
];

const STORAGE_KEY = "bollmark-admin-sidebar-open-groups";

function isItemActive(item: NavItem, pathname: string) {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

function NavLink({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const Icon = item.icon;
  return (
    <Link
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
}

export function Sidebar({ role }: { role?: string }) {
  const pathname = usePathname();
  const effectiveRole = role ?? "ADMIN";

  const visibleGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => isPathAllowedForRole(effectiveRole, item.href))
    }))
    .filter((group) => group.items.length > 0);

  const activeGroupId = visibleGroups.find((group) =>
    group.items.some((item) => isItemActive(item, pathname))
  )?.id;

  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set(activeGroupId ? [activeGroupId] : []));
  const [hydrated, setHydrated] = useState(false);

  // Ilk yuklemede kullanicinin daha once actigi gruplari localStorage'dan geri getir,
  // aktif sayfanin grubunu da her zaman acik tut.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      const savedIds: string[] = saved ? JSON.parse(saved) : [];
      setOpenGroups((prev) => {
        const next = new Set([...savedIds, ...prev]);
        return next;
      });
    } catch {
      // localStorage kullanilamiyorsa sessizce yoksay, varsayilan acik grup yeterli.
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sayfa degistiginde yeni aktif grubu her zaman acik tut.
  useEffect(() => {
    if (activeGroupId) {
      setOpenGroups((prev) => (prev.has(activeGroupId) ? prev : new Set(prev).add(activeGroupId)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroupId]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...openGroups]));
    } catch {
      // yoksay
    }
  }, [openGroups, hydrated]);

  function toggleGroup(id: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const showTopItem = isPathAllowedForRole(effectiveRole, topItem.href);

  return (
    <aside className="w-60 flex-shrink-0 overflow-y-auto border-r border-admin-border bg-admin-surface px-4 py-6">
      <div className="px-2">
        <p className="text-lg font-semibold tracking-tight text-admin-text">Bollmark</p>
        <p className="mt-0.5 text-xs text-admin-text-muted">Yonetim Paneli</p>
      </div>
      <nav className="mt-8 space-y-4">
        {showTopItem && (
          <div className="space-y-0.5">
            <NavLink item={topItem} isActive={isItemActive(topItem, pathname)} />
          </div>
        )}

        {visibleGroups.map((group) => {
          const isOpen = openGroups.has(group.id);
          const groupHasActive = group.items.some((item) => isItemActive(item, pathname));
          return (
            <div key={group.id}>
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                aria-expanded={isOpen}
                className={`flex w-full items-center justify-between rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
                  groupHasActive ? "text-admin-accent" : "text-admin-text-muted hover:text-admin-text"
                }`}
              >
                {group.label}
                <ChevronDown
                  size={14}
                  className={`transition-transform ${isOpen ? "rotate-0" : "-rotate-90"}`}
                />
              </button>
              {isOpen && (
                <div className="mt-1 space-y-0.5">
                  {group.items.map((item) => (
                    <NavLink key={item.href} item={item} isActive={isItemActive(item, pathname)} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
