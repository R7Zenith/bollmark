// Kalp Topla Faz 4 scriptleri icin ortak yedek, temizlik ve kesilme korumasi
// (canli DB, T13). Yedek: scripts/.kalp-topla-yedek-<tarih>.json (git disi).
// Kurtarma: npx tsx scripts/kalp-topla-senaryo-faz4.ts temizle
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { prisma as PrismaClient } from "../src/lib/prisma";

type Db = typeof PrismaClient;
type Backup = {
  file: string;
  source: string;
  startedAt: string;
  settings: (Record<string, unknown> & { updatedAt: string }) | null;
  restoredAt?: string;
};

export const TEST_ACTOR = "kt4-senaryo";
const TEST_CUSTOMERS = { email: { startsWith: "kt4-", endsWith: "@example.invalid" } };
const TEST_ORDERS = { orderNumber: { startsWith: "KT4-" } };
const BACKUP_DIR = path.resolve("scripts");
const BACKUP_FILE = /^\.kalp-topla-yedek-.+\.json$/;

// Ilk Ctrl+C: script bir sonraki kontrolde durur ve temizligini yapar.
// Ikinci Ctrl+C: hemen cikar, kalanlar kurtarma komutuyla temizlenir.
export function watchInterrupt(): () => void {
  let interrupted = false;
  const onSignal = () => {
    if (interrupted) process.exit(130);
    interrupted = true;
    console.log("\nKesildi: temizlik yapiliyor. Hemen cikmak icin tekrar Ctrl+C.");
  };
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);
  return () => {
    if (interrupted) throw new Error("Kullanici tarafindan kesildi.");
  };
}

// Hicbir sey yazmadan once cagrilir: DB temiz degilse durur, temizse yedegi yazar.
export async function prepareRun(db: Db, source: string): Promise<Backup> {
  const [hearts, rounds, coupons, bars, customers, orders] = await Promise.all([
    db.kalpHeart.count(),
    db.kalpRound.count(),
    db.kalpCoupon.count(),
    db.kalpBar.count(),
    db.customer.count({ where: TEST_CUSTOMERS }),
    db.order.count({ where: TEST_ORDERS })
  ]);
  if (hearts + rounds + coupons + bars + customers + orders > 0) {
    throw new Error(
      `DB temiz degil (kalp ${hearts}, tur ${rounds}, kupon ${coupons}, bar ${bars}, test uyesi ${customers}, test siparisi ${orders}). Hicbir sey yazilmadi.`
    );
  }
  const startedAt = new Date().toISOString();
  const file = path.join(BACKUP_DIR, `.kalp-topla-yedek-${startedAt.replace(/[:.]/g, "-")}.json`);
  const settings = await db.kalpToplaSettings.findUnique({ where: { id: "singleton" } });
  const backup = { file, source, startedAt, settings: JSON.parse(JSON.stringify(settings)) } as Backup;
  writeFileSync(file, JSON.stringify(backup, null, 2));
  console.log(`Yedek yazildi: ${path.basename(file)}`);
  return backup;
}

export async function cleanupTestData(db: Db, backup: Backup) {
  // Ayar once: silmelerden biri hata verse de mod eski haline donsun.
  if (backup.settings) {
    const data = { ...backup.settings, updatedAt: new Date(backup.settings.updatedAt) };
    await db.kalpToplaSettings.upsert({
      where: { id: "singleton" },
      create: data as Parameters<Db["kalpToplaSettings"]["create"]>[0]["data"],
      update: data
    });
  } else {
    await db.kalpToplaSettings.deleteMany({ where: { id: "singleton" } });
  }

  const startedAt = new Date(backup.startedAt);
  const customerIds = (await db.customer.findMany({ where: TEST_CUSTOMERS, select: { id: true } })).map((c) => c.id);
  const orderIds = (await db.order.findMany({ where: TEST_ORDERS, select: { id: true } })).map((o) => o.id);
  // Yedek aninda DB'de hic tur yoktu; o andan sonrakiler bu calismanindir.
  const roundIds = (await db.kalpRound.findMany({ where: { createdAt: { gte: startedAt } }, select: { id: true } })).map((r) => r.id);

  await db.auditLog.deleteMany({
    where: {
      OR: [
        { action: "KALP_TOPLA_TUR_KAPANDI", targetId: { in: roundIds } },
        { action: "KALP_TOPLA_TUR_KAPANDI", createdAt: { gte: startedAt }, detail: { contains: " · test" } },
        { actorEmail: TEST_ACTOR },
        { targetId: { in: [...orderIds, ...customerIds] } }
      ]
    }
  });
  await db.paymentLog.deleteMany({ where: { orderId: { in: orderIds } } });
  await db.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
  await db.order.deleteMany({ where: { id: { in: orderIds } } });
  await db.kalpHeart.deleteMany({ where: { customerId: { in: customerIds } } });
  await db.kalpCoupon.deleteMany({ where: { customerId: { in: customerIds } } });
  await db.kalpBar.deleteMany({ where: { currentRoundId: { in: roundIds } } });
  await db.kalpRound.deleteMany({ where: { id: { in: roundIds } } });
  await db.marketingConsentLog.deleteMany({ where: { customerId: { in: customerIds } } });
  await db.customerDevice.deleteMany({ where: { customerId: { in: customerIds } } });
  await db.emailVerificationToken.deleteMany({ where: { customerId: { in: customerIds } } });
  await db.customerCart.deleteMany({ where: { customerId: { in: customerIds } } });
  await db.customer.deleteMany({ where: { id: { in: customerIds } } });

  // Tamamlanan yedek bir daha geri yuklenmez: sonraki bir "temizle" yeni ayarlari ezmesin.
  const { file } = backup;
  writeFileSync(file, JSON.stringify({ ...backup, restoredAt: new Date().toISOString() }, null, 2));

  const left = await Promise.all([
    db.customer.count({ where: TEST_CUSTOMERS }),
    db.order.count({ where: TEST_ORDERS }),
    db.kalpHeart.count(),
    db.kalpRound.count(),
    db.kalpCoupon.count(),
    db.kalpBar.count(),
    db.auditLog.count({ where: { actorEmail: TEST_ACTOR } })
  ]);
  console.log(`Temizlik: kalan uye/siparis/kalp/tur/kupon/bar/denetim = ${left.join("/")}`);
}

// Yarida kalan calismayi en son yedege gore toparlar.
export async function recoverFromLatestBackup(db: Db) {
  const latest = readdirSync(BACKUP_DIR)
    .filter((name) => BACKUP_FILE.test(name))
    .sort()
    .at(-1);
  if (!latest) throw new Error("Yedek dosyasi yok, hicbir sey yapilmadi.");
  const backup = JSON.parse(readFileSync(path.join(BACKUP_DIR, latest), "utf8")) as Backup;
  if (backup.restoredAt) {
    console.log(`${latest} zaten geri yuklenmis (${backup.restoredAt}). Hicbir sey yapilmadi.`);
    return;
  }
  await cleanupTestData(db, backup);
  console.log(`Ayarlar ${latest} dosyasina gore geri yuklendi.`);
}
