// Kalp Topla Faz 5 scriptleri icin yedek, parmak izi ve temizlik (canli DB, T13).
// Faz 4 guvenliginden farki: kullanicinin Gizli yayin verisi DB'de dururken calisir.
// - Yalniz kt5-...@example.invalid uyelerine ve bari olmayan secilmis urunlere dokunur.
// - Mod yalniz Gizli yayin/Kapali arasinda degisir; "Acik" tipte de calismada da yoktur
//   (Acik'a geciste test verisi sifirlanir).
// - Ayar satiri geri yuklenmez: yalniz eklenen test hesaplari cikarilir, mod geri alinir.
// - Baslangicta ve temizlikten sonra tum Kalp Topla satirlari ve ayarlar karsilastirilir.
// Yedek: scripts/.kalp-topla-faz5-yedek-<tarih>.json (git disi).
// Kurtarma: npx tsx scripts/kalp-topla-senaryo-faz5.ts temizle
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { prisma as PrismaClient } from "../src/lib/prisma";

type Db = typeof PrismaClient;
export type ScriptMode = "OFF" | "HIDDEN";
export type Backup = {
  file: string;
  source: string;
  startedAt: string;
  productIds: string[];
  fingerprint: string;
  restoredAt?: string;
};

export const TEST_ACTOR = "kt5-senaryo";
const TEST_CUSTOMERS = { email: { startsWith: "kt5-", endsWith: "@example.invalid" } };
const BACKUP_DIR = path.resolve("scripts");
const BACKUP_FILE = /^\.kalp-topla-faz5-yedek-.+\.json$/;

// Senaryo uyeleri silindikten sonraki durum, baslangictakiyle birebir ayni olmali.
export async function fingerprint(db: Db): Promise<string> {
  const [settings, hearts, rounds, coupons, bars, invites, credits] = await Promise.all([
    db.kalpToplaSettings.findUnique({ where: { id: "singleton" } }),
    db.kalpHeart.findMany({ orderBy: { id: "asc" } }),
    db.kalpRound.findMany({ orderBy: { id: "asc" } }),
    db.kalpCoupon.findMany({ orderBy: { id: "asc" } }),
    db.kalpBar.findMany({ orderBy: { productId: "asc" } }),
    db.kalpInvite.findMany({ orderBy: { id: "asc" } }),
    db.kalpBonusCredit.findMany({ orderBy: { id: "asc" } })
  ]);
  const ayarlar = settings ? { ...settings, updatedAt: undefined, testerCustomerIds: [...settings.testerCustomerIds].sort() } : null;
  // Tur kapaninca degisen barlarin updatedAt'i karsilastirmaya girmez, satir degeri girer.
  const barlar = bars.map((b) => ({ ...b, updatedAt: undefined }));
  const davetler = invites.map((i) => i.id);
  return JSON.stringify({ ayarlar, kalpler: hearts, turlar: rounds, kuponlar: coupons, barlar, davetler, krediler: credits });
}

// Hicbir sey yazmadan once: mod Gizli yayin olmali, onceki calisma kalintisi olmamali,
// iki benzersiz indeks DB'de olmali.
export async function prepareRun(db: Db, source: string, productCount: number): Promise<Backup> {
  const settings = await db.kalpToplaSettings.findUnique({ where: { id: "singleton" } });
  if (settings?.mode !== "HIDDEN") throw new Error(`Mod Gizli yayin degil (${settings?.mode}). Hicbir sey yazilmadi.`);
  const leftovers = await db.customer.count({ where: TEST_CUSTOMERS });
  if (leftovers > 0) throw new Error(`Onceki calismadan ${leftovers} kt5 uyesi kalmis. Once temizle komutunu calistir.`);
  const indexes = await db.$queryRaw<{ indexname: string }[]>`
    SELECT indexname::text AS indexname FROM pg_indexes WHERE tablename = 'KalpBonusCredit'
    AND indexname IN ('KalpBonusCredit_splitFromId_key', 'KalpBonusCredit_root_unique')`;
  if (indexes.length !== 2) throw new Error("KalpBonusCredit benzersiz indeksleri yok. Hicbir sey yazilmadi.");

  const products = await db.product.findMany({
    where: { status: "PUBLISHED", kalpToplaExcluded: false },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: productCount + 20
  });
  const [bars, rounds] = await Promise.all([
    db.kalpBar.findMany({ select: { productId: true } }),
    db.kalpRound.findMany({ select: { productId: true } })
  ]);
  const used = new Set([...bars, ...rounds].map((r) => r.productId));
  const productIds = products.map((p) => p.id).filter((id) => !used.has(id)).slice(0, productCount);
  if (productIds.length < productCount) throw new Error("Yeterli bos urun yok. Hicbir sey yazilmadi.");

  const startedAt = new Date().toISOString();
  const file = path.join(BACKUP_DIR, `.kalp-topla-faz5-yedek-${startedAt.replace(/[:.]/g, "-")}.json`);
  const backup: Backup = { file, source, startedAt, productIds, fingerprint: await fingerprint(db) };
  writeFileSync(file, JSON.stringify(backup, null, 2));
  console.log(`Yedek yazildi: ${path.basename(file)}`);
  return backup;
}

// Tip geregi "LIVE" verilemez; calisma aninda da reddedilir.
export async function setMode(db: Db, mode: ScriptMode) {
  if ((mode as string) === "LIVE") throw new Error("Script modu Acik'a cevirmez.");
  await db.kalpToplaSettings.update({ where: { id: "singleton" }, data: { mode } });
}

export async function addTesters(db: Db, ids: string[]) {
  await db.kalpToplaSettings.update({ where: { id: "singleton" }, data: { testerCustomerIds: { push: ids } } });
}

export async function removeTesters(db: Db, ids: string[]) {
  const row = await db.kalpToplaSettings.findUniqueOrThrow({ where: { id: "singleton" } });
  await db.kalpToplaSettings.update({
    where: { id: "singleton" },
    data: { testerCustomerIds: row.testerCustomerIds.filter((id) => !ids.includes(id)) }
  });
}

// Yalniz kendi satirlarini siler, ardindan parmak izini karsilastirir. Fark varsa false.
export async function cleanupAndVerify(db: Db, backup: Backup): Promise<boolean> {
  const before = JSON.parse(backup.fingerprint) as { ayarlar: { mode: string } | null };
  const customerIds = (await db.customer.findMany({ where: TEST_CUSTOMERS, select: { id: true } })).map((c) => c.id);

  // Ayar once: silmelerden biri hata verse de mod ve test listesi geri donsun.
  await setMode(db, before.ayarlar!.mode as ScriptMode);
  await removeTesters(db, customerIds);

  const roundIds = (await db.kalpRound.findMany({ where: { productId: { in: backup.productIds } }, select: { id: true } })).map((r) => r.id);
  const inviteIds = (await db.kalpInvite.findMany({ where: { inviterId: { in: customerIds } }, select: { id: true } })).map((i) => i.id);
  await db.auditLog.deleteMany({
    where: {
      OR: [
        { action: "KALP_TOPLA_TUR_KAPANDI", targetId: { in: roundIds } },
        { actorEmail: TEST_ACTOR },
        { targetId: { in: [...inviteIds, ...customerIds] } }
      ]
    }
  });
  await db.kalpBonusCredit.deleteMany({ where: { customerId: { in: customerIds } } });
  await db.kalpInvite.deleteMany({ where: { id: { in: inviteIds } } });
  await db.kalpHeart.deleteMany({ where: { customerId: { in: customerIds } } });
  await db.kalpCoupon.deleteMany({ where: { customerId: { in: customerIds } } });
  await db.kalpBar.deleteMany({ where: { productId: { in: backup.productIds } } });
  await db.kalpRound.deleteMany({ where: { id: { in: roundIds } } });
  await db.marketingConsentLog.deleteMany({ where: { customerId: { in: customerIds } } });
  await db.customerDevice.deleteMany({ where: { customerId: { in: customerIds } } });
  await db.emailVerificationToken.deleteMany({ where: { customerId: { in: customerIds } } });
  await db.customerCart.deleteMany({ where: { customerId: { in: customerIds } } });
  await db.customer.deleteMany({ where: { id: { in: customerIds } } });

  writeFileSync(backup.file, JSON.stringify({ ...backup, restoredAt: new Date().toISOString() }, null, 2));

  const after = await fingerprint(db);
  const same = after === backup.fingerprint;
  console.log(same ? "Parmak izi ayni: kullanici verisi, mod, esikler ve test hesaplari degismedi." : "PARMAK IZI FARKLI!");
  if (!same) {
    const a = JSON.parse(backup.fingerprint) as Record<string, unknown>;
    const b = JSON.parse(after) as Record<string, unknown>;
    for (const key of Object.keys(a)) {
      if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) console.log(`FARK: ${key}`);
    }
  }
  return same;
}

export async function recoverFromLatestBackup(db: Db): Promise<boolean> {
  const latest = readdirSync(BACKUP_DIR)
    .filter((name) => BACKUP_FILE.test(name))
    .sort()
    .at(-1);
  if (!latest) throw new Error("Yedek dosyasi yok, hicbir sey yapilmadi.");
  const backup = JSON.parse(readFileSync(path.join(BACKUP_DIR, latest), "utf8")) as Backup;
  if (backup.restoredAt) {
    console.log(`${latest} zaten temizlenmis (${backup.restoredAt}). Hicbir sey yapilmadi.`);
    return true;
  }
  return cleanupAndVerify(db, backup);
}
