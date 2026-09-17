import { prisma } from "@/lib/prisma";
import CheckoutForm from "./checkout-form";

export default async function CheckoutPage() {
  const storeSettings = await prisma.storeSettings.findUnique({ where: { id: "singleton" } });
  const defaultShippingCents = storeSettings?.defaultShippingCents ?? 0;

  return <CheckoutForm defaultShippingCents={defaultShippingCents} />;
}
