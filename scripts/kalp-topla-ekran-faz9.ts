// Kalp Topla Faz 9 gorunurluk testi ve ekran goruntuleri icin gecici veri (canli DB, T13).
// Kullanicinin test verisine dokunmaz: yalniz 2 gecici uye ekler, modu gecici degistirir.
//   npx tsx scripts/kalp-topla-ekran-faz9.ts hazirla
//     -> ayarlari scripts/.kalp-topla-yedek-faz9-<tarih>.json dosyasina yazar, kt9-ekran-*
//        @example.invalid uyelerini olusturur (a: test hesabi, b: test disi).
//   npx tsx scripts/kalp-topla-ekran-faz9.ts mod OFF|HIDDEN
//   npx tsx scripts/kalp-topla-ekran-faz9.ts temizle
//     -> mod ve test hesaplari yedekten doner, yalniz kt9-ekran uyeleri ve kayitlari silinir.
// Sifre ve kimlikler sistemin gecici klasorunde tutulur. E-posta gondermez.
import "dotenv/config";
import os from "node:os";
import path from "node:path";
import { readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

const STATE = path.join(os.tmpdir(), "kalp-topla-ekran-faz9.json");
const CUSTOMERS = { email: { startsWith: "kt9-ekran-", endsWith: "@example.invalid" } };
const BACKUP = /^\.kalp-topla-yedek-faz9-.+\.json$/;

async function counts() {
  const [rounds, hearts, coupons, bars] = await Promise.all([
    prisma.kalpRound.count(),
    prisma.kalpHeart.count(),
    prisma.kalpCoupon.count(),
    prisma.kalpBar.count()
  ]);
  return `tur ${rounds}, kalp ${hearts}, kupon ${coupons}, bar ${bars}`;
}

async function prepare() {
  if ((await prisma.customer.count({ where: CUSTOMERS })) > 0) throw new Error("kt9 uyeleri zaten var. Once temizle.");
  const settings = await prisma.kalpToplaSettings.findUniqueOrThrow({ where: { id: "singleton" } });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.resolve("scripts", `.kalp-topla-yedek-faz9-${stamp}.json`);
  writeFileSync(file, JSON.stringify({ mode: settings.mode, testerCustomerIds: settings.testerCustomerIds, updatedAt: settings.updatedAt }, null, 2));

  const run = Date.now().toString(36);
  const password = `Kt9-${run}-ekran`;
  const passwordHash = await bcrypt.hash(password, 10);
  const create = (key: string) =>
    prisma.customer.create({
      data: { email: `kt9-ekran-${key}-${run}@example.invalid`, name: `Ekran Test ${key}`, passwordHash, emailVerifiedAt: new Date() }
    });
  const [a, b] = [await create("a"), await create("b")];
  await prisma.kalpToplaSettings.update({
    where: { id: "singleton" },
    data: { testerCustomerIds: [...settings.testerCustomerIds, a.id] }
  });
  writeFileSync(STATE, JSON.stringify({ tester: a.email, other: b.email, password }));
  console.log(`Hazir. Yedek: ${path.basename(file)}. ${await counts()}. Giris bilgisi: ${STATE}`);
}

async function setMode(mode: string | undefined) {
  if (mode !== "OFF" && mode !== "HIDDEN") throw new Error("Kullanim: mod OFF|HIDDEN");
  await prisma.kalpToplaSettings.update({ where: { id: "singleton" }, data: { mode } });
  console.log(`Mod: ${mode}`);
}

async function cleanup() {
  const latest = readdirSync("scripts").filter((name) => BACKUP.test(name)).sort().at(-1);
  if (!latest) throw new Error("Yedek yok, hicbir sey yapilmadi.");
  const backup = JSON.parse(readFileSync(path.join("scripts", latest), "utf8"));
  await prisma.kalpToplaSettings.update({
    where: { id: "singleton" },
    data: { mode: backup.mode, testerCustomerIds: backup.testerCustomerIds, updatedAt: new Date(backup.updatedAt) }
  });
  const ids = (await prisma.customer.findMany({ where: CUSTOMERS, select: { id: true } })).map((c) => c.id);
  await prisma.marketingConsentLog.deleteMany({ where: { customerId: { in: ids } } });
  await prisma.customerDevice.deleteMany({ where: { customerId: { in: ids } } });
  await prisma.emailVerificationToken.deleteMany({ where: { customerId: { in: ids } } });
  await prisma.customerCart.deleteMany({ where: { customerId: { in: ids } } });
  await prisma.customer.deleteMany({ where: { id: { in: ids } } });
  rmSync(STATE, { force: true });

  const settings = await prisma.kalpToplaSettings.findUniqueOrThrow({ where: { id: "singleton" } });
  console.log(
    `Temizlendi: ${ids.length} uye silindi, kalan kt9 uye ${await prisma.customer.count({ where: CUSTOMERS })}. ` +
      `Mod ${settings.mode}, test hesabi ${settings.testerCustomerIds.length}. ${await counts()}`
  );
}

async function main() {
  const [command, arg] = process.argv.slice(2);
  if (command === "hazirla") return prepare();
  if (command === "mod") return setMode(arg);
  if (command === "temizle") return cleanup();
  throw new Error("Kullanim: hazirla | mod OFF|HIDDEN | temizle");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
