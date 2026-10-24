import { prisma } from "@/lib/prisma";
import CartView from "./cart-view";

// Sepetin kendisi client component (cart-view.tsx); burada yalniz kargo
// bilgi satiri icin panel > Ayarlar'daki kargo ucreti okunur.
export const revalidate = 3600;

export default async function CartPage() {
  const storeSettings = await prisma.storeSettings.findUnique({
    where: { id: "singleton" },
    select: { defaultShippingCents: true }
  });

  return <CartView defaultShippingCents={storeSettings?.defaultShippingCents ?? 0} />;
}
