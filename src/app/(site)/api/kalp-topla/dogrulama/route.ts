import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { customerAuthOptions } from "@/lib/customer-auth";
import { sendVerificationEmail } from "@/lib/kalp-topla/email-verification";
import { campaignStateFor } from "@/lib/kalp-topla/settings";

// Bekleyen kalp icin "dogrulama e-postasini tekrar gonder" (plan 6.1); 10 dakikada en cok bir kez.
export async function POST() {
  const headers = { "Cache-Control": "no-store" };
  const session = await getServerSession(customerAuthOptions);
  const customerId = session?.user?.id;
  if (!customerId) return NextResponse.json({ error: "Giriş yapmalısın." }, { status: 401, headers });
  if ((await campaignStateFor(customerId)) === "INVISIBLE") {
    return NextResponse.json({ error: "Bulunamadı." }, { status: 404, headers });
  }
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, email: true, name: true, emailVerifiedAt: true }
  });
  if (!customer) return NextResponse.json({ error: "Bulunamadı." }, { status: 404, headers });
  if (customer.emailVerifiedAt) return NextResponse.json({ result: "verified" }, { headers });
  return NextResponse.json({ result: await sendVerificationEmail(customer, "KALP") }, { headers });
}
