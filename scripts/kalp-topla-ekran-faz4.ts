// Kalp Topla Faz 4 ekran goruntuleri icin gecici veri (canli DB, T13).
// Calistirmadan once kullanicinin acik onayi gerekir.
//   npx tsx scripts/kalp-topla-ekran-faz4.ts hazirla
//     -> 2 gecici test uyesi (@example.invalid, giris yapilabilir sifreyle),
//        mod Gizli yayin (yalniz bu uyeler test hesabi), test esigi 3, B'nin 1 kalbi.
//        DB'de Kalp Topla verisi varsa hicbir sey yazmadan durur.
//   npx tsx scripts/kalp-topla-ekran-faz4.ts temizle
//     -> yalniz hazirla'nin olusturdugu satirlar (ve bu uyelerin giris cihaz
//        kayitlari, onay kayitlari, sepetleri) silinir, ayarlar geri yuklenir.
// Durum (sifre, uye kimlikleri, eski ayarlar) sistemin gecici klasorunde tutulur.
// E-posta gondermez (RESEND_API_KEY bu surecte kaldirilir).
import "dotenv/config";
import Module from "node:module";
import os from "node:os";
import path from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import bcrypt from "bcryptjs";

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
    const existing = (await prisma.kalpHeart.count()) + (await prisma.kalpRound.count()) + (await prisma.kalpCoupon.count());
    if (existing > 0) throw new Error("DB'de Kalp Topla verisi var, hazirlik yapilmadi.");
    const original = await prisma.kalpToplaSettings.findUnique({ where: { id: "singleton" } });
    const product = await prisma.product.findFirst({
      where: { status: "PUBLISHED", kalpToplaExcluded: false, images: { some: {} }, variants: { some: { stock: { gt: 0 } } } },
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
    writeFileSync(
      STATE,
      JSON.stringify({ original, customers: [a.id, b.id], productId: product.id, slug: product.slug, email: a.email, password })
    );
    await prisma.kalpToplaSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", mode: "HIDDEN", testerCustomerIds: [a.id, b.id], testThreshold: 3 },
      update: { mode: "HIDDEN", testerCustomerIds: [a.id, b.id], testThreshold: 3 }
    });
    const { giveHeart } = await import("../src/lib/kalp-topla/bar");
    await giveHeart(b.id, product.id);
    console.log(`Hazir. Urun: /urunler/${product.slug} · giris: ${a.email} (sifre ${STATE} icinde)`);
    return;
  }

  if (mode === "temizle") {
    const state = JSON.parse(readFileSync(STATE, "utf8"));
    const ids: string[] = state.customers;
    const roundIds = (await prisma.kalpRound.findMany({ where: { productId: state.productId }, select: { id: true } })).map((r) => r.id);
    await prisma.auditLog.deleteMany({ where: { action: "KALP_TOPLA_TUR_KAPANDI", targetId: { in: roundIds } } });
    await prisma.kalpHeart.deleteMany({ where: { customerId: { in: ids } } });
    await prisma.kalpCoupon.deleteMany({ where: { customerId: { in: ids } } });
    await prisma.kalpBar.deleteMany({ where: { productId: state.productId } });
    await prisma.kalpRound.deleteMany({ where: { productId: state.productId } });
    await prisma.marketingConsentLog.deleteMany({ where: { customerId: { in: ids } } });
    await prisma.customerDevice.deleteMany({ where: { customerId: { in: ids } } });
    await prisma.emailVerificationToken.deleteMany({ where: { customerId: { in: ids } } });
    await prisma.customerCart.deleteMany({ where: { customerId: { in: ids } } });
    await prisma.customer.deleteMany({ where: { id: { in: ids } } });
    if (state.original) {
      const { updatedAt: _ignored, ...rest } = state.original;
      void _ignored;
      await prisma.kalpToplaSettings.update({ where: { id: "singleton" }, data: rest });
    } else {
      await prisma.kalpToplaSettings.deleteMany({ where: { id: "singleton" } });
    }
    const left = [
      await prisma.customer.count({ where: { id: { in: ids } } }),
      await prisma.kalpHeart.count(),
      await prisma.kalpRound.count(),
      await prisma.kalpCoupon.count(),
      await prisma.kalpBar.count(),
      await prisma.customerDevice.count({ where: { customerId: { in: ids } } })
    ];
    console.log(`Temizlik: kalan uye/kalp/tur/kupon/bar/cihaz = ${left.join("/")}`);
    console.log(`Ayar: ${JSON.stringify(await prisma.kalpToplaSettings.findUnique({ where: { id: "singleton" }, select: { mode: true, testerCustomerIds: true } }))}`);
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
