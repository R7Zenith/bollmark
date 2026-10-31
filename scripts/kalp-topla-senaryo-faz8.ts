// Kalp Topla Faz 8 DB senaryolari (KALP_TOPLA_PLANI.md 7, 10.10; T13). Canli DB'de calisir:
// - Yalniz gecici kt8-...@example.invalid uyeleri ve onlarin test verisi yazilir (isTest).
// - Mod degismez; Gizli yayin ve test esigi 2 ister. Barda kaydi olmayan urunler kullanilir.
// - E-postalar gercek gider ama MAIL_DEV_REDIRECT yoksa script calismaz.
// - Push gercek gonderilmez: sahte gonderici verilir.
//
// Calistirma: npx tsx scripts/kalp-topla-senaryo-faz8.ts senaryo | token | temizle
import "dotenv/config";
import Module from "node:module";
import path from "node:path";
import { randomBytes } from "node:crypto";

const moduleWithResolve = Module as unknown as { _resolveFilename: (request: string, ...rest: unknown[]) => string };
const originalResolve = moduleWithResolve._resolveFilename;
moduleWithResolve._resolveFilename = function (request: string, ...rest: unknown[]) {
  if (request === "server-only") return path.resolve("node_modules/next/dist/compiled/server-only/empty.js");
  return originalResolve.call(this, request, ...rest);
};

if (process.env.MAIL_DEV_REDIRECT !== "ozilevent@gmail.com") throw new Error("MAIL_DEV_REDIRECT yok, durduruldu.");
if (process.env.VERCEL) throw new Error("Yalniz yerelde calisir.");

const EMAILS = ["kt8-onayli@example.invalid", "kt8-onaysiz@example.invalid", "kt8-disari@example.invalid"];
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
  const { giveHeart, expireWaitingCredits } = await import("../src/lib/kalp-topla/bar");
  const n = await import("../src/lib/kalp-topla/notifications");
  const { createUnsubscribeToken } = await import("../src/lib/kalp-topla/consent");
  const arg = process.argv[2];
  const members = await prisma.customer.findMany({ where: { email: { in: EMAILS } } });
  const ids = members.map((m) => m.id);

  if (arg === "token") {
    const member = members.find((m) => m.email === EMAILS[0]);
    if (!member) return console.log("kt8 uyesi yok.");
    return console.log(createUnsubscribeToken(member.id));
  }

  if (arg === "temizle") {
    if (ids.length === 0) return console.log("kt8 uyesi yok.");
    const hearts = await prisma.kalpHeart.findMany({ where: { customerId: { in: ids } } });
    const coupons = await prisma.kalpCoupon.findMany({ where: { customerId: { in: ids } } });
    const roundIds = [...new Set([...hearts.map((h) => h.roundId), ...coupons.map((c) => c.roundId)])];
    const productIds = [...new Set(hearts.map((h) => h.productId))];
    const allRounds = await prisma.kalpRound.findMany({ where: { OR: [{ id: { in: roundIds } }, { productId: { in: productIds } }] } });
    const allRoundIds = allRounds.map((r) => r.id);
    const invites = await prisma.kalpInvite.findMany({ where: { OR: [{ inviterId: { in: ids } }, { inviteeId: { in: ids } }] } });
    const credits = await prisma.kalpBonusCredit.findMany({ where: { customerId: { in: ids } } });
    const audits = await prisma.auditLog.findMany({ where: { targetId: { in: [...allRoundIds, ...ids] } }, select: { id: true, action: true, targetType: true } });

    // Kapsam: tek bir yabanci kayit bulunursa hicbir sey silinmez.
    const problems: string[] = [];
    for (const r of allRounds) if (!r.isTest) problems.push(`tur test degil: ${r.id}`);
    for (const c of coupons) if (!c.isTest) problems.push(`kupon test degil: ${c.code}`);
    for (const i of invites) if (!i.isTest || !ids.includes(i.inviterId) || !ids.includes(i.inviteeId)) problems.push(`davet kapsam disi: ${i.id}`);
    for (const c of credits) if (!c.isTest) problems.push(`kredi test degil: ${c.id}`);
    for (const a of audits) if (a.action !== "KALP_TOPLA_TUR_KAPANDI") problems.push(`denetim kapsam disi: ${a.id} ${a.action}`);
    const foreignHearts = await prisma.kalpHeart.count({ where: { roundId: { in: allRoundIds }, customerId: { notIn: ids } } });
    if (foreignHearts > 0) problems.push(`turda baska uyenin kalbi: ${foreignHearts}`);
    const foreignCoupons = await prisma.kalpCoupon.count({ where: { roundId: { in: allRoundIds }, customerId: { notIn: ids } } });
    if (foreignCoupons > 0) problems.push(`turda baska uyenin kuponu: ${foreignCoupons}`);
    const orders = await prisma.order.count({ where: { customerId: { in: ids } } });
    if (orders > 0) problems.push(`kt8 uyesinde siparis: ${orders}`);
    if (problems.length > 0) {
      console.log("KAPSAM HATASI, HICBIR SEY SILINMEDI:");
      for (const p of problems) console.log(" -", p);
      process.exitCode = 1;
      return;
    }

    const counts: Record<string, number> = {};
    await prisma.$transaction(
      async (tx) => {
        const where = { customerId: { in: ids } };
        counts.Bildirim = (await tx.notification.deleteMany({ where })).count;
        counts.GunlukHak = (await tx.reminderEmailDay.deleteMany({ where })).count;
        counts.PushAbonelik = (await tx.pushSubscription.deleteMany({ where })).count;
        counts.OnayKaydi = (await tx.marketingConsentLog.deleteMany({ where })).count;
        counts.Kredi = (await tx.kalpBonusCredit.deleteMany({ where })).count;
        counts.Davet = (await tx.kalpInvite.deleteMany({ where: { id: { in: invites.map((i) => i.id) } } })).count;
        counts.Kupon = (await tx.kalpCoupon.deleteMany({ where })).count;
        counts.Kalp = (await tx.kalpHeart.deleteMany({ where })).count;
        counts.Bar = (await tx.kalpBar.deleteMany({ where: { productId: { in: productIds } } })).count;
        counts.Tur = (await tx.kalpRound.deleteMany({ where: { id: { in: allRoundIds } } })).count;
        counts.Denetim = (await tx.auditLog.deleteMany({ where: { id: { in: audits.map((a) => a.id) } } })).count;
        counts.Sepet = (await tx.customerCart.deleteMany({ where })).count;
        const row = await tx.kalpToplaSettings.findUniqueOrThrow({ where: { id: "singleton" } });
        await tx.kalpToplaSettings.update({
          where: { id: "singleton" },
          data: { testerCustomerIds: row.testerCustomerIds.filter((t) => !ids.includes(t)) }
        });
        counts.Uye = (await tx.customer.deleteMany({ where: { id: { in: ids } } })).count;
      },
      { timeout: 60_000, maxWait: 20_000 }
    );
    console.log(JSON.stringify(counts));
    return console.log("kt8 verisi tek transaction'da silindi.");
  }

  if (arg !== "senaryo") throw new Error("senaryo | token | temizle");
  if (ids.length > 0) throw new Error("kt8 uyeleri var, once temizle.");
  const settings = await prisma.kalpToplaSettings.findUniqueOrThrow({ where: { id: "singleton" } });
  if (settings.mode !== "HIDDEN" || settings.testThreshold !== 2) throw new Error(`Gizli yayin + esik 2 gerekli: ${settings.mode}/${settings.testThreshold}`);

  const usedProducts = (await prisma.kalpRound.findMany({ distinct: ["productId"], select: { productId: true } })).map((r) => r.productId);
  const products = await prisma.product.findMany({
    where: { status: "PUBLISHED", kalpToplaExcluded: false, id: { notIn: usedProducts }, optionImages: { some: {} } },
    select: { id: true, name: true },
    take: 3
  });
  if (products.length !== 3) throw new Error("Bos urun yok.");

  const now = new Date();
  const [A, B, C] = await Promise.all(
    [
      { email: EMAILS[0], name: "Ayşe Onaylı", marketingEmailAt: now },
      { email: EMAILS[1], name: "Berk Onaysız", marketingEmailAt: null },
      { email: EMAILS[2], name: "Cem Dışarı", marketingEmailAt: now }
    ].map((m) => prisma.customer.create({ data: { ...m, passwordHash: "yok", emailVerifiedAt: now } }))
  );
  await prisma.kalpToplaSettings.update({ where: { id: "singleton" }, data: { testerCustomerIds: { push: [A.id, B.id] } } });

  const pushCalls: string[] = [];
  let pushMode: "ok" | "gone" = "ok";
  const sender = async (target: { endpoint: string }) => {
    pushCalls.push(target.endpoint);
    return pushMode === "ok" ? ({ ok: true } as const) : ({ ok: false, status: 410 } as const);
  };
  const sub = (id: string, tag: string) =>
    prisma.pushSubscription.create({ data: { customerId: id, endpoint: `https://fcm.googleapis.com/kt8/${tag}`, p256dh: "x", auth: "y" } });
  await sub(A.id, "a");
  await sub(C.id, "c");

  const rows = (customerId: string, type: string) => prisma.notification.findMany({ where: { customerId, type }, orderBy: { createdAt: "asc" } });

  // 1) Son 2 kalp: gunun ilk olayi e-posta + site ici + push. Es zamanli iki teslimat tek gonderim.
  await giveHeart(A.id, products[0].id);
  await Promise.all([n.deliverOutbox({ customerId: A.id, sender }), n.deliverOutbox({ customerId: A.id, sender })]);
  let [near] = await rows(A.id, "BAR_NEAR");
  check("son 2 kalp: e-posta SENT", near?.emailStatus === "SENT", near?.emailStatus);
  check("son 2 kalp: push SENT, cift gonderim yok", near?.pushStatus === "SENT" && pushCalls.length === 1, `${pushCalls.length} push`);
  check("son 2 kalp: isTest payload", JSON.parse(near.payloadJson).isTest === true);
  check("gunluk hak 1 satir", (await prisma.reminderEmailDay.count({ where: { customerId: A.id } })) === 1);

  // 2) Ayni gun arkadasin katildi: yalniz site ici + push.
  const invite = await prisma.kalpInvite.create({ data: { inviterId: A.id, inviteeId: B.id, status: "CREDITED", isTest: true } });
  await prisma.kalpBonusCredit.create({
    data: { inviteId: invite.id, customerId: A.id, points: 2, status: "WAITING", expiresAt: new Date(Date.now() - 1000), isTest: true }
  });
  await n.notifyInviteJoined(invite, 2);
  await n.deliverOutbox({ customerId: A.id, sender });
  const [joined] = await rows(A.id, "INVITE_JOINED");
  check("arkadasin katildi: SKIPPED_DAILY_LIMIT", joined?.emailStatus === "SKIPPED_DAILY_LIMIT", joined?.emailStatus);
  check("arkadasin katildi: push SENT", joined?.pushStatus === "SENT");

  // 3) Atlanan e-posta ertesi gune tasinmaz: cron tekrar denemesi dokunmaz.
  await n.deliverOutbox({ customerId: A.id, sender, retry: true });
  const [joinedAfter] = await rows(A.id, "INVITE_JOINED");
  check("atlanan e-posta tasinmaz", joinedAfter.emailStatus === "SKIPPED_DAILY_LIMIT");

  // 4) Tarih sinirinda iki olay: 23:50 ve 00:10 (Istanbul) iki ayri gunun e-postasi.
  const dayKey = new Date(now.getTime() + 2 * 24 * HOUR).toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
  const at = (time: string, offsetDays = 0) => new Date(new Date(`${dayKey}T${time}:00+03:00`).getTime() + offsetDays * 24 * HOUR);
  for (const [tag, createdAt] of [["2350", at("23:50")], ["0010", at("00:10", 1)]] as const) {
    await prisma.notification.create({
      data: {
        customerId: A.id,
        type: "BAR_NEAR",
        eventKey: `kt8-gun:${tag}:${A.id}`,
        title: "kt8",
        body: "kt8",
        createdAt,
        pushStatus: "NOT_APPLICABLE",
        payloadJson: JSON.stringify({ productId: products[0].id, points: 1, threshold: 2, left: 1, isTest: true })
      }
    });
  }
  await n.deliverOutbox({ customerId: A.id, sender });
  const dayRows = await prisma.notification.findMany({ where: { eventKey: { startsWith: "kt8-gun:" } } });
  check("gun siniri: iki e-posta", dayRows.every((r) => r.emailStatus === "SENT"), dayRows.map((r) => r.emailStatus).join("/"));
  check("gun siniri: 3 gunluk hak", (await prisma.reminderEmailDay.count({ where: { customerId: A.id } })) === 3);

  // 5) Son 6 saat: gunluk sinir disi, kupon basina 1. Kullanilan kupona gitmez.
  const round = await prisma.kalpRound.create({
    data: { productId: products[0].id, roundNo: 900_000 + Math.floor(Math.random() * 90_000), threshold: 2, status: "CLOSED", isTest: true, closedAt: now }
  });
  const coupon = (hours: number) =>
    prisma.kalpCoupon.create({
      data: { code: `KT8-${randomBytes(4).toString("hex").toUpperCase()}`, customerId: A.id, roundId: round.id, discountPercent: 50, expiresAt: new Date(Date.now() + hours * HOUR), isTest: true }
    });
  const expiring = await coupon(5.5);
  await coupon(30);
  check("son 6 saat: yalniz pencere ici kupon", (await n.queueExpiringCoupons(new Date(), A.id)) === 1);
  await n.deliverOutbox({ customerId: A.id, sender });
  const [soon] = await rows(A.id, "COUPON_EXPIRING");
  check("son 6 saat: e-posta SENT (sinir disi)", soon?.emailStatus === "SENT", soon?.emailStatus);
  check("son 6 saat: ikinci kez uretilmez", (await n.queueExpiringCoupons(new Date(), A.id)) === 0);
  await prisma.kalpCoupon.update({ where: { id: expiring.id }, data: { expiringEmailAt: new Date() } });
  const used = await coupon(4);
  await n.queueExpiringCoupons(new Date(), A.id);
  await prisma.kalpCoupon.update({ where: { id: used.id }, data: { status: "USED", usedAt: new Date() } });
  await n.deliverOutbox({ customerId: A.id, sender });
  const usedRow = await prisma.notification.findUnique({ where: { eventKey: `coupon-expiring:${used.id}` } });
  check("kullanilan kupona e-posta gitmez", usedRow?.emailStatus === "NOT_APPLICABLE", usedRow?.emailStatus);

  // 6) Ayni gun 3 bar doldu: 3 kupon e-postasi. Onaysiz uyeye e-posta yok.
  await giveHeart(A.id, products[1].id);
  await giveHeart(A.id, products[2].id);
  for (const product of products) await giveHeart(B.id, product.id);
  await n.deliverOutbox({ customerId: A.id, sender });
  await n.deliverOutbox({ customerId: B.id, sender });
  const won = await rows(A.id, "COUPON_WON");
  check("3 bar: 3 kupon e-postasi", won.length === 3 && won.every((r) => r.emailStatus === "SENT"), won.map((r) => r.emailStatus).join("/"));
  check("kupon olayi isTest", won.every((r) => JSON.parse(r.payloadJson).isTest === true));
  const wonB = await rows(B.id, "COUPON_WON");
  check("onaysiz uye: e-posta yok", wonB.length === 3 && wonB.every((r) => r.emailStatus === "SKIPPED_NO_CONSENT"), wonB.map((r) => r.emailStatus).join("/"));
  check("onaysiz uye: abonelik yok, push NOT_APPLICABLE", wonB.every((r) => r.pushStatus === "NOT_APPLICABLE"));

  // 7) Ayni olay ikinci kez yazilmaz.
  const again = await prisma.$transaction((tx) =>
    n.queueNotifications(tx, [{ customerId: A.id, type: "BAR_NEAR", eventKey: near.eventKey, title: "x", body: "x" }])
  );
  check("eventKey tekrar uretmez", again.count === 0);

  // 8) Faz 0 kural 2: test hesabi olmayana yerelde push gitmez.
  const callsBefore = pushCalls.length;
  await prisma.$transaction((tx) =>
    n.queueNotifications(tx, [{ customerId: C.id, type: "BAR_NEAR", eventKey: `kt8-disari:${C.id}`, title: "kt8", body: "kt8", payloadJson: JSON.stringify({ isTest: true }) }])
  );
  await prisma.notification.updateMany({ where: { customerId: C.id }, data: { emailStatus: "NOT_APPLICABLE" } });
  await n.deliverOutbox({ customerId: C.id, sender });
  const [outside] = await rows(C.id, "BAR_NEAR");
  check("test disi hesaba push yok", outside.pushStatus === "NOT_APPLICABLE" && pushCalls.length === callsBefore, outside.pushStatus);

  // 9) 410 donen abonelik silinir.
  pushMode = "gone";
  await prisma.$transaction((tx) =>
    n.queueNotifications(tx, [{ customerId: A.id, type: "BAR_NEAR", eventKey: `kt8-410:${A.id}`, title: "kt8", body: "kt8", payloadJson: JSON.stringify({ isTest: true }) }])
  );
  await prisma.notification.updateMany({ where: { eventKey: `kt8-410:${A.id}` }, data: { emailStatus: "NOT_APPLICABLE" } });
  await n.deliverOutbox({ customerId: A.id, sender });
  check("410 abonelik silindi", (await prisma.pushSubscription.count({ where: { customerId: A.id } })) === 0);

  // 10) Bekleyen bonus suresi doldu: yalniz site ici.
  await expireWaitingCredits(new Date());
  const [expired] = await rows(A.id, "BONUS_EXPIRED");
  check("bonus doldu: site ici bildirim", expired?.emailStatus === "NOT_APPLICABLE" && expired?.pushStatus === "NOT_APPLICABLE");

  near = (await rows(A.id, "BAR_NEAR"))[0];
  console.log(`\n${passed} OK, ${failed} hata. Giden e-posta: ${await prisma.notification.count({ where: { customerId: { in: [A.id, B.id, C.id] }, emailStatus: "SENT" } })}`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => setTimeout(() => process.exit(), 300));
