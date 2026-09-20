import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getPaymentSettings, getReadiness } from "@/lib/payment/settings";
import CheckoutForm from "./checkout-form";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const storeSettings = await prisma.storeSettings.findUnique({ where: { id: "singleton" } });
  const defaultShippingCents = storeSettings?.defaultShippingCents ?? 0;

  const readiness = getReadiness(await getPaymentSettings());

  return <CheckoutForm defaultShippingCents={defaultShippingCents} paymentMode={readiness.ready ? readiness.mode : null} />;
}
