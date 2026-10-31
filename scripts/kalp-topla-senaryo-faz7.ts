// Kalp Topla Faz 7 DB senaryolari (KALP_TOPLA_PLANI.md 5.8, 10.7; T13). Canli DB'de calisir:
// - Yalniz gecici kt7-...@example.invalid uyesi ve onun kuponlari/siparisleri yazilir.
// - Script siparisleri deletedAt dolu acilir: Vega'ya gitmez, admin listesinde gorunmez.
//   Istisna ekran siparisi: 10 gun onceki odeme tarihi Vega penceresinin disindadir.
// - iyzico cagrilmaz: PENDING iade kaydi resolvePendingRefund ile gercek finalizeSuccess'e gider.
// - E-posta gondermez (RESEND_API_KEY bu surecte kaldirilir). Mod degismez.
//
// Calistirma: npx tsx scripts/kalp-topla-senaryo-faz7.ts hazirla | sandbox-kontrol <siparisNo> | senaryo | temizle
import "dotenv/config";
import Module from "node:module";
import path from "node:path";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

delete process.env.RESEND_API_KEY;
const moduleWithResolve = Module as unknown as { _resolveFilename: (request: string, ...rest: unknown[]) => string };
const originalResolve = moduleWithResolve._resolveFilename;
moduleWithResolve._resolveFilename = function (request: string, ...rest: unknown[]) {
  if (request === "server-only") return path.resolve("node_modules/next/dist/compiled/server-only/empty.js");
  return originalResolve.call(this, request, ...rest);
};

const EMAIL = "kt7-test@example.invalid";
const ACTOR = "kt7-senaryo";
const RUN = Date.now().toString(36);
const HOUR = 60 * 60 * 1000;
let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (ok) passed += 1;
  else failed += 1;
  console.log(`${ok ? "OK  " : "HATA"} ${name}${detail ? ` (${detail})` : ""}`);
};

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const { priceCart, loadPriceLines, KalpCouponInvalidError } = await import("../src/lib/pricing/price-cart");
  const { resolvePendingRefund } = await import("../src/lib/payment/orders/refund");
  const coupons = await import("../src/lib/kalp-topla/order-coupons");
  const { handleReturnCompleted } = await import("../src/lib/kalp-topla/returns");
  const { splitOrderItems } = await import("../src/lib/kalp-topla/pricing");
  const arg = process.argv[2];

  const customer = await prisma.customer.findUnique({ where: { email: EMAIL } });

  if (arg === "temizle") {
    if (!customer) return console.log("kt7 uyesi yok.");
    const id = customer.id;
    const ALLOWED_ORDERS = ["BLM261031-7095", "BLM261031-4967"];
    const ALLOWED_EMAILS = [EMAIL, "kt7-test@example.com"];
    const orders = await prisma.order.findMany({ where: { OR: [{ customerId: id }, { customerEmail: { in: ALLOWED_EMAILS } }] }, select: { id: true, orderNumber: true, customerId: true, note: true } });
    const orderIds = orders.map((o) => o.id);
    const couponRows = await prisma.kalpCoupon.findMany({ where: { customerId: id } });
    const couponIds = couponRows.map((c) => c.id);
    const roundIds = [...new Set(couponRows.map((c) => c.roundId))];
    const rounds = await prisma.kalpRound.findMany({ where: { id: { in: roundIds } } });

    const refundIds = (await prisma.paymentRefund.findMany({ where: { orderId: { in: orderIds } }, select: { id: true } })).map((r) => r.id);
    const returnIds = (await prisma.returnRequest.findMany({ where: { orderId: { in: orderIds } }, select: { id: true } })).map((r) => r.id);
    const auditWhere = { OR: [{ actorEmail: ACTOR }, { targetId: { in: [...couponIds, ...returnIds, ...orderIds, id] } }] };
    const audits = await prisma.auditLog.findMany({ where: auditWhere, select: { id: true, action: true, actorEmail: true, targetId: true } });
    const owned = new Set([...couponIds, ...returnIds, ...orderIds, ...refundIds, id]);

    // Kapsam: tek bir yabanci kayit bulunursa hicbir sey silinmez.
    const problems: string[] = [];
    for (const o of orders) {
      const known = o.orderNumber.startsWith("KT7-") || ALLOWED_ORDERS.includes(o.orderNumber);
      if (!known || o.customerId !== id || !o.note?.includes("KT7")) problems.push(`siparis kapsam disi: ${o.orderNumber}`);
    }
    for (const c of couponRows) if (!c.isTest || !c.code.startsWith("KT7-")) problems.push(`kupon kapsam disi: ${c.code}`);
    for (const r of rounds) if (!r.isTest || r.roundNo < 900_000) problems.push(`tur kapsam disi: ${r.id}`);
    if (rounds.length !== roundIds.length) problems.push("kuponun turu eksik");
    const foreignCoupons = await prisma.kalpCoupon.count({ where: { roundId: { in: roundIds }, customerId: { not: id } } });
    if (foreignCoupons > 0) problems.push(`turlarda baska uyenin kuponu: ${foreignCoupons}`);
    const roundHearts = await prisma.kalpHeart.count({ where: { roundId: { in: roundIds } } });
    if (roundHearts > 0) problems.push(`turlarda kalp var: ${roundHearts}`);
    const roundBars = await prisma.kalpBar.count({ where: { currentRoundId: { in: roundIds } } });
    if (roundBars > 0) problems.push(`turlar acik barda: ${roundBars}`);
    const foreignItems = await prisma.orderItem.count({ where: { kalpCouponId: { in: couponIds }, orderId: { notIn: orderIds } } });
    if (foreignItems > 0) problems.push(`baska sipariste kupon kaydi: ${foreignItems}`);
    for (const a of audits) if (!a.targetId || !owned.has(a.targetId)) problems.push(`denetim kaydi kapsam disi: ${a.id} ${a.action}`);

    const memberTables = {
      kalpHeart: await prisma.kalpHeart.count({ where: { customerId: id } }),
      kalpInvite: await prisma.kalpInvite.count({ where: { OR: [{ inviterId: id }, { inviteeId: id }] } }),
      kalpBonusCredit: await prisma.kalpBonusCredit.count({ where: { customerId: id } }),
      pushSubscription: await prisma.pushSubscription.count({ where: { customerId: id } }),
      reminderEmailDay: await prisma.reminderEmailDay.count({ where: { customerId: id } }),
      marketingConsentLog: await prisma.marketingConsentLog.count({ where: { customerId: id } }),
      emailVerificationToken: await prisma.emailVerificationToken.count({ where: { customerId: id } }),
      customerAddress: await prisma.customerAddress.count({ where: { customerId: id } }),
      loyaltyTransaction: await prisma.loyaltyTransaction.count({ where: { customerId: id } }),
      wishlistItem: await prisma.wishlistItem.count({ where: { customerId: id } })
    };
    for (const [table, count] of Object.entries(memberTables)) if (count > 0) problems.push(`beklenmeyen uye verisi: ${table} ${count}`);
    if (problems.length > 0) {
      console.log("KAPSAM HATASI, HICBIR SEY SILINMEDI:");
      for (const p of problems) console.log(" -", p);
      process.exitCode = 1;
      return;
    }

    const counts: Record<string, number> = {};
    await prisma.$transaction(
      async (tx) => {
        const itemCount = await tx.orderItem.count({ where: { orderId: { in: orderIds } } });
        const shipmentCount = await tx.shipment.count({ where: { orderId: { in: orderIds } } });
        counts.DenetimKaydi = (await tx.auditLog.deleteMany({ where: { id: { in: audits.map((a) => a.id) } } })).count;
        counts.IadeTalebi = (await tx.returnRequest.deleteMany({ where: { orderId: { in: orderIds } } })).count;
        counts.OdemeIadesi = (await tx.paymentRefund.deleteMany({ where: { orderId: { in: orderIds } } })).count;
        counts.OdemeDenemesi = (await tx.paymentAttempt.deleteMany({ where: { orderId: { in: orderIds } } })).count;
        counts.SiparisSatiri = itemCount;
        counts.Kargo = shipmentCount;
        counts.Siparis = (await tx.order.deleteMany({ where: { id: { in: orderIds } } })).count;
        counts.Bildirim = (await tx.notification.deleteMany({ where: { customerId: id } })).count;
        counts.Kupon = (await tx.kalpCoupon.deleteMany({ where: { customerId: id } })).count;
        counts.KuponTuru = (await tx.kalpRound.deleteMany({ where: { id: { in: roundIds } } })).count;
        counts.Sepet = (await tx.customerCart.deleteMany({ where: { customerId: id } })).count;
        counts.CihazKaydi = (await tx.customerDevice.deleteMany({ where: { customerId: id } })).count;
        const row = await tx.kalpToplaSettings.findUniqueOrThrow({ where: { id: "singleton" } });
        await tx.kalpToplaSettings.update({ where: { id: "singleton" }, data: { testerCustomerIds: row.testerCustomerIds.filter((t) => t !== id) } });
        await tx.customer.delete({ where: { id } });
        counts.Uye = 1;
      },
      { timeout: 60_000, maxWait: 20_000 }
    );
    console.log(JSON.stringify(counts));
    console.log("siparisler:", orders.length, orders.filter((o) => !o.orderNumber.startsWith("KT7-")).map((o) => o.orderNumber).join(", "));
    return console.log("kt7 verisi tek transaction'da silindi.");
  }

  const product = await prisma.product.findFirstOrThrow({
    where: { status: "PUBLISHED", kalpToplaExcluded: false, compareAtCents: null, priceCents: { gt: 100_000 }, variants: { some: { stock: { gt: 3 }, priceCents: null } } },
    include: { variants: { where: { stock: { gt: 3 }, priceCents: null }, take: 2 } },
    orderBy: { createdAt: "asc" }
  });
  const variant = product.variants[0];
  const price = product.priceCents;

  const newCoupon = async (customerId: string, hoursLeft = 40) => {
    const round = await prisma.kalpRound.create({
      data: { productId: product.id, roundNo: 900_000 + Math.floor(Math.random() * 90_000), threshold: 2, status: "CLOSED", isTest: true, closedAt: new Date() }
    });
    return prisma.kalpCoupon.create({
      data: {
        code: `KT7-${randomBytes(4).toString("hex").toUpperCase()}`,
        customerId,
        roundId: round.id,
        discountPercent: 50,
        expiresAt: new Date(Date.now() + hoursLeft * HOUR),
        isTest: true
      }
    });
  };

  if (arg === "hazirla") {
    if (customer) throw new Error("kt7 uyesi zaten var. Once temizle.");
    const password = randomBytes(12).toString("base64url");
    const created = await prisma.customer.create({
      data: { email: EMAIL, name: "KT7 Test", passwordHash: await bcrypt.hash(password, 10), emailVerifiedAt: new Date() }
    });
    await prisma.kalpToplaSettings.update({ where: { id: "singleton" }, data: { testerCustomerIds: { push: created.id } } });
    const coupon = await newCoupon(created.id);
    console.log(JSON.stringify({ email: EMAIL, password, coupon: coupon.code, product: product.slug, price }));
    return;
  }

  if (!customer) throw new Error("Once hazirla calistir.");
  const customerId = customer.id;
  const getCoupon = (id: string) => prisma.kalpCoupon.findUniqueOrThrow({ where: { id } });
  const actor = { email: ACTOR, role: "ADMIN" };

  if (arg === "kupon") {
    await prisma.kalpCoupon.updateMany({ where: { customerId, status: "AVAILABLE" }, data: { status: "TEST_CANCELLED" } });
    return console.log((await newCoupon(customerId)).code);
  }

  // Gercek iyzico sandbox iptali; yalniz SANDBOX modunda odenmis siparis kabul edilir.
  if (arg === "sandbox-iptal") {
    const { requestCancel } = await import("../src/lib/payment/orders/refund");
    const order = await prisma.order.findUniqueOrThrow({ where: { orderNumber: process.argv[3] } });
    if (order.paymentMode !== "SANDBOX" || order.customerId !== customerId) throw new Error("Yalniz kt7 sandbox siparisi iptal edilir.");
    const params = { orderId: order.id, reason: "OTHER", description: "KT7 TEST", ip: "127.0.0.1", restock: true, actorEmail: ACTOR };
    console.log("ilk iptal:", JSON.stringify(await requestCancel(params as Parameters<typeof requestCancel>[0])));
    console.log("ikinci iptal:", JSON.stringify(await requestCancel(params as Parameters<typeof requestCancel>[0])));
    return;
  }

  if (arg === "sandbox-kontrol") {
    const order = await prisma.order.findUniqueOrThrow({ where: { orderNumber: process.argv[3] }, include: { items: true, paymentRefunds: true } });
    const item = order.items.find((i) => i.kalpCouponId)!;
    const coupon = await getCoupon(item.kalpCouponId!);
    check("iptal basarili", order.paymentStatus === "REFUNDED", order.paymentStatus);
    check("kupon AVAILABLE", coupon.status === "AVAILABLE", coupon.status);
    check("eski sipariste kupon kaydi duruyor", item.kalpCouponId === coupon.id);
    check("kalpRestoredAt dolu", item.kalpRestoredAt !== null);
    const expiry = coupon.expiresAt.getTime();
    const again = await prisma.$transaction((tx) => coupons.restoreOrderCoupons(tx, order.id));
    const after = await getCoupon(coupon.id);
    check("ikinci tetikleme bos", again.length === 0 && after.expiresAt.getTime() === expiry);
    const lines = await loadPriceLines(prisma, [{ productId: item.productId, variantId: item.variantId!, quantity: 1 }]);
    const reused = await prisma.$transaction(async (tx) => {
      const priced = await priceCart(tx, { customerId, lines: lines!, couponCode: null, defaultShippingCents: 0, mode: "ORDER" });
      const items = splitOrderItems(lines!, priced.assignments);
      const created = await makeOrder(tx, items.map((i) => ({ ...i })), { paid: false });
      return { priced, created };
    });
    check("kupon yeni sipariste kullanildi", reused.priced.assignments[0]?.couponId === coupon.id);
    check("kupon RESERVED", (await getCoupon(coupon.id)).status === "RESERVED");
    await prisma.$transaction((tx) => coupons.releaseOrderCoupons(tx, reused.created.id));
    return finish();
  }

  // Script siparisi. visible yalniz ekran siparisi icin.
  async function makeOrder(
    db: Pick<typeof prisma, "order">,
    items: { productId: string; variantId: string; quantity: number; unitPriceCents: number; totalCents: number; kalpCouponId?: string }[],
    opts: { paid?: boolean; shipped?: boolean; visible?: boolean } = {}
  ) {
    const paid = opts.paid !== false;
    const total = items.reduce((sum, i) => sum + i.totalCents, 0);
    return db.order.create({
      data: {
        orderNumber: `KT7-${RUN}-${randomBytes(3).toString("hex")}`,
        status: opts.shipped ? "DELIVERED" : paid ? "PAID" : "PENDING_PAYMENT",
        customerName: "KT7 Test",
        customerEmail: EMAIL,
        customerPhone: "0",
        customerId,
        shippingAddress: "-",
        city: "-",
        district: "-",
        note: "KT7 TEST",
        subtotalCents: total,
        totalCents: total,
        paymentStatus: paid ? "PAID" : "UNPAID",
        paymentProvider: "IYZICO",
        paymentMode: "SANDBOX",
        paidAt: paid ? new Date(Date.now() - 240 * HOUR) : null,
        paidCents: paid ? total : null,
        deletedAt: opts.visible ? null : new Date(),
        items: { create: items.map((i) => ({ ...i, paidCents: paid ? i.totalCents : null })) },
        ...(opts.shipped ? { shipment: { create: { status: "TESLIM_EDILDI", shippedAt: new Date(), deliveredAt: new Date() } } } : {}),
        paymentAttempts: { create: { mode: "SANDBOX", token: `kt7-${RUN}-${randomBytes(4).toString("hex")}`, conversationId: "kt7", status: "SUCCESS", paymentId: "kt7" } }
      },
      include: { items: true, paymentAttempts: true }
    });
  }
  type Made = Awaited<ReturnType<typeof makeOrder>>;

  const couponLine = (couponId: string, unit = Math.round(price / 2)) => ({
    productId: product.id,
    variantId: variant.id,
    quantity: 1,
    unitPriceCents: unit,
    totalCents: unit,
    kalpCouponId: couponId
  });
  const plainLine = () => ({ productId: product.id, variantId: variant.id, quantity: 1, unitPriceCents: price, totalCents: price });
  const markUsed = (id: string, usedHoursAgo = 2) =>
    prisma.kalpCoupon.update({ where: { id }, data: { status: "USED", usedAt: new Date(Date.now() - usedHoursAgo * HOUR) } });
  const pendingRefund = (order: Made, itemId: string | null, amountCents: number, kind = "REFUND") =>
    prisma.paymentRefund.create({
      data: {
        orderId: order.id,
        attemptId: order.paymentAttempts[0].id,
        orderItemId: itemId,
        paymentTransactionId: "kt7",
        amountCents,
        kind,
        reason: "OTHER",
        createdByEmail: ACTOR
      }
    });
  const expectThrows = async (work: () => Promise<unknown>) => {
    try {
      await work();
      return false;
    } catch (error) {
      return error instanceof KalpCouponInvalidError;
    }
  };

  if (arg === "senaryo") {
    const group = process.argv[3];
    // Onceki gruplarin bos kuponlari yeni siparise atanmasin.
    await prisma.kalpCoupon.updateMany({ where: { customerId, status: "AVAILABLE" }, data: { status: "TEST_CANCELLED" } });
    const lines =(await loadPriceLines(prisma, [{ productId: product.id, variantId: variant.id, quantity: 1 }]))!;
    const orderWith = (mode: "ORDER" = "ORDER") =>
      prisma.$transaction(async (tx) => {
        const priced = await priceCart(tx, { customerId, lines, couponCode: null, defaultShippingCents: 0, mode });
        return makeOrder(tx, splitOrderItems(lines, priced.assignments).map((i) => ({ ...i })), { paid: false });
      });

    if (group === "iptal") {
      // Odenmeyen siparis: kupon doner, yeni sipariste kullanilir, eski kayit kalir (5a, 5b).
      const c1 = await newCoupon(customerId);
      const a = await orderWith();
      const aItem = a.items.find((i) => i.kalpCouponId);
      check("A: kupon rezerve edildi", aItem?.kalpCouponId === c1.id);
      await prisma.$transaction((tx) => coupons.releaseOrderCoupons(tx, a.id));
      check("A: kupon serbest", (await getCoupon(c1.id)).status === "AVAILABLE");
      const b = await orderWith();
      check("B: ayni kupon yeni sipariste, hata yok", b.items.some((i) => i.kalpCouponId === c1.id));
      const stale = await prisma.orderItem.findUniqueOrThrow({ where: { id: aItem!.id } });
      check("A: eski sipariste kupon kaydi duruyor", stale.kalpCouponId === c1.id);
      await prisma.$transaction((tx) => coupons.markOrderCouponsUsed(tx, b.id));
      check("USED kupon ikinci kez kullanilamaz: atanmiyor", (await prisma.$transaction((tx) => priceCart(tx, { customerId, lines, couponCode: null, defaultShippingCents: 0, mode: "ORDER" }))).assignments.length === 0);
      check("USED kupon kodla reddedilir", await expectThrows(() => prisma.$transaction((tx) => priceCart(tx, { customerId, lines, couponCode: c1.code, defaultShippingCents: 0, mode: "ORDER" }))));
      const note = await prisma.$transaction((tx) => coupons.markOrderCouponsUsed(tx, a.id));
      check("gec odeme: kupon baskasinda USED ise dikkat notu", note !== null);

      // Kargodan once iptal: tek geri yukleme (5c).
      const c2 = await newCoupon(customerId);
      await markUsed(c2.id);
      const paid = await makeOrder(prisma, [couponLine(c2.id), plainLine()]);
      const before = await getCoupon(c2.id);
      const failedRefund = await pendingRefund(paid, null, paid.totalCents, "CANCEL");
      await resolvePendingRefund(failedRefund.id, "FAILED");
      check("iyzico basarisiz: kupon USED kalir", (await getCoupon(c2.id)).status === "USED");
      const ok = await pendingRefund(paid, null, paid.totalCents, "CANCEL");
      await resolvePendingRefund(ok.id, "SUCCESS");
      const restored = await getCoupon(c2.id);
      const expected = Date.now() + (before.expiresAt.getTime() - before.usedAt!.getTime());
      check("iptal: kupon AVAILABLE", restored.status === "AVAILABLE");
      check("iptal: kalan sure korundu", Math.abs(restored.expiresAt.getTime() - expected) < 60_000);
      const second = await resolvePendingRefund(ok.id, "SUCCESS");
      check("ikinci iptal sonucu reddedilir", !second.ok);
      const twice = await Promise.all([1, 2].map(() => prisma.$transaction((tx) => coupons.restoreOrderCoupons(tx, paid.id))));
      const again = await getCoupon(c2.id);
      check("es zamanli iki tetikleme: geri yukleme yok", twice.flat().length === 0 && again.expiresAt.getTime() === restored.expiresAt.getTime());
      check("bildirim tek", (await prisma.notification.count({ where: { eventKey: `coupon-restored:${paid.items.find((i) => i.kalpCouponId)!.id}` } })) === 1);

      // Yalniz kuponsuz satir iade: kupon etkilenmez.
      const c3 = await newCoupon(customerId);
      await markUsed(c3.id);
      const mixed = await makeOrder(prisma, [couponLine(c3.id), plainLine()]);
      const plainItem = mixed.items.find((i) => !i.kalpCouponId)!;
      await resolvePendingRefund((await pendingRefund(mixed, plainItem.id, plainItem.totalCents)).id, "SUCCESS");
      check("kuponsuz satir iadesi kuponu etkilemez", (await getCoupon(c3.id)).status === "USED");
      const couponItem = mixed.items.find((i) => i.kalpCouponId)!;
      await resolvePendingRefund((await pendingRefund(mixed, couponItem.id, couponItem.totalCents)).id, "SUCCESS");
      check("kuponlu satir iadesi kuponu geri yukler", (await getCoupon(c3.id)).status === "AVAILABLE");
    }

    if (group === "kargo") {
      const c = await newCoupon(customerId);
      await markUsed(c.id);
      const order = await makeOrder(prisma, [couponLine(c.id)], { shipped: true });
      const item = order.items[0];
      await resolvePendingRefund((await pendingRefund(order, item.id, item.totalCents)).id, "SUCCESS");
      check("kargolanmis, iade talebi yok: kupon USED kalir", (await getCoupon(c.id)).status === "USED");
      const request = await prisma.returnRequest.create({
        data: { orderId: order.id, type: "IADE", reason: "test", itemsJson: JSON.stringify([{ orderItemId: item.id, quantity: 1 }]), status: "TAMAMLANDI" }
      });
      await handleReturnCompleted(request.id, actor);
      check("kargolanmis, iade tamamlandi: kupon geri geldi", (await getCoupon(c.id)).status === "AVAILABLE");

      // Once talep, sonra ucret iadesi + suresi dolmus: ayardaki ek sure.
      const late = await newCoupon(customerId, -1);
      await markUsed(late.id, 30);
      const order2 = await makeOrder(prisma, [couponLine(late.id)], { shipped: true });
      const item2 = order2.items[0];
      await prisma.returnRequest.create({
        data: { orderId: order2.id, type: "IADE", reason: "test", itemsJson: JSON.stringify([{ orderItemId: item2.id, quantity: 1 }]), status: "TAMAMLANDI" }
      });
      await resolvePendingRefund((await pendingRefund(order2, item2.id, item2.totalCents)).id, "SUCCESS");
      const back = await getCoupon(late.id);
      const hours = (back.expiresAt.getTime() - Date.now()) / HOUR;
      check("suresi dolmus, kargolanmis iade: ek sureyle doner", back.status === "AVAILABLE" && hours > 23 && hours <= 24, `${hours.toFixed(1)} saat`);
    }

    if (group === "sure") {
      const c = await newCoupon(customerId, -1);
      await markUsed(c.id, 30);
      const order = await makeOrder(prisma, [couponLine(c.id)], { visible: true });
      const item = order.items[0];
      await resolvePendingRefund((await pendingRefund(order, item.id, item.totalCents)).id, "SUCCESS");
      const after = await prisma.orderItem.findUniqueOrThrow({ where: { id: item.id } });
      check("suresi dolmus, kargodan once: geri yuklenmez", (await getCoupon(c.id)).status === "USED" && after.kalpRestoredAt === null);
      check("denetim kaydi yazildi", (await prisma.auditLog.count({ where: { action: "KALP_TOPLA_KUPON_GERI_YUKLENMEDI", targetId: c.id } })) >= 1);
      console.log(`ekran-siparisi-sure ${order.id}`);
    }

    if (group === "esz") {
      const c = await newCoupon(customerId);
      const outcome = await Promise.allSettled([orderWith(), orderWith()]);
      const orders = outcome.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
      const withCoupon = orders.filter((o) => o.items.some((i) => i.kalpCouponId === c.id));
      const rejected = outcome.filter((r) => r.status === "rejected");
      check("es zamanli iki siparis: kuponu yalniz biri aldi", withCoupon.length === 1, `kuponlu ${withCoupon.length}, kuponsuz ${orders.length - withCoupon.length}, hata ${rejected.length}`);
      check("kupon RESERVED", (await getCoupon(c.id)).status === "RESERVED");
      for (const r of rejected) console.log("  ret:", r.reason instanceof Error ? r.reason.message : r.reason);
      await prisma.kalpCoupon.update({ where: { id: c.id }, data: { status: "AVAILABLE" } });
      // Kupon baglandiktan sonra iki islem ayni anda rezervasyon yaparsa biri hata alir.
      const bare = await Promise.allSettled([1, 2].map(() =>
        prisma.$transaction(async (tx) => {
          const updated = await tx.kalpCoupon.updateMany({ where: { id: c.id, status: "AVAILABLE" }, data: { status: "RESERVED" } });
          if (updated.count !== 1) throw new Error("rezerve edilemedi");
        })
      ));
      check("rezervasyon atomik: biri basarili", bare.filter((r) => r.status === "fulfilled").length === 1);
    }

    if (group === "ekran") {
      const c = await newCoupon(customerId);
      await markUsed(c.id);
      const order = await makeOrder(prisma, [couponLine(c.id)], { shipped: true, visible: true });
      await prisma.returnRequest.create({
        data: { orderId: order.id, type: "DEGISIM", reason: "Beden uymadı", itemsJson: JSON.stringify([{ orderItemId: order.items[0].id, quantity: 1 }]) }
      });
      await prisma.order.update({ where: { id: order.id }, data: { needsAttention: true, attentionNote: "Kalp Topla kuponu bu ödemeden önce başka bir siparişte kullanılmış; siparişi kontrol edin" } });
      console.log(`ekran-siparisi ${order.orderNumber} stok-kodu ${product.variants[1]?.sku ?? variant.sku}`);
    }
    return finish();
  }
  throw new Error(`Bilinmeyen komut: ${arg}`);
}

function finish() {
  console.log(`SONUC: ${passed} OK, ${failed} hata`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => setTimeout(() => process.exit(), 500));
