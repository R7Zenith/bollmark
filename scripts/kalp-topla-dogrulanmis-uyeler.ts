// Kalp Topla T12/Y7 (KALP_TOPLA_PLANI.md 5.4): en az bir "odenmis" siparisi
// olan mevcut uyelerin emailVerifiedAt alanini ilk boyle siparisin tarihine
// yazar. Odenmis siparis (Y7):
// - status PAID / PREPARING / SHIPPED / DELIVERED,
// - deletedAt bos,
// - paymentStatus REFUNDED degil (kismi iade sayilir),
// - customerId = uye VEYA customerEmail uyenin e-postasiyla buyuk/kucuk harf
//   duyarsiz esit (misafir siparisleri dahil).
// Yalniz emailVerifiedAt'i bos olan uyelere dokunur; baska alan yazmaz.
//
// Varsayilan kuru calisma (yalniz okur). Yazmak icin (yayin fazinda, kullanici
// onayiyla): npx tsx scripts/kalp-topla-dogrulanmis-uyeler.ts --uygula
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { REVENUE_STATUSES } from "../src/lib/orders";

const APPLY = process.argv.includes("--uygula");

function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  return `${user.slice(0, 2)}***@${domain}`;
}

async function main() {
  const customers = await prisma.customer.findMany({
    where: { emailVerifiedAt: null },
    select: { id: true, email: true }
  });
  const orders = await prisma.order.findMany({
    where: { status: { in: REVENUE_STATUSES }, deletedAt: null, paymentStatus: { not: "REFUNDED" } },
    select: { customerId: true, customerEmail: true, createdAt: true }
  });

  const firstOrderAt = new Map<string, Date>();
  const byEmail = new Map(customers.map((c) => [c.email.toLowerCase(), c.id]));
  const ids = new Set(customers.map((c) => c.id));
  for (const order of orders) {
    const matched = new Set<string>();
    if (order.customerId && ids.has(order.customerId)) matched.add(order.customerId);
    const emailMatch = byEmail.get(order.customerEmail.trim().toLowerCase());
    if (emailMatch) matched.add(emailMatch);
    for (const id of matched) {
      const prev = firstOrderAt.get(id);
      if (!prev || order.createdAt < prev) firstOrderAt.set(id, order.createdAt);
    }
  }

  console.log(`Doğrulanmamış üye: ${customers.length}`);
  console.log(`Uygun ödenmiş sipariş: ${orders.length}`);
  console.log(`Doğrulanmış sayılacak üye: ${firstOrderAt.size}`);
  for (const c of customers.filter((c) => firstOrderAt.has(c.id))) {
    console.log(`  ${maskEmail(c.email)} → ${firstOrderAt.get(c.id)!.toISOString()}`);
  }

  if (!APPLY) {
    console.log("\nKuru çalışma: hiçbir şey yazılmadı. Yazmak için --uygula.");
    return;
  }
  let updated = 0;
  for (const [id, at] of firstOrderAt) {
    const res = await prisma.customer.updateMany({ where: { id, emailVerifiedAt: null }, data: { emailVerifiedAt: at } });
    updated += res.count;
  }
  console.log(`\nYazıldı: ${updated} üye.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
