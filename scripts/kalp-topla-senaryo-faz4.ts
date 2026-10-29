// Kalp Topla Faz 4 DB senaryolari (KALP_TOPLA_PLANI.md 10.1, 10.3, 10.9; T13).
// Canli DB'de calisir, bu yuzden:
// - Baslamadan once DB'de hic kalp/tur/kupon yoksa calisir; varsa hicbir sey
//   yazmadan durur (kullanicinin kendi test verisi silinmesin diye).
// - Gecici test uyeleri (@example.invalid) acar; mevcut uyelere dokunmaz.
// - KalpToplaSettings'i gecici olarak degistirir, sonunda eski haline getirir.
// - Y15 icin silinmis-isaretli (deletedAt dolu: admin listesinde ve Vega'da
//   gorunmez), odeme denemesi olmayan 2 sahte siparis acar.
// - Sonunda yalniz kendi olusturdugu satirlari siler ve kalan sayisini yazar.
// - E-posta gondermez (RESEND_API_KEY bu surecte kaldirilir).
//
// Calistirma: npx tsx scripts/kalp-topla-senaryo-faz4.ts
import "dotenv/config";
import Module from "node:module";
import path from "node:path";

delete process.env.RESEND_API_KEY;
// "server-only" Next'in icinde gelir; script disinda bos modul yuklenir.
const moduleWithResolve = Module as unknown as { _resolveFilename: (request: string, ...rest: unknown[]) => string };
const originalResolve = moduleWithResolve._resolveFilename;
moduleWithResolve._resolveFilename = function (request: string, ...rest: unknown[]) {
  if (request === "server-only") return path.resolve("node_modules/next/dist/compiled/server-only/empty.js");
  return originalResolve.call(this, request, ...rest);
};

const RUN = Date.now().toString(36);
const ACTOR = "kt4-senaryo";
let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail = "") {
  if (ok) passed += 1;
  else failed += 1;
  console.log(`${ok ? "OK  " : "HATA"} ${name}${detail ? ` (${detail})` : ""}`);
}

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const bar = await import("../src/lib/kalp-topla/bar");
  const { campaignStateFrom, getKalpSettings } = await import("../src/lib/kalp-topla/settings");
  const { getTestResetSummary, switchToLiveWithReset } = await import("../src/lib/kalp-topla/test-reset");

  const [hearts0, rounds0, coupons0, bars0] = await Promise.all([
    prisma.kalpHeart.count(),
    prisma.kalpRound.count(),
    prisma.kalpCoupon.count(),
    prisma.kalpBar.count()
  ]);
  if (hearts0 + rounds0 + coupons0 + bars0 > 0) {
    console.log(`DB'de mevcut Kalp Topla verisi var (kalp ${hearts0}, tur ${rounds0}, kupon ${coupons0}, bar ${bars0}). Hicbir sey yazilmadi.`);
    return;
  }

  const startedAt = new Date();
  const originalSettings = await prisma.kalpToplaSettings.findUnique({ where: { id: "singleton" } });
  const products = await prisma.product.findMany({
    where: { status: "PUBLISHED", kalpToplaExcluded: false },
    select: { id: true, priceCents: true },
    orderBy: { createdAt: "asc" },
    take: 6
  });
  if (products.length < 6) throw new Error("En az 6 yayinda urun gerekli.");
  const P = products.map((p) => p.id);
  const customerIds: string[] = [];
  const orderIds: string[] = [];

  const setSettings = (data: Record<string, unknown>) =>
    prisma.kalpToplaSettings.upsert({ where: { id: "singleton" }, create: { id: "singleton", ...data }, update: data });
  const points = async (productId: string) => (await prisma.kalpBar.findUnique({ where: { productId } }))?.points ?? 0;
  const currentRound = async (productId: string) => {
    const b = await prisma.kalpBar.findUniqueOrThrow({ where: { productId } });
    return prisma.kalpRound.findUniqueOrThrow({ where: { id: b.currentRoundId } });
  };
  const errorCode = async (run: Promise<unknown>) => {
    try {
      await run;
      return "OK";
    } catch (error) {
      if (error instanceof bar.KalpError) return error.code;
      throw error;
    }
  };

  try {
    for (let i = 0; i < 16; i += 1) {
      const c = await prisma.customer.create({
        data: {
          email: `kt4-${RUN}-${i}@example.invalid`,
          name: `KT4 Test ${i}`,
          passwordHash: "senaryo-giris-yok",
          emailVerifiedAt: i < 14 ? new Date() : null
        }
      });
      customerIds.push(c.id);
    }
    const C = customerIds;
    await setSettings({ mode: "HIDDEN", testerCustomerIds: C, threshold: 10, testThreshold: 3, heartQuota: 3, couponHours: 48 });
    let settings = await getKalpSettings();

    // --- Gorunurluk (10.9 HIDDEN) ---
    check("HIDDEN: misafir INVISIBLE", (await campaignStateFrom(settings, null)) === "INVISIBLE");
    check("HIDDEN: test disi uye INVISIBLE", (await campaignStateFrom(settings, "baska-uye")) === "INVISIBLE");
    check("HIDDEN: test hesabi ACTIVE", (await campaignStateFrom(settings, C[0])) === "ACTIVE");
    check("HIDDEN: test disi icin bar ucu bos (404)", (await bar.getBarView(null, P[0])) === null);
    check("HIDDEN: test disi kalp veremez", (await errorCode(bar.giveHeart("baska-uye", P[0]))) === "NOT_FOUND");

    // --- Esik 3 ile tur kapanisi (Faz 4 kosulu) ---
    for (const c of C.slice(0, 3)) await bar.giveHeart(c, P[0]);
    const closed1 = await prisma.kalpRound.findFirst({ where: { productId: P[0], roundNo: 1 } });
    const coupons1 = await prisma.kalpCoupon.findMany({ where: { roundId: closed1?.id } });
    check("Esik 3: tur kapandi", closed1?.status === "CLOSED" && closed1.isTest && closed1.threshold === 3);
    check("Esik 3: 3 test kuponu", coupons1.length === 3 && coupons1.every((k) => k.isTest && k.status === "AVAILABLE" && /^KALP-[A-Z2-9]{6}$/.test(k.code)));
    const hours = closed1?.closedAt ? (coupons1[0].expiresAt.getTime() - closed1.closedAt.getTime()) / 3_600_000 : 0;
    check("Esik 3: kupon suresi 48 saat", Math.abs(hours - 48) < 0.01, `${hours} saat`);
    const r2 = await currentRound(P[0]);
    check("Esik 3: yeni tur 0 puan, test, esik 3", r2.roundNo === 2 && r2.isTest && r2.threshold === 3 && (await points(P[0])) === 0);
    check("Esik 3: kalpler WON", (await prisma.kalpHeart.count({ where: { roundId: closed1?.id, status: "WON" } })) === 3);
    check("Tur kapanisi denetim kaydi", (await prisma.auditLog.count({ where: { action: "KALP_TOPLA_TUR_KAPANDI", targetId: closed1?.id } })) === 1);

    // --- 10.1: bar 9/10, 5 es zamanli kalp ---
    await setSettings({ testThreshold: 10 });
    settings = await getKalpSettings();
    for (const c of C.slice(0, 9)) await bar.giveHeart(c, P[1]);
    check("10.1 hazirlik: bar 9", (await points(P[1])) === 9);
    const results = await Promise.allSettled(C.slice(9, 14).map((c) => bar.giveHeart(c, P[1])));
    check("10.1: 5 istegin hepsi kabul", results.every((r) => r.status === "fulfilled"), results.filter((r) => r.status === "rejected").map((r) => String((r as PromiseRejectedResult).reason)).join("; "));
    const p1Closed = await prisma.kalpRound.findMany({ where: { productId: P[1], status: "CLOSED" } });
    check("10.1: tek kapanis", p1Closed.length === 1, `${p1Closed.length}`);
    check("10.1: 10 kupon", (await prisma.kalpCoupon.count({ where: { roundId: p1Closed[0]?.id } })) === 10);
    check("10.1: yeni turda 4", (await points(P[1])) === 4 && (await currentRound(P[1])).roundNo === 2);
    check("10.1: 10 WON + 4 ACTIVE", (await prisma.kalpHeart.count({ where: { productId: P[1], status: "WON" } })) === 10 && (await prisma.kalpHeart.count({ where: { productId: P[1], status: "ACTIVE" } })) === 4);

    // --- 10.1: ayni uye ayni urune 3 es zamanli istek ---
    await Promise.allSettled([0, 1, 2].map(() => bar.giveHeart(C[0], P[2])));
    check("10.1: ayni uye 3 istek -> tek kalp", (await prisma.kalpHeart.count({ where: { customerId: C[0], productId: P[2] } })) === 1 && (await points(P[2])) === 1);

    // --- 10.1: 2 hakki dolu uye, 3 es zamanli kalp -> yalniz 1 ---
    await bar.giveHeart(C[1], P[2]);
    await bar.giveHeart(C[1], P[3]);
    const quotaResults = await Promise.allSettled([P[4], P[0], P[1]].map((p) => bar.giveHeart(C[1], p)));
    const quotaErrors = quotaResults.filter((r) => r.status === "rejected" && (r.reason as { code?: string }).code === "QUOTA").length;
    check("10.1: 3 es zamanli kalpten 1 kabul, 2 hak dolu", quotaResults.filter((r) => r.status === "fulfilled").length === 1 && quotaErrors === 2);
    check("10.1: acik kalp sayisi 3", (await prisma.kalpHeart.count({ where: { customerId: C[1], status: { in: ["PENDING", "ACTIVE"] } } })) === 3);

    // --- 10.1 / T1: 3 PENDING kalp, 4. verilemez ---
    const before = { p0: await points(P[0]), p2: await points(P[2]), p3: await points(P[3]) };
    for (const p of [P[0], P[2], P[3]]) await bar.giveHeart(C[14], p);
    check("T1: dogrulanmamis uyenin kalpleri PENDING", (await prisma.kalpHeart.count({ where: { customerId: C[14], status: "PENDING" } })) === 3);
    check("T1: PENDING bar sayisina girmez", (await points(P[0])) === before.p0 && (await points(P[2])) === before.p2 && (await points(P[3])) === before.p3);
    check("T1: 4. kalp hak dolu", (await errorCode(bar.giveHeart(C[14], P[4]))) === "QUOTA");
    await prisma.customer.update({ where: { id: C[14] }, data: { emailVerifiedAt: new Date() } });
    const activated = await bar.activatePendingHearts(C[14]);
    check("5.4: dogrulaninca 3 kalp ACTIVE ve sayildi", activated === 3 && (await points(P[2])) === before.p2 + 1 && (await points(P[3])) === before.p3 + 1);

    // --- Kullanici karari Q1: kampanya o uye icin aktif degilken bekler ---
    const p4Before = await points(P[4]);
    await bar.giveHeart(C[15], P[4]);
    await setSettings({ mode: "OFF" });
    await prisma.customer.update({ where: { id: C[15] }, data: { emailVerifiedAt: new Date() } });
    check("Q1: kapaliyken dogrulanan kalp bekler", (await bar.activatePendingHearts(C[15])) === 0);
    await setSettings({ mode: "HIDDEN" });
    check("Q1: kampanya acilinca sayilir", (await bar.activatePendingHearts(C[15])) === 1 && (await points(P[4])) === p4Before + 1);

    // --- FROZEN (10.3, 10.9, Y8) ve kullanici karari Q2 ---
    await setSettings({ mode: "OFF" });
    settings = await getKalpSettings();
    check("Q2: OFF + yalniz test turu: test disi INVISIBLE", (await campaignStateFrom(settings, "baska-uye")) === "INVISIBLE");
    check("Q2: OFF + yalniz test turu: test hesabi FROZEN", (await campaignStateFrom(settings, C[0])) === "FROZEN");
    check("FROZEN: yeni kalp 409", (await errorCode(bar.giveHeart(C[2], P[5]))) === "FROZEN");
    const p2Before = await points(P[2]);
    check("FROZEN: geri cekme calisir", (await errorCode(bar.withdrawHeart(C[0], P[2]))) === "OK" && (await points(P[2])) === p2Before - 1);
    check("10.3: tur kapandiktan sonra geri cekme reddedilir", (await errorCode(bar.withdrawHeart(C[0], P[0]))) === "ROUND_CLOSED");
    await setSettings({ mode: "HIDDEN" });
    check("Acilinca ayni sayidan devam", (await points(P[2])) === p2Before - 1);

    // --- T16 ve Y12: acik tur kendi esigiyle, yeni test turu test esigiyle ---
    await setSettings({ testThreshold: 2 });
    check("T16: acik tur esigi degismez (10)", (await currentRound(P[1])).threshold === 10);
    await bar.giveHeart(C[2], P[5]);
    await bar.giveHeart(C[3], P[5]);
    const p5Closed = await prisma.kalpRound.findFirst({ where: { productId: P[5], roundNo: 1 } });
    check("Y12: test turu esik 2, 2 test hesabiyla doldu, kuponlar test", p5Closed?.status === "CLOSED" && p5Closed.threshold === 2 && (await prisma.kalpCoupon.count({ where: { roundId: p5Closed.id, isTest: true } })) === 2);

    // --- Y12/Y15 sifirlama ---
    const testCoupons = await prisma.kalpCoupon.findMany({ where: { customerId: C[2], isTest: true }, orderBy: { createdAt: "asc" } });
    const [reservedCoupon, usedCoupon] = testCoupons;
    const fakeOrder = (n: number, data: Record<string, unknown>) =>
      prisma.order.create({
        data: {
          orderNumber: `KT4-${RUN}-${n}`,
          customerName: "KT4 Test",
          customerEmail: `kt4-${RUN}@example.invalid`,
          customerPhone: "0000000000",
          shippingAddress: "senaryo",
          city: "senaryo",
          district: "senaryo",
          subtotalCents: products[0].priceCents,
          totalCents: products[0].priceCents,
          deletedAt: new Date(),
          deletedByEmail: ACTOR,
          ...data
        }
      });
    const unpaid = await fakeOrder(1, { status: "PENDING_PAYMENT", paymentStatus: "UNPAID" });
    const paid = await fakeOrder(2, { status: "DELIVERED", paymentStatus: "PAID" });
    orderIds.push(unpaid.id, paid.id);
    for (const [order, coupon] of [
      [unpaid, reservedCoupon],
      [paid, usedCoupon]
    ] as const) {
      await prisma.orderItem.create({
        data: { orderId: order.id, productId: P[0], quantity: 1, unitPriceCents: 100, totalCents: 100, kalpCouponId: coupon.id }
      });
    }
    await prisma.kalpCoupon.update({ where: { id: reservedCoupon.id }, data: { status: "RESERVED" } });
    await prisma.kalpCoupon.update({ where: { id: usedCoupon.id }, data: { status: "USED", usedAt: new Date() } });

    const summary = await getTestResetSummary();
    const expected = {
      rounds: await prisma.kalpRound.count({ where: { isTest: true } }),
      hearts: await prisma.kalpHeart.count({ where: { customerId: { in: C } } }),
      unused: await prisma.kalpCoupon.count({ where: { isTest: true, status: "AVAILABLE" } })
    };
    check(
      "Onay penceresi sayilari dogru",
      summary?.rounds === expected.rounds && summary.hearts === expected.hearts && summary.unusedCoupons === expected.unused && summary.paidOrders === 1,
      JSON.stringify({ ...summary, unpaidOrders: summary?.unpaidOrders.length })
    );
    check("Odenmemis test siparisi listede", summary?.unpaidOrders.length === 1 && summary.unpaidOrders[0].id === unpaid.id);

    const actor = { actorEmail: ACTOR, actorRole: "SISTEM", previousModeLabel: "Gizli yayın" };
    const declined = await switchToLiveWithReset({ ...actor, cancelOrders: false });
    check(
      "Vazgec/onaysiz: hicbir sey degismez",
      !declined.ok && (await getKalpSettings()).mode === "HIDDEN" && (await prisma.kalpRound.count({ where: { isTest: true } })) === expected.rounds
    );
    await prisma.order.update({ where: { id: unpaid.id }, data: { paymentStatus: "PROCESSING" } });
    const inProgress = await switchToLiveWithReset({ ...actor, cancelOrders: true });
    check(
      "Odeme suruyorsa gecis durur",
      !inProgress.ok && inProgress.reason === "PAYMENT_IN_PROGRESS" && (await getKalpSettings()).mode === "HIDDEN" && (await prisma.order.findUniqueOrThrow({ where: { id: unpaid.id } })).status === "PENDING_PAYMENT"
    );
    await prisma.order.update({ where: { id: unpaid.id }, data: { paymentStatus: "UNPAID" } });

    const reset = await switchToLiveWithReset({ ...actor, cancelOrders: true });
    check("Siparisleri iptal et ve devam et: tamam", reset.ok && reset.cancelledOrders.length === 1);
    check("Mod LIVE", (await getKalpSettings()).mode === "LIVE");
    check("Test turlari ve kalpleri silindi", (await prisma.kalpRound.count({ where: { isTest: true } })) === 0 && (await prisma.kalpHeart.count({ where: { customerId: { in: C } } })) === 0);
    check("Test barlari silindi", (await prisma.kalpBar.count({ where: { productId: { in: P } } })) === 0);
    check("Kullanilmamis test kuponlari TEST_CANCELLED", (await prisma.kalpCoupon.count({ where: { isTest: true, status: "AVAILABLE" } })) === 0 && (await prisma.kalpCoupon.count({ where: { isTest: true, status: "TEST_CANCELLED" } })) === expected.unused + 1);
    check("Odenmemis siparis iptal, kuponu TEST_CANCELLED", (await prisma.order.findUniqueOrThrow({ where: { id: unpaid.id } })).status === "CANCELLED" && (await prisma.kalpCoupon.findUniqueOrThrow({ where: { id: reservedCoupon.id } })).status === "TEST_CANCELLED");
    check("Odenmis test siparisi silinmedi, kalpTestAt dolu, kuponu USED", Boolean((await prisma.order.findUniqueOrThrow({ where: { id: paid.id } })).kalpTestAt) && (await prisma.kalpCoupon.findUniqueOrThrow({ where: { id: usedCoupon.id } })).status === "USED");
    check("Sifirlama denetim kaydi", (await prisma.auditLog.count({ where: { action: "KALP_TOPLA_TEST_SIFIRLANDI", actorEmail: ACTOR } })) === 1);

    await bar.giveHeart(C[0], P[0]);
    const fresh = await currentRound(P[0]);
    check("Sifirlama sonrasi bar normal esikle (10) 0'dan", fresh.threshold === 10 && !fresh.isTest && fresh.roundNo === 1 && (await points(P[0])) === 1);

    // --- HIDDEN -> OFF -> LIVE yolu; gercek veri silinmez ---
    await setSettings({ mode: "HIDDEN", testThreshold: 5 });
    await bar.giveHeart(C[1], P[5]);
    await setSettings({ mode: "OFF" });
    const viaOff = await switchToLiveWithReset({ ...actor, previousModeLabel: "Kapalı", cancelOrders: false });
    check("HIDDEN->OFF->LIVE: test turu silindi", viaOff.ok && (await prisma.kalpRound.count({ where: { isTest: true } })) === 0);
    check("HIDDEN->OFF->LIVE: gercek tur ve kalp korundu", (await points(P[0])) === 1 && (await prisma.kalpHeart.count({ where: { customerId: C[0], status: "ACTIVE" } })) === 1);
  } finally {
    // Yalniz bu scriptin olusturdugu satirlar.
    const roundIds = (await prisma.kalpRound.findMany({ where: { productId: { in: P } }, select: { id: true } })).map((r) => r.id);
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { action: "KALP_TOPLA_TUR_KAPANDI", targetId: { in: roundIds } },
          { action: "KALP_TOPLA_TUR_KAPANDI", createdAt: { gte: startedAt }, detail: { contains: " · test" } },
          { actorEmail: ACTOR },
          { targetId: { in: orderIds } }
        ]
      }
    });
    await prisma.paymentLog.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.kalpHeart.deleteMany({ where: { customerId: { in: customerIds } } });
    await prisma.kalpCoupon.deleteMany({ where: { customerId: { in: customerIds } } });
    await prisma.kalpBar.deleteMany({ where: { productId: { in: P } } });
    await prisma.kalpRound.deleteMany({ where: { productId: { in: P } } });
    await prisma.emailVerificationToken.deleteMany({ where: { customerId: { in: customerIds } } });
    await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
    if (originalSettings) {
      const { updatedAt: _ignored, ...rest } = originalSettings;
      void _ignored;
      await prisma.kalpToplaSettings.update({ where: { id: "singleton" }, data: rest });
    } else {
      await prisma.kalpToplaSettings.deleteMany({ where: { id: "singleton" } });
    }

    const left = await Promise.all([
      prisma.customer.count({ where: { id: { in: customerIds } } }),
      prisma.order.count({ where: { id: { in: orderIds } } }),
      prisma.kalpHeart.count(),
      prisma.kalpRound.count(),
      prisma.kalpCoupon.count(),
      prisma.kalpBar.count(),
      prisma.auditLog.count({ where: { actorEmail: ACTOR } })
    ]);
    const settingsNow = await prisma.kalpToplaSettings.findUnique({ where: { id: "singleton" } });
    console.log(`Temizlik: kalan uye/siparis/kalp/tur/kupon/bar/denetim = ${left.join("/")}`);
    console.log(`Ayarlar geri yuklendi: ${originalSettings ? settingsNow?.mode === originalSettings.mode : settingsNow === null}`);
  }
  console.log(`\nSonuc: ${passed} OK, ${failed} HATA`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
