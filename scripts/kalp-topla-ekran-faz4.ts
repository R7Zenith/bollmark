// Kalp Topla Faz 4 ekran goruntuleri icin gecici veri (canli DB, T13).
// Calistirmadan once kullanicinin acik onayi gerekir.
//   npx tsx scripts/kalp-topla-ekran-faz4.ts hazirla
//     -> 2 gecici test uyesi (@example.invalid, giris yapilabilir sifreyle),
//        mod Gizli yayin (yalniz bu uyeler test hesabi), test esigi 3, B'nin 1 kalbi.
//        DB'de Kalp Topla verisi varsa hicbir sey yazmadan durur. Ayarlari once
//        scripts/.kalp-topla-yedek-<tarih>.json dosyasina yazar; hazirlik hata ya da
//        Ctrl+C ile yarida kalirsa kendi yazdiklarini geri alir.
//   npx tsx scripts/kalp-topla-ekran-faz4.ts temizle
//     -> yalniz hazirla'nin olusturdugu satirlar (ve bu uyelerin giris cihaz
//        kayitlari, onay kayitlari, sepetleri) silinir, ayarlar yedekten geri
//        yuklenir, sifre dosyasi silinir.
// Durum (sifre, uye kimlikleri) sistemin gecici klasorunde tutulur.
// E-posta gondermez (RESEND_API_KEY bu surecte kaldirilir).
import "dotenv/config";
import Module from "node:module";
import os from "node:os";
import path from "node:path";
import { rmSync, writeFileSync } from "node:fs";
import bcrypt from "bcryptjs";
import { cleanupTestData, prepareRun, recoverFromLatestBackup, watchInterrupt } from "./kalp-topla-test-guvenlik";

delete process.env.RESEND_API_KEY;
// "server-only" Next'in icinde gelir; script disinda bos modul yuklenir.
const moduleWithResolve = Module as unknown as { _resolveFilename: (request: string, ...rest: unknown[]) => string };
const originalResolve = moduleWithResolve._resolveFilename;
moduleWithResolve._resolveFilename = function (request: string, ...rest: unknown[]) {
  if (request === "server-only") return path.resolve("node_modules/next/dist/compiled/server-only/empty.js");
  return originalResolve.call(this, request, ...rest);
};

const STATE = path.join(os.tmpdir(), "kalp-topla-ekran-faz4.json");

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const mode = process.argv[2];

  if (mode === "hazirla") {
    const assertRunning = watchInterrupt();
    const backup = await prepareRun(prisma, "ekran");
    try {
      const product = await prisma.product.findFirst({
        where: { status: "PUBLISHED", kalpToplaExcluded: false, optionImages: { some: {} }, variants: { some: { stock: { gt: 0 } } } },
        orderBy: { createdAt: "desc" },
        select: { id: true, slug: true }
      });
      if (!product) throw new Error("Uygun urun yok.");
      const run = Date.now().toString(36);
      const password = `Kt4-${run}-ekran`;
      const passwordHash = await bcrypt.hash(password, 10);
      const a = await prisma.customer.create({
        data: { email: `kt4-ekran-a-${run}@example.invalid`, name: "Ekran Test", passwordHash, emailVerifiedAt: new Date() }
      });
      const b = await prisma.customer.create({
        data: { email: `kt4-ekran-b-${run}@example.invalid`, name: "Ekran Test B", passwordHash, emailVerifiedAt: new Date() }
      });
      writeFileSync(STATE, JSON.stringify({ customers: [a.id, b.id], productId: product.id, slug: product.slug, email: a.email, password }));
      assertRunning();
      await prisma.kalpToplaSettings.upsert({
        where: { id: "singleton" },
        create: { id: "singleton", mode: "HIDDEN", testerCustomerIds: [a.id, b.id], testThreshold: 3 },
        update: { mode: "HIDDEN", testerCustomerIds: [a.id, b.id], testThreshold: 3 }
      });
      const { giveHeart } = await import("../src/lib/kalp-topla/bar");
      await giveHeart(b.id, product.id);
      assertRunning();
      console.log(`Hazir. Urun: /urunler/${product.slug} · giris: ${a.email} (sifre ${STATE} icinde)`);
    } catch (error) {
      await cleanupTestData(prisma, backup);
      rmSync(STATE, { force: true });
      throw error;
    }
    return;
  }

  if (mode === "temizle") {
    await recoverFromLatestBackup(prisma);
    rmSync(STATE, { force: true });
    return;
  }
  throw new Error("Kullanim: hazirla | temizle");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
