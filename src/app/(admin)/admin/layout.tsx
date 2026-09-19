import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminSessionProvider } from "@/components/admin/session-provider";
import { ToastProvider } from "@/components/admin/toast";
import { AdminShell } from "@/components/admin/admin-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  // Giriş sayfasında oturum yoktur; middleware zaten korumalı sayfaları yönlendirir.
  if (!session) {
    return <AdminSessionProvider>{children}</AdminSessionProvider>;
  }

  // Sidebar'daki "Mesajlar" rozeti icin okunmamis (yeni) mesaj sayisi - sadece
  // ADMIN gorur, sayim basarisiz olursa panel yine de acilir.
  const unreadMessages =
    session.user?.role === "ADMIN"
      ? await prisma.contactMessage.count({ where: { status: "YENI" } }).catch(() => 0)
      : 0;

  return (
    <AdminSessionProvider>
      <ToastProvider>
        <AdminShell role={session.user?.role} unreadMessages={unreadMessages}>{children}</AdminShell>
      </ToastProvider>
    </AdminSessionProvider>
  );
}
