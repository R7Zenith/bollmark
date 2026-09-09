import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AdminSessionProvider } from "@/components/admin/session-provider";
import { ToastProvider } from "@/components/admin/toast";
import { AdminShell } from "@/components/admin/admin-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  // Giriş sayfasında oturum yoktur; middleware zaten korumalı sayfaları yönlendirir.
  if (!session) {
    return <AdminSessionProvider>{children}</AdminSessionProvider>;
  }

  return (
    <AdminSessionProvider>
      <ToastProvider>
        <AdminShell role={session.user?.role}>{children}</AdminShell>
      </ToastProvider>
    </AdminSessionProvider>
  );
}
