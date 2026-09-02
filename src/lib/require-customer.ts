import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { customerAuthOptions } from "@/lib/customer-auth";

// require-admin.ts ile ayni desen - /hesap/* sayfalarinin basinda cagrilir,
// oturum yoksa giris sayfasina yonlendirir.
export async function requireCustomer() {
  const session = await getServerSession(customerAuthOptions);
  if (!session?.user?.id) redirect("/hesap/giris");
  return session;
}
