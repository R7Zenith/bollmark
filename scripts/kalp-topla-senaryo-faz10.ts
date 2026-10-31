// Kalp Topla Faz 10 rapor sayimi (KALP_TOPLA_PLANI.md 6.11, 9; T13). Canli DB'de calisir:
// - Kullanicinin verisine dokunmaz. Eklenen her kaydin kimligi durum dosyasina yazilir,
//   temizlik yalniz onlari siler. Mod ve ayarlar degismez.
// - Rapor once olculur, sonra fark beklenen sayilarla karsilastirilir.
// - Siparisler DELIVERED ve paidAt bos: Vega sorgusuna girmez, stok ve puan islemez.
// - E-posta gitmez: uretilen bildirimler NOT_APPLICABLE isaretlenir.
//
// Calistirma: npx tsx scripts/kalp-topla-senaryo-faz10.ts hazirla | dogrula | bildirim | islem-sonrasi | temizle
import "dotenv/config";
import Module from "node:module";
import os from "node:os";
import path from "node:path";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

const moduleWithResolve = Module as unknown as { _resolveFilename: (request: string, ...rest: unknown[]) => string };
const originalResolve = moduleWithResolve._resolveFilename;
moduleWithResolve._resolveFilename = function (request: string, ...rest: unknown[]) {
  if (request === "server-only") return path.resolve("node_modules/next/dist/compiled/server-only/empty.js");
  return originalResolve.call(this, request, ...rest);
};

if (process.env.VERCEL) throw new Error("Yalniz yerelde calisir.");

const STATE = path.join(os.tmpdir(), "kalp-topla-senaryo-faz10.json");
const HOUR = 60 * 60 * 1000;
let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (ok) passed += 1;
  else failed += 1;
  console.log(`${ok ? "OK  " : "HATA"} ${name}${detail ? ` (${detail})` : ""}`);
};

type Numbers = Record<string, number>;
type State = {
  run: string;
  password: string;
  adminEmail: string;
  adminId: string;
  customers: Record<string, string>;
  rounds: string[];
  bars: string[];
  hearts: string[];
  coupons: Record<string, string>;
  invites: string[];
  credits: string[];
  orders: string[];
  products: string[];
  baseline: { real: Numbers; test: Numbers };
  counts: Numbers;
};

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const { getKalpReport } = await import("../src/lib/kalp-topla/report");
  const arg = process.argv[2];

  const numbers = async (scope: "real" | "test"): Promise<Numbers> => {
    const r = await getKalpReport(scope, null);
    return {
      couponsGiven: r.coupons.given,
      couponsUsed: r.coupons.used,
      couponsExpired: r.coupons.expired,
      saleOrders: r.sales.orders,
      revenue: r.sales.revenueCents,
      discount: r.sales.discountCents,
      validInvites: r.invites.valid,
      reviewInvites: r.invites.underReview,
      waitingBonus: r.bonuses.waiting,
      expiredBonus: r.bonuses.expired,
      closedRounds: r.closedRounds.length,
      activeBars: r.activeBars.length,
      heartsGiven: r.demand.reduce((s, d) => s + d.given, 0),
      heartsOpen: r.demand.reduce((s, d) => s + d.open, 0),
      heartsWithdrawn: r.demand.reduce((s, d) => s + d.withdrawn, 0)
    };
  };
  const tableCounts = async (): Promise<Numbers> => {
    const [rounds, hearts, coupons, bars, invites, credits, orders, customers, admins, devices, consents, notifications] = await Promise.all([
      prisma.kalpRound.count(),
      prisma.kalpHeart.count(),
      prisma.kalpCoupon.count(),
      prisma.kalpBar.count(),
      prisma.kalpInvite.count(),
      prisma.kalpBonusCredit.count(),
      prisma.order.count(),
      prisma.customer.count(),
      prisma.adminUser.count(),
      prisma.customerDevice.count(),
      prisma.marketingConsentLog.count(),
      prisma.notification.count()
    ]);
    return { rounds, hearts, coupons, bars, invites, credits, orders, customers, admins, devices, consents, notifications };
  };

  if (arg === "hazirla") {
    if (existsSync(STATE)) throw new Error("Durum dosyasi var. Once temizle.");
    const baseline = { real: await numbers("real"), test: await numbers("test") };
    const counts = await tableCounts();
    const busyProducts = (await prisma.kalpRound.findMany({ select: { productId: true }, distinct: ["productId"] })).map((r) => r.productId);
    const products = await prisma.product.findMany({
      where: { status: "PUBLISHED", kalpToplaExcluded: false, id: { notIn: busyProducts } },
      select: { id: true },
      take: 4
    });
    if (products.length < 4) throw new Error("Bos urun yok.");
    const [P1, P2, P3, P4] = products.map((p) => p.id);

    const run = randomBytes(3).toString("hex");
    const password = `Kt10-${randomBytes(9).toString("hex")}`;
    const passwordHash = await bcrypt.hash(password, 10);
    const admin = await prisma.adminUser.create({
      data: { name: "KT10 Gecici", email: `kt10-admin-${run}@example.invalid`, passwordHash, role: "ADMIN" }
    });
    const customers: Record<string, string> = {};
    const state: State = {
      run,
      password,
      adminEmail: admin.email,
      adminId: admin.id,
      customers,
      rounds: [],
      bars: [],
      hearts: [],
      coupons: {},
      invites: [],
      credits: [],
      orders: [],
      products: products.map((p) => p.id),
      baseline,
      counts
    };
    // Kesilirse temizlik calisabilsin diye durum her adimda yazilir.
    const save = () => writeFileSync(STATE, JSON.stringify(state, null, 2));
    save();

    for (const key of ["a", "b", "c", "d", "e"]) {
      const c = await prisma.customer.create({
        data: { email: `kt10-${key}-${run}@example.invalid`, name: `KT10 Test ${key}`, passwordHash, emailVerifiedAt: new Date() }
      });
      customers[key] = c.id;
    }
    save();
    const { a, b, c, d, e } = customers;
    const now = Date.now();

    const round = async (productId: string, isTest: boolean, closed: boolean) => {
      const r = await prisma.kalpRound.create({
        data: { productId, roundNo: 1, threshold: 2, isTest, status: closed ? "CLOSED" : "OPEN", closedAt: closed ? new Date() : null }
      });
      state.rounds.push(r.id);
      save();
      return r.id;
    };
    const R1 = await round(P1, false, true);
    const R2 = await round(P2, false, false);
    const T1 = await round(P3, true, true);
    const T2 = await round(P4, true, false);
    await prisma.kalpBar.create({ data: { productId: P2, currentRoundId: R2, points: 1 } });
    await prisma.kalpBar.create({ data: { productId: P4, currentRoundId: T2, points: 1 } });
    state.bars.push(P2, P4);
    save();

    const heartRows: [string, string, string, string][] = [
      [a, P1, R1, "WON"],
      [b, P1, R1, "WON"],
      [c, P2, R2, "WITHDRAWN"],
      [a, P2, R2, "ACTIVE"],
      [a, P3, T1, "WON"],
      [b, P3, T1, "WON"],
      [b, P4, T2, "ACTIVE"]
    ];
    for (const [customerId, productId, roundId, status] of heartRows) {
      const h = await prisma.kalpHeart.create({ data: { customerId, productId, roundId, status } });
      state.hearts.push(h.id);
    }
    save();

    const coupon = async (key: string, customerId: string, roundId: string, isTest: boolean, status: string, hours: number) => {
      const row = await prisma.kalpCoupon.create({
        data: {
          code: `KT10-${randomBytes(4).toString("hex").toUpperCase()}`,
          customerId,
          roundId,
          discountPercent: 50,
          isTest,
          status,
          expiresAt: new Date(now + hours * HOUR),
          usedAt: status === "USED" ? new Date() : null
        }
      });
      state.coupons[key] = row.id;
      save();
      return row.id;
    };
    const C1 = await coupon("realUsed", a, R1, false, "USED", 96);
    await coupon("realAvailable", b, R1, false, "AVAILABLE", 96);
    await coupon("realExpired", b, R1, false, "AVAILABLE", -1);
    await coupon("realToCancel", a, R1, false, "AVAILABLE", 96);
    await coupon("realToExtend", a, R1, false, "AVAILABLE", 96);
    const Cx = await coupon("realCancelledOrder", b, R1, false, "AVAILABLE", 96);
    const T1c = await coupon("testUsedUnmarked", a, T1, true, "USED", 96);
    const T2c = await coupon("testUsedMarked", b, T1, true, "USED", 96);
    await coupon("testAvailable", b, T1, true, "AVAILABLE", 96);
    await coupon("testCancelled", b, T1, true, "TEST_CANCELLED", 96);
    await coupon("testNearExpiry", a, T1, true, "AVAILABLE", 3);

    const order = async (status: string, kalpDiscountCents: number, kalpTestAt: Date | null, lines: [string, string | null, number][]) => {
      const total = lines.reduce((s, l) => s + l[2], 0);
      const row = await prisma.order.create({
        data: {
          orderNumber: `KT10-${randomBytes(4).toString("hex").toUpperCase()}`,
          status,
          customerName: "KT10 Test",
          customerEmail: `kt10-a-${run}@example.invalid`,
          customerPhone: "05000000000",
          customerId: a,
          shippingAddress: "KT10",
          city: "KT10",
          district: "KT10",
          note: "KT10",
          subtotalCents: total,
          totalCents: total,
          kalpDiscountCents,
          kalpTestAt,
          items: {
            create: lines.map(([productId, kalpCouponId, cents]) => ({ productId, kalpCouponId, quantity: 1, unitPriceCents: cents, totalCents: cents }))
          }
        }
      });
      state.orders.push(row.id);
      save();
    };
    await order("DELIVERED", 250000, null, [
      [P1, C1, 500000],
      [P1, null, 100000]
    ]);
    await order("DELIVERED", 15000, null, [[P3, T1c, 30000]]);
    await order("DELIVERED", 10000, new Date(), [[P3, T2c, 20000]]);
    await order("CANCELLED", 99999, null, [[P1, Cx, 700000]]);

    const invite = async (inviteeId: string, status: string, isTest: boolean) => {
      const row = await prisma.kalpInvite.create({ data: { inviterId: a, inviteeId, status, isTest } });
      state.invites.push(row.id);
      save();
      return row.id;
    };
    const I1 = await invite(b, "CREDITED", false);
    await invite(c, "UNDER_REVIEW", false);
    const I2 = await invite(d, "CANCELLED", false);
    const I3 = await invite(e, "CREDITED", true);
    const credit = async (inviteId: string, status: string, isTest: boolean, hours: number) => {
      const row = await prisma.kalpBonusCredit.create({
        data: { inviteId, customerId: a, points: 2, status, isTest, expiresAt: new Date(now + hours * HOUR) }
      });
      state.credits.push(row.id);
      save();
    };
    await credit(I1, "WAITING", false, 200);
    await credit(I2, "EXPIRED", false, -1);
    await credit(I3, "WAITING", true, 200);

    await prisma.customerDevice.createMany({
      data: [
        { customerId: a, deviceId: `kt10-${run}`, ipHash: `kt10-ip-${run}`, event: "SIGNUP" },
        { customerId: c, deviceId: `kt10-${run}`, event: "SIGNUP" },
        { customerId: d, deviceId: `kt10-diger-${run}`, ipHash: `kt10-ip-${run}`, event: "SIGNUP" }
      ]
    });
    await prisma.marketingConsentLog.create({
      data: { customerId: a, email: `kt10-a-${run}@example.invalid`, channel: "EMAIL", granted: true, source: "KAYIT_FORMU", textVersion: "kt10" }
    });
    console.log(`Hazir. Calistirma: ${run}. Giris ve kimlikler: ${STATE}`);
    return;
  }

  const state: State = JSON.parse(readFileSync(STATE, "utf8"));

  if (arg === "dogrula") {
    const real = await numbers("real");
    const test = await numbers("test");
    const expected = {
      real: {
        couponsGiven: 6,
        couponsUsed: 1,
        couponsExpired: 1,
        saleOrders: 1,
        revenue: 500000,
        discount: 250000,
        validInvites: 1,
        reviewInvites: 1,
        waitingBonus: 1,
        expiredBonus: 1,
        closedRounds: 1,
        activeBars: 1,
        heartsGiven: 4,
        heartsOpen: 1,
        heartsWithdrawn: 1
      },
      test: {
        couponsGiven: 4,
        couponsUsed: 2,
        couponsExpired: 0,
        saleOrders: 2,
        revenue: 50000,
        discount: 25000,
        validInvites: 1,
        reviewInvites: 0,
        waitingBonus: 1,
        expiredBonus: 0,
        closedRounds: 1,
        activeBars: 1,
        heartsGiven: 3,
        heartsOpen: 1,
        heartsWithdrawn: 0
      }
    };
    for (const scope of ["real", "test"] as const) {
      const current = scope === "real" ? real : test;
      for (const [key, want] of Object.entries(expected[scope])) {
        const got = current[key] - state.baseline[scope][key];
        check(`${scope} ${key}`, got === want, `fark ${got}, beklenen ${want}`);
      }
    }
  } else if (arg === "bildirim") {
    const { queueExpiringCoupons } = await import("../src/lib/kalp-topla/notifications");
    const { extendCoupon } = await import("../src/lib/kalp-topla/admin-coupons");
    const { istanbulInputValue } = await import("../src/lib/kalp-topla/admin-rules");
    const id = state.coupons.testNearExpiry;
    const customerId = state.customers.a;
    const silence = () =>
      prisma.notification.updateMany({ where: { customerId }, data: { emailStatus: "NOT_APPLICABLE", pushStatus: "NOT_APPLICABLE" } });
    const first = await queueExpiringCoupons(new Date(), customerId);
    await silence();
    check("ilk hatirlatma kuyruga girdi", first === 1, `${first}`);
    const target = new Date(Date.now() + 48 * HOUR);
    const result = await extendCoupon(id, customerId, istanbulInputValue(target), { actorEmail: state.adminEmail, actorRole: "ADMIN" });
    check("kupon uzatildi", result === "uzatildi", result);
    const second = await queueExpiringCoupons(new Date(Date.now() + 44 * HOUR), customerId);
    await silence();
    const rows = await prisma.notification.count({ where: { customerId, type: "COUPON_EXPIRING" } });
    check("uzatilan kupon ikinci kez hatirlatildi", second === 1 && rows === 2, `kuyruk ${second}, satir ${rows}`);
  } else if (arg === "islem-sonrasi") {
    const cancelled = state.coupons.realToCancel;
    const extended = state.coupons.realToExtend;
    const [c1, c2, audits] = await Promise.all([
      prisma.kalpCoupon.findUniqueOrThrow({ where: { id: cancelled } }),
      prisma.kalpCoupon.findUniqueOrThrow({ where: { id: extended } }),
      prisma.auditLog.findMany({ where: { targetId: { in: [cancelled, extended] } } })
    ]);
    check("kupon CANCELLED", c1.status === "CANCELLED", c1.status);
    check("kupon uzatildi", c2.expiresAt.getTime() > Date.now() + 96 * HOUR, c2.expiresAt.toISOString());
    check(
      "denetim kayitlari",
      audits.some((a) => a.action === "KALP_TOPLA_KUPON_IPTAL") && audits.some((a) => a.action === "KALP_TOPLA_KUPON_UZATILDI"),
      `${audits.length}`
    );
    const real = await numbers("real");
    check("iptal raporda verilen kuponu dusurmez", real.couponsGiven - state.baseline.real.couponsGiven === 6);
  } else if (arg === "temizle") {
    const customerIds = Object.values(state.customers);
    const couponIds = Object.values(state.coupons);
    await prisma.auditLog.deleteMany({ where: { targetId: { in: couponIds } } });
    await prisma.notification.deleteMany({ where: { customerId: { in: customerIds } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: state.orders } } });
    await prisma.order.deleteMany({ where: { id: { in: state.orders } } });
    await prisma.kalpCoupon.deleteMany({ where: { id: { in: couponIds } } });
    await prisma.kalpBonusCredit.deleteMany({ where: { id: { in: state.credits } } });
    await prisma.kalpInvite.deleteMany({ where: { id: { in: state.invites } } });
    await prisma.kalpHeart.deleteMany({ where: { id: { in: state.hearts } } });
    await prisma.kalpBar.deleteMany({ where: { productId: { in: state.bars }, currentRoundId: { in: state.rounds } } });
    await prisma.kalpRound.deleteMany({ where: { id: { in: state.rounds } } });
    await prisma.customerDevice.deleteMany({ where: { customerId: { in: customerIds } } });
    await prisma.marketingConsentLog.deleteMany({ where: { customerId: { in: customerIds } } });
    await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
    await prisma.adminUser.deleteMany({ where: { id: state.adminId } });

    const after = await tableCounts();
    for (const [key, value] of Object.entries(state.counts)) check(`tablo ${key} ayni`, after[key] === value, `${value} -> ${after[key]}`);
    const [real, test] = [await numbers("real"), await numbers("test")];
    check("gercek rapor baslangica dondu", JSON.stringify(real) === JSON.stringify(state.baseline.real));
    check("test raporu baslangica dondu", JSON.stringify(test) === JSON.stringify(state.baseline.test));
    if (failed === 0) rmSync(STATE, { force: true });
  } else {
    throw new Error("Kullanim: hazirla | dogrula | bildirim | islem-sonrasi | temizle");
  }
  console.log(`\n${passed} OK, ${failed} hata.`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => setTimeout(() => process.exit(), 300));
