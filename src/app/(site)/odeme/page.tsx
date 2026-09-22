import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { getPaymentSettings, getReadiness } from "@/lib/payment/settings";
import { customerAuthOptions } from "@/lib/customer-auth";
import CheckoutForm from "./checkout-form";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const storeSettings = await prisma.storeSettings.findUnique({ where: { id: "singleton" } });
  const defaultShippingCents = storeSettings?.defaultShippingCents ?? 0;

  const readiness = getReadiness(await getPaymentSettings());

  // Misafir siparisi de desteklendigi icin requireCustomer() kullanilmiyor -
  // oturum varsa adres defteri onceden doldurmak icin opsiyonel okunuyor.
  const session = await getServerSession(customerAuthOptions);
  const customerId = session?.user?.id;
  const savedAddresses = customerId
    ? await prisma.customerAddress.findMany({
        where: { customerId },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }]
      })
    : [];

  return (
    <CheckoutForm
      defaultShippingCents={defaultShippingCents}
      paymentMode={readiness.ready ? readiness.mode : null}
      savedAddresses={savedAddresses}
      customerEmail={session?.user?.email ?? undefined}
    />
  );
}
