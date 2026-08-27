import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AdminSessionProvider } from "@/components/admin/session-provider";
import { SignOutButton } from "@/components/admin/sign-out-button";

const navItems = [
  { href: "/admin", label: "Panel" },
  { href: "/admin/urunler", label: "Urunler" },
  { href: "/admin/kategoriler", label: "Kategoriler" },
  { href: "/admin/siparisler", label: "Siparisler" },
  { href: "/admin/kargolar", label: "Kargolar" }
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  // Giris sayfasinda oturum yoktur; middleware zaten korumali sayfalari yonlendirir.
  if (!session) {
    return <AdminSessionProvider>{children}</AdminSessionProvider>;
  }

  return (
    <AdminSessionProvider>
      <div className="flex min-h-screen bg-paper">
        <aside className="w-60 flex-shrink-0 border-r border-line bg-white px-6 py-8">
          <p className="font-display text-xl uppercase tracking-widest2">Bollmark</p>
          <p className="mt-1 text-xs text-ink/50">Yonetim Paneli</p>
          <nav className="mt-10 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded px-3 py-2 text-sm hover:bg-paper"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-10 border-t border-line pt-4">
            <p className="text-xs text-ink/50">{session.user?.email}</p>
            <div className="mt-2">
              <SignOutButton />
            </div>
          </div>
        </aside>
        <main className="flex-1 px-10 py-8">{children}</main>
      </div>
    </AdminSessionProvider>
  );
}
