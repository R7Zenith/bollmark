"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireCustomer } from "@/lib/require-customer";
import { sendVerificationEmail } from "@/lib/kalp-topla/email-verification";

// Suresi dolmus / gecersiz baglanti sayfasindan, girisli uye icin yeni
// dogrulama e-postasi (10 dakikada en cok bir kez).
export async function resendVerification() {
  const session = await requireCustomer();
  const customer = await prisma.customer.findUnique({
    where: { id: session.user!.id! },
    select: { id: true, email: true, name: true, emailVerifiedAt: true }
  });
  if (!customer || customer.emailVerifiedAt) redirect("/hesap/dogrula?durum=dogrulanmis");
  const result = await sendVerificationEmail(customer);
  redirect(`/hesap/dogrula?durum=${result === "sent" ? "gonderildi" : "bekle"}`);
}
