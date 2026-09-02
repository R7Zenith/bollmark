import { prisma } from "@/lib/prisma";
import { requireCustomer } from "@/lib/require-customer";
import { HesapNav } from "@/components/hesap-nav";

const reasonLabel: Record<string, string> = {
  SIPARIS_KAZANC: "Sipariş Kazancı",
  SIPARIS_KULLANIM: "Sipariş İndirimi",
  ADMIN_DUZELTME: "Yönetici Düzeltmesi"
};

export default async function HesapPuanlarimPage() {
  const session = await requireCustomer();
  const customerId = session.user!.id!;

  const [customer, transactions] = await Promise.all([
    prisma.customer.findUnique({ where: { id: customerId }, select: { loyaltyPoints: true } }),
    prisma.loyaltyTransaction.findMany({ where: { customerId }, orderBy: { createdAt: "desc" } })
  ]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-3xl">Puanlarım</h1>
      <div className="mt-8">
        <HesapNav />
      </div>

      <div className="mt-8 border border-line bg-white p-6">
        <p className="text-xs uppercase tracking-wide text-ink/50">Mevcut Bakiye</p>
        <p className="mt-2 font-display text-3xl">{customer?.loyaltyPoints ?? 0} puan</p>
      </div>

      <div className="mt-6 border border-line bg-white">
        {transactions.length === 0 ? (
          <p className="p-6 text-sm text-ink/50">Henüz puan hareketi yok.</p>
        ) : (
          <div className="divide-y divide-line">
            {transactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-6 py-3 text-sm">
                <div>
                  <p>{reasonLabel[t.reason] ?? t.reason}</p>
                  <p className="text-xs text-ink/50">{t.createdAt.toLocaleDateString("tr-TR")}</p>
                </div>
                <p className={t.points >= 0 ? "text-accent" : "text-ink/70"}>
                  {t.points >= 0 ? "+" : ""}
                  {t.points}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
