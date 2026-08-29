import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AdminSessionProvider } from "@/components/admin/session-provider";
import { ToastProvider } from "@/components/admin/toast";
import { Sidebar } from "@/components/admin/sidebar";
import { Topbar } from "@/components/admin/topbar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  // Giriş sayfasında oturum yoktur; middleware zaten korumalı sayfaları yönlendirir.
  if (!session) {
    return <AdminSessionProvider>{children}</AdminSessionProvider>;
  }

  return (
    <AdminSessionProvider>
      <ToastProvider>
        <div className="flex min-h-screen bg-admin-bg">
          <Sidebar />
          <div className="flex flex-1 flex-col">
            <Topbar />
            <main className="flex-1 px-8 py-8">{children}</main>
          </div>
        </div>
      </ToastProvider>
    </AdminSessionProvider>
  );
}
