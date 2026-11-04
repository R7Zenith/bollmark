"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireCustomer } from "@/lib/require-customer";
import { normalizeTrMobile } from "@/lib/phone";

// Hesap Ozeti: telefonu bos eski uyeler icin "Telefon numarani ekle" kutusu.
// Kayit formuyla ayni kural; yalniz oturumdaki uyenin kendi kaydi guncellenir.
export async function addPhone(formData: FormData) {
  const session = await requireCustomer();
  const phone = normalizeTrMobile(String(formData.get("phone") ?? ""));
  if (!phone) redirect("/hesap?telefon=hata");
  await prisma.customer.update({ where: { id: session.user!.id! }, data: { phone } });
  redirect("/hesap?telefon=kaydedildi");
}
