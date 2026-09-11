"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCart } from "@/lib/cart";
import type { MegaMenuData, MenuCategory } from "@/lib/site-nav";

type GenderKey = "kadin" | "erkek";

const GENDER_LABEL: Record<GenderKey, "Kadın" | "Erkek"> = {
  kadin: "Kadın",
  erkek: "Erkek"
};

// Sutun basina ~6-8 link kalacak sekilde 3-4 sutuna bol.
function chunkColumns(items: MenuCategory[]): MenuCategory[][] {
  if (items.length === 0) return [];
  const columnCount = Math.min(4, Math.max(1, Math.ceil(items.length / 7)));
  const perColumn = Math.ceil(items.length / columnCount);
  const columns: MenuCategory[][] = [];
  for (let i = 0; i < items.length; i += perColumn) {
    columns.push(items.slice(i, i + perColumn));
  }
  return columns;
}

function HamburgerIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <line x1="5" y1="5" x2="19" y2="19" />
      <line x1="19" y1="5" x2="5" y2="19" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className={`transition-transform ${open ? "rotate-180" : ""}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function GenderPanel({ gender, categories }: { gender: GenderKey; categories: MenuCategory[] }) {
  const genderLabel = GENDER_LABEL[gender];
  const searchParams = useSearchParams();
  const activeSlug = searchParams.get("kategori");
  const activeGender = searchParams.get("cinsiyet");
  const columns = chunkColumns(categories);
  const heroImage = categories.find((c) => c.imageUrl)?.imageUrl ?? null;

  return (
    <div className="absolute inset-x-0 top-full w-full rounded-b-2xl border-b border-line bg-cream shadow-soft">
      <div className="mx-auto flex max-w-6xl gap-12 px-6 py-10">
        <div className="grid flex-1 grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3 md:grid-cols-4">
          {columns.map((column, i) => (
            <ul key={i} className="space-y-3">
              {column.map((category) => {
                const isActive = activeSlug === category.slug && activeGender === genderLabel;
                return (
                  <li key={category.id}>
                    <Link
                      href={`/urunler?kategori=${category.slug}&cinsiyet=${genderLabel}`}
                      className={`block border-b-2 pb-0.5 text-sm hover:text-clay ${isActive ? "border-clay text-clay" : "border-transparent text-ink/80"}`}
                    >
                      {category.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          ))}
        </div>
        {heroImage && (
          <div className="hidden w-80 shrink-0 lg:block">
            <Link href={`/urunler?cinsiyet=${genderLabel}`} className="block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={heroImage} alt={`${genderLabel} koleksiyonu`} className="h-72 w-full rounded-none object-cover" />
              <span className="mt-3 block text-sm uppercase tracking-wide hover:text-clay">
                {genderLabel} Koleksiyonunu Gör
              </span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function AksesuarPanel({ categories }: { categories: MenuCategory[] }) {
  const searchParams = useSearchParams();
  const activeSlug = searchParams.get("kategori");

  return (
    <div className="absolute inset-x-0 top-full w-full rounded-b-2xl border-b border-line bg-cream shadow-soft">
      <ul className="mx-auto max-w-6xl space-y-3 px-6 py-10">
        {categories.map((category) => {
          const isActive = activeSlug === category.slug;
          return (
            <li key={category.id}>
              <Link
                href={`/urunler?kategori=${category.slug}`}
                className={`inline-block border-b-2 pb-0.5 text-sm hover:text-clay ${isActive ? "border-clay text-clay" : "border-transparent text-ink/80"}`}
              >
                {category.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type TabKey = "kadin" | "erkek" | "aksesuar";

function DesktopNav({
  menuData,
  openMenu,
  setOpenMenu
}: {
  menuData: MegaMenuData;
  openMenu: TabKey | null;
  setOpenMenu: (key: TabKey | null) => void;
}) {
  const tabs: { key: TabKey; label: string; href: string }[] = [
    { key: "kadin", label: "Kadın", href: "/urunler?cinsiyet=Kadın" },
    { key: "erkek", label: "Erkek", href: "/urunler?cinsiyet=Erkek" },
    { key: "aksesuar", label: "Aksesuar", href: "/urunler?kategori=aksesuar" }
  ];

  return (
    <nav className="hidden items-center gap-8 text-sm uppercase tracking-wide md:flex">
      <Link href="/urunler" className="uppercase hover:text-clay">
        Tüm Ürünler
      </Link>
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className="uppercase hover:text-clay"
          aria-expanded={openMenu === tab.key}
          onMouseEnter={() => setOpenMenu(tab.key)}
          onFocus={() => setOpenMenu(tab.key)}
        >
          {tab.label}
        </Link>
      ))}
      <Link href="/#hikaye" className="uppercase hover:text-clay">
        Hikayemiz
      </Link>
    </nav>
  );
}

function MobileAccordionSection({
  label,
  href,
  categories,
  buildHref,
  isOpen,
  onToggle,
  onNavigate
}: {
  label: string;
  href: string;
  categories: MenuCategory[];
  buildHref: (category: MenuCategory) => string;
  isOpen: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}) {
  return (
    <div className="border-b border-line">
      <div className="flex items-center justify-between">
        <Link href={href} onClick={onNavigate} className="flex-1 py-4 text-sm uppercase tracking-wide">
          {label}
        </Link>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-label={`${label} alt kategorilerini ${isOpen ? "kapat" : "aç"}`}
          className="p-4"
        >
          <ChevronIcon open={isOpen} />
        </button>
      </div>
      {isOpen && (
        <ul className="space-y-3 pb-4 pl-2">
          {categories.map((category) => (
            <li key={category.id}>
              <Link href={buildHref(category)} onClick={onNavigate} className="block text-sm text-ink/80 hover:text-clay">
                {category.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MobileMenu({
  menuData,
  open,
  onClose,
  session
}: {
  menuData: MegaMenuData;
  open: boolean;
  onClose: () => void;
  session: ReturnType<typeof useSession>["data"];
}) {
  const [openSection, setOpenSection] = useState<"kadin" | "erkek" | "aksesuar" | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open || !mounted) return null;

  // Header'daki backdrop-blur bir containing block olusturdugu icin (backdrop-filter,
  // CSS'te fixed konumlanmayi ata elemente gore sinirlar), bu overlay body'ye
  // portal ile tasinir - aksi halde tam ekran degil header yuksekliginde kirpilir.
  return createPortal(
    <div className="fixed inset-0 z-50 md:hidden">
      <button
        type="button"
        aria-label="Menüyü kapat"
        className="absolute inset-0 bg-ink/40"
        onClick={onClose}
      />
      <div className="absolute right-0 top-0 flex h-full w-[85%] max-w-sm flex-col overflow-y-auto rounded-l-2xl bg-cream px-6 py-6 shadow-soft">
        <div className="flex items-center justify-between">
          <span className="font-display text-xl tracking-widest2 uppercase">Bollmark</span>
          <button type="button" aria-label="Kapat" onClick={onClose} className="p-1">
            <CloseIcon />
          </button>
        </div>

        <div className="mt-6 flex-1">
          <Link href="/urunler" onClick={onClose} className="block border-b border-line py-4 text-sm uppercase tracking-wide">
            Tüm Ürünler
          </Link>
          <MobileAccordionSection
            label="Kadın"
            href="/urunler?cinsiyet=Kadın"
            categories={menuData.kadin}
            buildHref={(c) => `/urunler?kategori=${c.slug}&cinsiyet=Kadın`}
            isOpen={openSection === "kadin"}
            onToggle={() => setOpenSection((s) => (s === "kadin" ? null : "kadin"))}
            onNavigate={onClose}
          />
          <MobileAccordionSection
            label="Erkek"
            href="/urunler?cinsiyet=Erkek"
            categories={menuData.erkek}
            buildHref={(c) => `/urunler?kategori=${c.slug}&cinsiyet=Erkek`}
            isOpen={openSection === "erkek"}
            onToggle={() => setOpenSection((s) => (s === "erkek" ? null : "erkek"))}
            onNavigate={onClose}
          />
          <MobileAccordionSection
            label="Aksesuar"
            href="/urunler?kategori=aksesuar"
            categories={menuData.aksesuar}
            buildHref={(c) => `/urunler?kategori=${c.slug}`}
            isOpen={openSection === "aksesuar"}
            onToggle={() => setOpenSection((s) => (s === "aksesuar" ? null : "aksesuar"))}
            onNavigate={onClose}
          />
          <Link href="/#hikaye" onClick={onClose} className="block border-b border-line py-4 text-sm uppercase tracking-wide">
            Hikayemiz
          </Link>
          <Link
            href={session?.user ? "/hesap" : "/hesap/giris"}
            onClick={onClose}
            className="block border-b border-line py-4 text-sm uppercase tracking-wide"
          >
            {session?.user?.name ?? "Giriş Yap"}
          </Link>
          <Link href="/sepet" onClick={onClose} className="block py-4 text-sm uppercase tracking-wide">
            Sepet
          </Link>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function SiteHeader({ menuData }: { menuData: MegaMenuData }) {
  const { totalCount } = useCart();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<TabKey | null>(null);

  return (
    <header
      className="sticky top-0 z-40 border-b border-line bg-cream relative"
      onMouseLeave={() => setOpenMenu(null)}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="font-display text-2xl tracking-widest2 uppercase">
          Bollmark
        </Link>

        <DesktopNav menuData={menuData} openMenu={openMenu} setOpenMenu={setOpenMenu} />

        <div className="flex items-center gap-4">
          <Link
            href={session?.user ? "/hesap" : "/hesap/giris"}
            className="hidden text-sm uppercase tracking-wide hover:text-clay md:inline"
          >
            {session?.user?.name ?? "Giriş Yap"}
          </Link>
          <Link
            href="/sepet"
            className="relative flex items-center gap-2 bg-ink px-4 py-2 text-sm uppercase tracking-wide text-cream transition hover:bg-clay"
          >
            Sepet
            {totalCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cream text-xs text-ink">
                {totalCount}
              </span>
            )}
          </Link>
          <button
            type="button"
            aria-label="Menüyü aç"
            className="p-1 md:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <HamburgerIcon />
          </button>
        </div>
      </div>

      {openMenu === "aksesuar" && <AksesuarPanel categories={menuData.aksesuar} />}
      {(openMenu === "kadin" || openMenu === "erkek") && (
        <GenderPanel gender={openMenu} categories={menuData[openMenu]} />
      )}

      <MobileMenu menuData={menuData} open={mobileOpen} onClose={() => setMobileOpen(false)} session={session} />
    </header>
  );
}
