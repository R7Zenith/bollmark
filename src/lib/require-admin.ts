import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Sadece ADMIN rolune acik sayfalarin basinda cagrilir. Asil route koruma
// katmani proxy.ts'te (isPathAllowedForRole) - bu, sayfa icinde ikinci bir
// savunma katmani ve session verisine kolay erisim saglar.
export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/admin/login");
  if (session.user?.role !== "ADMIN") redirect("/admin");
  return session;
}
