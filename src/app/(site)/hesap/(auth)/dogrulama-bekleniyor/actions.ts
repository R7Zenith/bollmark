"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireCustomer } from "@/lib/require-customer";
import { sendVerificationEmail } from "@/lib/kalp-topla/email-verification";
import { isSafeInternalPath } from "@/lib/safe-path";

// Bekleme sayfasindan ve Hesabim uyari seridinden "tekrar gonder" (10 dakikada
// en cok bir e-posta). Sonuc bekleme sayfasinda gosterilir.
export async function resendVerificationFromWaiting(formData: FormData) {
  const session = await requireCustomer();
  const raw = String(formData.get("devam") ?? "");
  const devam = isSafeInternalPath(raw) ? raw : "/hesap";
  const customer = await prisma.customer.findUnique({
    where: { id: session.user!.id! },
    select: { id: true, email: true, name: true, emailVerifiedAt: true }
  });
  if (!customer || customer.emailVerifiedAt) redirect(devam);
  const result = await sendVerificationEmail(customer);
  redirect(
    `/hesap/dogrulama-bekleniyor?durum=${result === "sent" ? "gonderildi" : "bekle"}&devam=${encodeURIComponent(devam)}`
  );
}
