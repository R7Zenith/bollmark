"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCustomer } from "@/lib/require-customer";
import { requestIp } from "@/lib/meta/capi";
import { setMarketingConsent } from "@/lib/kalp-topla/consent";

// Iletisim tercihleri (KALP_TOPLA_PLANI.md 6.5): her onay degisikligi
// MarketingConsentLog'a HESAP_AYARLARI kaynagiyla, IP ve metin surumuyle yazilir.
export async function savePreferences(formData: FormData) {
  const session = await requireCustomer();
  const customerId = session.user!.id!;
  const ip = requestIp(await headers());

  const phone = String(formData.get("phone") ?? "").trim() || null;
  await prisma.customer.update({ where: { id: customerId }, data: { phone } });
  await setMarketingConsent({
    customerId,
    channel: "EMAIL",
    granted: formData.get("marketingEmail") === "on",
    source: "HESAP_AYARLARI",
    ip
  });
  await setMarketingConsent({
    customerId,
    channel: "WHATSAPP",
    granted: formData.get("marketingWhatsapp") === "on",
    source: "HESAP_AYARLARI",
    ip
  });

  revalidatePath("/hesap/tercihler");
  redirect("/hesap/tercihler?kaydedildi=1");
}
