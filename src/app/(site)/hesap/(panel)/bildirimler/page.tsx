import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireCustomer } from "@/lib/require-customer";
import { campaignStateFor } from "@/lib/kalp-topla/settings";
import { BildirimlerOkundu } from "@/components/kalp-topla/bildirim-zili";

const LIMIT = 50;

// Hesabim > Bildirimler (KALP_TOPLA_PLANI.md 6.7).
export default async function HesapBildirimlerPage() {
  const session = await requireCustomer();
  const customerId = session.user!.id!;
  if ((await campaignStateFor(customerId)) === "INVISIBLE") notFound();
  const items = await prisma.notification.findMany({ where: { customerId }, orderBy: { createdAt: "desc" }, take: LIMIT });

  return (
    <div>
      <h2 className="font-display text-xl">Bildirimler</h2>
      <BildirimlerOkundu />
      {items.length === 0 ? (
        <p className="mt-6 text-sm text-ink/70">
          Henüz bildirimin yok. Bir ürüne kalp verdiğinde bar hareketlerini burada göreceksin.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-line">
          {items.map((item) => (
            <li key={item.id} className={`py-4 ${item.readAt ? "" : "font-medium"}`}>
              <Link href={item.link ?? "/hesap/kalplerim"} className="block hover:opacity-70">
                <p className="text-sm text-ink">{item.title}</p>
                <p className="mt-1 text-sm font-normal text-ink/70">{item.body}</p>
                <p className="mt-1 text-xs font-normal text-ink/50">
                  {item.createdAt.toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
