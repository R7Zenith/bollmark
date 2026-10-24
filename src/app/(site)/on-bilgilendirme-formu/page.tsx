import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { PreInformationForm } from "@/components/legal/pre-information-form";

// Statik metin (LegalPage tablosunda degil) - kargo ucreti panel > Ayarlar'dan
// okundugu icin kod tarafinda tutuluyor. Odeme adimindaki pencere ayni metni
// siparise ozel ozetle gosterir (bkz. odeme/checkout-form.tsx).

export const metadata: Metadata = {
  title: "Ön Bilgilendirme Formu",
  description:
    "Bollmark'tan yapacağınız alışverişlerde satıcı bilgileri, fiyat, teslimat, ödeme, cayma hakkı ve şikâyet başvuruları hakkında ön bilgilendirme.",
  alternates: { canonical: "/on-bilgilendirme-formu" }
};

export const revalidate = 3600;

export default async function PreInformationPage() {
  const storeSettings = await prisma.storeSettings.findUnique({
    where: { id: "singleton" },
    select: { defaultShippingCents: true }
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-3xl">Ön Bilgilendirme Formu</h1>
      <PreInformationForm standardShippingCents={storeSettings?.defaultShippingCents ?? 0} />
    </div>
  );
}
