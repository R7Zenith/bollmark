// Kalp Topla Faz 5 DB senaryolari (KALP_TOPLA_PLANI.md 10.2; T13). Canli DB'de calisir:
// - Kullanicinin Gizli yayin verisine dokunmaz. Gecici kt5-...@example.invalid uyeleri
//   ve bari olmayan yayindaki urunler kullanir; esikler yalniz bu turlarda dogrudan verilir.
// - Mod yalniz Gizli yayin -> Kapali -> Gizli yayin yapar, asla Acik yapmaz.
// - Esik ayarlari degismez. Gecici degisip geri alinan: mod, test hesabi listesi.
// - Yedek yazar; hata ya da Ctrl+C'de temizler; sonunda parmak izini karsilastirir.
// - E-posta gondermez (RESEND_API_KEY bu surecte kaldirilir).
// - Ayni IP sahte ozetlerle denenir, DEVICE_IP_SALT gerekmez ve uretilmez.
//
// Calistirma: npx tsx scripts/kalp-topla-senaryo-faz5.ts
// Ekran verisi: npx tsx scripts/kalp-topla-senaryo-faz5.ts ekran-hazirla
// Yarida kalirsa / ekran sonrasi: npx tsx scripts/kalp-topla-senaryo-faz5.ts temizle
import "dotenv/config";
import Module from "node:module";
import os from "node:os";
import path from "node:path";
import { rmSync, writeFileSync } from "node:fs";
import bcrypt from "bcryptjs";
import { watchInterrupt } from "./kalp-topla-test-guvenlik";
import { addTesters, cleanupAndVerify, prepareRun, recoverFromLatestBackup, removeTesters, setMode, TEST_ACTOR } from "./kalp-topla-test-guvenlik-faz5";

delete process.env.RESEND_API_KEY;
// "server-only" Next'in icinde gelir; script disinda bos modul yuklenir.
const moduleWithResolve = Module as unknown as { _resolveFilename: (request: string, ...rest: unknown[]) => string };
const originalResolve = moduleWithResolve._resolveFilename;
moduleWithResolve._resolveFilename = function (request: string, ...rest: unknown[]) {
  if (request === "server-only") return path.resolve("node_modules/next/dist/compiled/server-only/empty.js");
  return originalResolve.call(this, request, ...rest);
};

const RUN = Date.now().toString(36);
const PRODUCT_COUNT = 26;
const ACTOR = { actorEmail: TEST_ACTOR, actorRole: "ADMIN" };
const DAY_MS = 24 * 60 * 60 * 1000;
const STATE = path.join(os.tmpdir(), "kalp-topla-ekran-faz5.json");
const assertRunning = watchInterrupt();
let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail = "") {
  if (ok) passed += 1;
  else failed += 1;
  console.log(`${ok ? "OK  " : "HATA"} ${name}${detail ? ` (${detail})` : ""}`);
  assertRunning();
}

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const arg = process.argv[2];
  if (arg === "temizle") {
    const same = await recoverFromLatestBackup(prisma);
    rmSync(STATE, { force: true });
    if (!same) process.exitCode = 1;
    return;
  }
  const bar = await import("../src/lib/kalp-topla/bar");
  const invite = await import("../src/lib/kalp-topla/invite");
  const { formatInviteValue } = await import("../src/lib/kalp-topla/invite-rules");
  const { getKalpSettings } = await import("../src/lib/kalp-topla/settings");

  const backup = await prepareRun(prisma, arg === "ekran-hazirla" ? "ekran" : "senaryo", PRODUCT_COUNT);
  const products = [...backup.productIds];
  const nextProduct = () => {
    const id = products.shift();
    if (!id) throw new Error("Urun bitti.");
    return id;
  };
  let seq = 0;

  const member = async (options: { verified?: boolean; passwordHash?: string; tester?: boolean; label?: string } = {}) => {
    seq += 1;
    const c = await prisma.customer.create({
      data: {
        email: `kt5-${options.label ?? "uye"}-${RUN}-${seq}@example.invalid`,
        name: `KT5 Test ${seq}`,
        passwordHash: options.passwordHash ?? "senaryo-giris-yok",
        emailVerifiedAt: options.verified === false ? null : new Date()
      }
    });
    if (options.tester !== false) await addTesters(prisma, [c.id]);
    return c.id;
  };
  const codeOf = (id: string) => invite.ensureReferralCode(id);
  // Istenen puan ve esikle acik test turu; heart verilince puan +1 olur.
  const openBar = async (productId: string, points: number, threshold: number) => {
    const round = await prisma.kalpRound.create({ data: { productId, roundNo: 1, threshold, isTest: true } });
    await prisma.kalpBar.create({ data: { productId, currentRoundId: round.id, points } });
  };
  const barPoints = async (productId: string) => (await prisma.kalpBar.findUnique({ where: { productId } }))?.points ?? 0;
  const creditsOf = (customerId: string) => prisma.kalpBonusCredit.findMany({ where: { customerId }, orderBy: { createdAt: "asc" } });
  // Davetlinin kaydi: cihaz satiri + davet (cerez/gizli alanla ayni deger).
  const signup = async (inviterId: string, options: { productId?: string; deviceId?: string; ipHash?: string; verified?: boolean } = {}) => {
    const id = await member({ verified: false, tester: false, label: "davetli" });
    await prisma.customerDevice.create({
      data: { customerId: id, deviceId: options.deviceId ?? `kt5-cihaz-${RUN}-${seq}`, ipHash: options.ipHash ?? null, event: "SIGNUP" }
    });
    await invite.createInviteOnSignup(id, formatInviteValue(await codeOf(inviterId), options.productId ?? null));
    return id;
  };
  const verify = async (id: string) => {
    await prisma.customer.update({ where: { id }, data: { emailVerifiedAt: new Date() } });
    await invite.processInviteOnVerification(id);
  };
  const inviteOf = (inviteeId: string) => prisma.kalpInvite.findUnique({ where: { inviteeId } });

  try {
    if (arg === "ekran-hazirla") {
      const password = `Kt5-${RUN}-ekran`;
      const passwordHash = await bcrypt.hash(password, 10);
      const a = await member({ passwordHash, label: "ekran-a" });
      const product = await prisma.product.findFirstOrThrow({ where: { id: backup.productIds[0] }, select: { id: true, slug: true } });
      await openBar(product.id, 5, 10);
      await bar.giveHeart(a, product.id);
      const b = await signup(a, { productId: product.id, deviceId: `kt5-ekran-${RUN}` });
      await verify(b);
      const c = await signup(a, { deviceId: `kt5-ekran-${RUN}` });
      await verify(c);
      const email = (await prisma.customer.findUniqueOrThrow({ where: { id: a } })).email;
      writeFileSync(STATE, JSON.stringify({ email, password, slug: product.slug, code: await codeOf(a) }));
      console.log(`Hazir. Durum dosyasi: ${STATE}. Bitince: temizle`);
      return;
    }

    // --- 10.2: bar 9, +2: tur kapanir, artan 1 bekler (Y11) ---
    {
      const P = nextProduct();
      const inviter = await member();
      await openBar(P, 8, 10);
      await bar.giveHeart(inviter, P);
      check("Hazirlik: bar 9", (await barPoints(P)) === 9);
      await verify(await signup(inviter, { productId: P }));
      const credits = await creditsOf(inviter);
      const root = credits.find((c) => !c.splitFromId);
      const rest = credits.find((c) => c.splitFromId);
      check("Bar 9 +2: tur kapandi, yeni tur 0", (await barPoints(P)) === 0 && (await prisma.kalpRound.count({ where: { productId: P, status: "CLOSED" } })) === 1);
      check("Bar 9 +2: davet edene kupon", (await prisma.kalpCoupon.count({ where: { customerId: inviter, isTest: true } })) === 1);
      check("Y11: ana kredi 1 puan ROUND_CLOSED", root?.points === 1 && root.status === "ROUND_CLOSED");
      const days = rest?.expiresAt ? (rest.expiresAt.getTime() - Date.now()) / DAY_MS : 0;
      check("Y11: artan 1 puan WAITING, splitFromId dolu, 30 gun", rest?.points === 1 && rest.status === "WAITING" && rest.splitFromId === root?.id && days > 29.9 && days <= 30);
    }

    // --- Bar 9, kalp +1: artan yok ---
    {
      const P = nextProduct();
      const inviter = await member();
      await openBar(P, 9, 10);
      await bar.giveHeart(inviter, P);
      check("Bar 9 kalp +1: tur kapandi, kredi yok", (await barPoints(P)) === 0 && (await creditsOf(inviter)).length === 0);
    }

    // --- Link urununde kalp yok, barlar 5 ve 8: dolmaya en yakin ---
    {
      const [P1, P2, Link] = [nextProduct(), nextProduct(), nextProduct()];
      const inviter = await member();
      await openBar(P1, 4, 20);
      await openBar(P2, 7, 20);
      await bar.giveHeart(inviter, P1);
      await bar.giveHeart(inviter, P2);
      await verify(await signup(inviter, { productId: Link }));
      check("T4: bonus dolmaya en yakin bara", (await barPoints(P2)) === 10 && (await barPoints(P1)) === 5);
    }

    // --- Link urununde aktif kalp var: dolmaya yakin bara degil linke ---
    {
      const [P1, P2] = [nextProduct(), nextProduct()];
      const inviter = await member();
      await openBar(P1, 4, 20);
      await openBar(P2, 7, 20);
      await bar.giveHeart(inviter, P1);
      await bar.giveHeart(inviter, P2);
      await verify(await signup(inviter, { productId: P1 }));
      check("T4: linkin urunu once", (await barPoints(P1)) === 7 && (await barPoints(P2)) === 8);
    }

    // --- Genel link: hedef urun kredi olusurken okunur ---
    {
      const [P1, P2] = [nextProduct(), nextProduct()];
      const inviter = await member();
      await openBar(P1, 4, 20);
      await openBar(P2, 7, 20);
      await bar.giveHeart(inviter, P1);
      await bar.giveHeart(inviter, P2);
      const guest = await signup(inviter);
      await prisma.customer.update({ where: { id: inviter }, data: { inviteTargetProductId: P1 } });
      await verify(guest);
      check("Genel link: secilen hedefe gitti", (await barPoints(P1)) === 7 && (await barPoints(P2)) === 8);
    }

    // --- Hic aktif kalp yok: bekleyen, ilk kalp 1 + 2 = 3 ---
    {
      const P = nextProduct();
      const inviter = await member();
      await verify(await signup(inviter));
      const waiting = await creditsOf(inviter);
      check("Aktif kalp yok: WAITING 30 gun", waiting.length === 1 && waiting[0].status === "WAITING" && waiting[0].points === 2);
      await openBar(P, 0, 20);
      await bar.giveHeart(inviter, P);
      check("Ilk kalp: bar 1 + 2 = 3", (await barPoints(P)) === 3 && (await creditsOf(inviter))[0].status === "APPLIED");
    }

    // --- 3 bekleyen (6 puan) + ilk kalp, esik 5; baska aktif bar yok ---
    {
      const P = nextProduct();
      const inviter = await member();
      for (let i = 0; i < 3; i += 1) await verify(await signup(inviter));
      await prisma.kalpBonusCredit.updateMany({ where: { customerId: inviter }, data: { expiresAt: new Date(Date.now() + 10 * DAY_MS) } });
      await openBar(P, 0, 5);
      await bar.giveHeart(inviter, P);
      const credits = await creditsOf(inviter);
      const left = credits.filter((c) => c.status === "WAITING");
      const days = left[0]?.expiresAt ? (left[0].expiresAt.getTime() - Date.now()) / DAY_MS : 0;
      check("10.2: 5'te doldu, 2 kredi kapandi", credits.filter((c) => c.status === "ROUND_CLOSED").length === 2 && (await barPoints(P)) === 0);
      check("10.2: 3. kredi 2 puan bekliyor, 30 gun bastan", left.length === 1 && left[0].points === 2 && days > 29.9, `${days.toFixed(1)} gun`);
    }

    // --- Ayni senaryo, baska aktif bar var: kalan oraya gider ---
    {
      const [P, Q] = [nextProduct(), nextProduct()];
      const inviter = await member();
      await openBar(Q, 0, 20);
      await bar.giveHeart(inviter, Q);
      const invitee = [await signup(inviter), await signup(inviter), await signup(inviter)];
      // Baska bar varken krediler hemen yerlesirdi; ilk kalbe birikmesi icin once kapali moda alinir.
      await setMode(prisma, "OFF");
      for (const id of invitee) await verify(id);
      await setMode(prisma, "HIDDEN");
      await openBar(P, 0, 5);
      await bar.giveHeart(inviter, P);
      check("Y5/Y11: kalan kredi diger aktif bara", (await barPoints(P)) === 0 && (await barPoints(Q)) === 3);
    }

    // --- Ayri islem yarim kalirsa bekler, sonraki tetikleyicide yerlesir ---
    {
      const [P, Q] = [nextProduct(), nextProduct()];
      const inviter = await member();
      const settings = await getKalpSettings();
      await openBar(P, 8, 10);
      await openBar(Q, 0, 20);
      await bar.giveHeart(inviter, P);
      await bar.giveHeart(inviter, Q);
      const invitee = await signup(inviter, { productId: P });
      await setMode(prisma, "OFF");
      await verify(invitee);
      await setMode(prisma, "HIDDEN");
      // Yalniz ilk islem calisir, ikinci islem "yarida kesilmis" sayilir.
      await bar.placeWaitingCreditsOnce(inviter, settings);
      const mid = await creditsOf(inviter);
      check("Yarida kalma: artan kisim WAITING, Q degismedi", mid.some((c) => c.status === "WAITING" && c.points === 1) && (await barPoints(Q)) === 1);
      await bar.getBarView(inviter, Q);
      const end = await creditsOf(inviter);
      check("Sonraki tetikleyici (bar acma) yerlestirdi", end.every((c) => c.status !== "WAITING") && (await barPoints(Q)) === 2);
    }

    // --- Kalplerim ile ayni tetikleyici, kalp verme ile yerlesme ---
    {
      const Q = nextProduct();
      const inviter = await member();
      await verify(await signup(inviter));
      await openBar(Q, 0, 20);
      await bar.settlePending(inviter, await getKalpSettings());
      check("Aktif kalp yokken tetikleyici bonus harcamaz", (await creditsOf(inviter))[0].status === "WAITING");
      await bar.giveHeart(inviter, Q);
      check("Kalp verme yerlestirdi", (await barPoints(Q)) === 3);
    }

    // --- Ayni kredi iki kez yerlesmez ---
    {
      const P = nextProduct();
      const inviter = await member();
      await openBar(P, 0, 20);
      const settings = await getKalpSettings();
      await bar.giveHeart(inviter, P);
      const invitee = await signup(inviter);
      await setMode(prisma, "OFF");
      await verify(invitee);
      await setMode(prisma, "HIDDEN");
      await Promise.all([1, 2, 3, 4].map(() => bar.placeWaitingCreditsOnce(inviter, settings)));
      check("4 es zamanli yerlestirme: yalniz bir kez", (await barPoints(P)) === 3, `${await barPoints(P)}`);

      const dup = await signup(inviter);
      await prisma.customer.update({ where: { id: dup }, data: { emailVerifiedAt: new Date() } });
      await Promise.all([1, 2, 3].map(() => invite.processInviteOnVerification(dup)));
      check("3 es zamanli dogrulama: tek kok kredi", (await prisma.kalpBonusCredit.count({ where: { inviteId: (await inviteOf(dup))!.id } })) === 1);

      // Veritabani duzeyi: indeksler ikinci kok krediyi ve ikinci bolunmeyi reddeder.
      const inv = (await inviteOf(dup))!;
      const code = async (run: Promise<unknown>) => run.then(() => "OK", (e: { code?: string }) => e.code ?? "HATA");
      const base = { inviteId: inv.id, customerId: inviter, points: 1, status: "CANCELLED", isTest: true };
      check("DB: ikinci kok kredi reddedildi", (await code(prisma.kalpBonusCredit.create({ data: base }))) === "P2002");
      const parent = (await prisma.kalpBonusCredit.findFirstOrThrow({ where: { inviteId: inv.id } })).id;
      await prisma.kalpBonusCredit.create({ data: { ...base, splitFromId: parent } });
      check("DB: ikinci bolunme reddedildi", (await code(prisma.kalpBonusCredit.create({ data: { ...base, splitFromId: parent } }))) === "P2002");
    }

    // --- 30 gun dolumu ---
    {
      const P = nextProduct();
      const inviter = await member();
      await verify(await signup(inviter));
      await prisma.kalpBonusCredit.updateMany({ where: { customerId: inviter }, data: { expiresAt: new Date(Date.now() - 1000) } });
      await openBar(P, 0, 20);
      await bar.giveHeart(inviter, P);
      check("Suresi gecmis kredi yerlesmez", (await barPoints(P)) === 1);
      await bar.expireWaitingCredits();
      check("Gunluk is: EXPIRED", (await creditsOf(inviter))[0].status === "EXPIRED");
    }

    // --- Kalp geri cekme: bonus duser, beklemeye donmez ---
    {
      const P = nextProduct();
      const inviter = await member();
      await openBar(P, 3, 20);
      await bar.giveHeart(inviter, P);
      await verify(await signup(inviter, { productId: P }));
      check("Hazirlik: bar 6", (await barPoints(P)) === 6);
      await bar.withdrawHeart(inviter, P);
      check("10.3: geri cekme 6 -> 3, VOID_WITHDRAWN", (await barPoints(P)) === 3 && (await creditsOf(inviter))[0].status === "VOID_WITHDRAWN");
    }

    // --- Admin iptali (Y11): uc kredi ---
    {
      const [Closed, Open] = [nextProduct(), nextProduct()];
      const inviter = await member();
      const other = await member();
      await openBar(Closed, 8, 10);
      await openBar(Open, 0, 20);
      await bar.giveHeart(other, Closed);
      await bar.giveHeart(inviter, Closed);
      await bar.giveHeart(inviter, Open);
      const invitee = await signup(inviter, { productId: Open });
      await verify(invitee);
      const inv = (await inviteOf(invitee))!;
      check("Hazirlik: Open bar 3, kredi APPLIED 2", (await barPoints(Open)) === 3);
      // Davetin kredisini uc parcaya bol: kapanmis tur, acik bar, bekleyen.
      const applied = (await creditsOf(inviter))[0];
      const closedRound = await prisma.kalpRound.findFirstOrThrow({ where: { productId: Closed, status: "CLOSED" } });
      await prisma.kalpBonusCredit.update({ where: { id: applied.id }, data: { points: 1 } });
      await prisma.kalpBar.update({ where: { productId: Open }, data: { points: 2 } });
      const closedPart = await prisma.kalpBonusCredit.create({
        data: { inviteId: inv.id, customerId: inviter, points: 1, status: "ROUND_CLOSED", roundId: closedRound.id, splitFromId: applied.id, isTest: true }
      });
      await prisma.kalpBonusCredit.create({
        data: { inviteId: inv.id, customerId: inviter, points: 1, status: "WAITING", splitFromId: closedPart.id, expiresAt: new Date(Date.now() + DAY_MS), isTest: true }
      });
      const couponsBefore = await prisma.kalpCoupon.count({ where: { customerId: inviter } });
      const done = await invite.cancelInvite(inv.id, "senaryo", ACTOR);
      const statuses = (await creditsOf(inviter)).map((c) => c.status).sort();
      check("Y11 iptal: APPLIED bardan dustu", done && (await barPoints(Open)) === 1);
      check("Y11 iptal: WAITING+APPLIED iptal, ROUND_CLOSED kaldi", statuses.join() === "CANCELLED,CANCELLED,ROUND_CLOSED", statuses.join());
      check("Y11 iptal: kupon kaldi, davet CANCELLED", (await prisma.kalpCoupon.count({ where: { customerId: inviter } })) === couponsBefore && (await inviteOf(invitee))?.status === "CANCELLED");
      check("Iptal denetim kaydi", (await prisma.auditLog.count({ where: { action: "KALP_TOPLA_DAVET_IPTAL", targetId: inv.id } })) === 1);
    }

    // --- Kapali iken dogrulama: WAITING, acilinca yerlesir ---
    {
      const P = nextProduct();
      const inviter = await member();
      await openBar(P, 2, 20);
      await bar.giveHeart(inviter, P);
      const invitee = await signup(inviter, { productId: P });
      await setMode(prisma, "OFF");
      await verify(invitee);
      check("FROZEN: kredi WAITING, bar degismedi", (await creditsOf(inviter))[0].status === "WAITING" && (await barPoints(P)) === 3);
      await bar.placeWaitingCredits(inviter);
      check("FROZEN: yerlestirme yapilmaz", (await creditsOf(inviter))[0].status === "WAITING");
      await setMode(prisma, "HIDDEN");
      await bar.getBarView(inviter, P);
      check("Acilinca T4 ile yerlesti", (await barPoints(P)) === 5);
    }

    // --- Ayni cihaz ---
    {
      const P = nextProduct();
      const inviter = await member();
      const device = `kt5-ortak-${RUN}`;
      const first = await signup(inviter, { deviceId: device });
      await verify(first);
      check("Cihazdaki ilk hesap: CREDITED", (await inviteOf(first))?.status === "CREDITED");
      const second = await signup(inviter, { deviceId: device });
      await verify(second);
      const inv = await inviteOf(second);
      check("Ikinci hesap: UNDER_REVIEW SAME_DEVICE", inv?.status === "UNDER_REVIEW" && inv.reviewReasons.join() === "SAME_DEVICE");
      check("Incelemede kredi olusmaz", (await creditsOf(inviter)).length === 1);
      await addTesters(prisma, [second]);
      await openBar(P, 0, 20);
      const given = await bar.giveHeart(second, P);
      check("Ayni cihazdaki hesap kalp verebilir", given.status === "ACTIVE");
      await removeTesters(prisma, [second]);

      await prisma.customerDevice.create({ data: { customerId: inviter, deviceId: `kt5-davetci-${RUN}`, event: "LOGIN" } });
      const third = await signup(inviter, { deviceId: `kt5-davetci-${RUN}` });
      await verify(third);
      const inv3 = await inviteOf(third);
      check("Davet edenle ayni cihaz: UNDER_REVIEW", inv3?.status === "UNDER_REVIEW" && inv3.reviewReasons.join() === "SAME_DEVICE_AS_INVITER");

      // Admin onayi: T4 ile yerlesir (aktif kalp yok, WAITING kalir), ikinci onay etkisiz.
      const approved = await invite.approveInvite(inv3!.id, ACTOR);
      const again = await invite.approveInvite(inv3!.id, ACTOR);
      check("Admin onayi tek sefer", approved && !again && (await prisma.kalpBonusCredit.count({ where: { inviteId: inv3!.id } })) === 1);
      const cancelled = await invite.cancelInvite(inv!.id, "", ACTOR);
      check("Incelemedeki davet iptal: kredi yok", cancelled && (await prisma.kalpBonusCredit.count({ where: { inviteId: inv!.id } })) === 0);
    }

    // --- Ayni IP: yalniz isaret (Y2/Y13), sahte ozet ---
    {
      const P = nextProduct();
      const inviter = await member();
      await openBar(P, 0, 50);
      await bar.giveHeart(inviter, P);
      const ip = `kt5-ip-${RUN}`;
      const a = await signup(inviter, { ipHash: ip });
      await verify(a);
      const b = await signup(inviter, { ipHash: ip });
      await verify(b);
      check("2 hesap: isaret yok", !(await inviteOf(a))?.sameIpFlagAt && !(await inviteOf(b))?.sameIpFlagAt);
      const points = await barPoints(P);
      const c = await signup(inviter, { ipHash: ip });
      await verify(c);
      const list = await Promise.all([a, b, c].map(inviteOf));
      check("3. hesap: uc davet de aynı IP isaretli", list.every((i) => i?.sameIpFlagAt));
      check("3. hesap: hepsi CREDITED, bonus normal", list.every((i) => i?.status === "CREDITED") && (await barPoints(P)) === points + 2);
    }

    // --- Dogrulamalar: kod, davet eden, urun ---
    {
      const inviter = await member();
      const outsider = await member({ tester: false });
      const fresh = await member({ tester: false, verified: false, label: "davetli" });
      const count = () => prisma.kalpInvite.count({ where: { inviteeId: fresh } });
      await invite.createInviteOnSignup(fresh, "BOZUK");
      await invite.createInviteOnSignup(fresh, "ZZZZ2222");
      check("Gecersiz kod: davet yok", (await count()) === 0);
      await invite.createInviteOnSignup(fresh, await codeOf(outsider));
      check("Gizli yayinda test disi davet eden: davet yok", (await count()) === 0);
      await invite.createInviteOnSignup(inviter, await codeOf(inviter));
      check("Kendini davet: davet yok", (await prisma.kalpInvite.count({ where: { inviteeId: inviter } })) === 0);

      const unpublished = await prisma.product.findFirst({ where: { OR: [{ status: { not: "PUBLISHED" } }, { kalpToplaExcluded: true }] }, select: { id: true } });
      await invite.createInviteOnSignup(fresh, formatInviteValue(await codeOf(inviter), unpublished?.id ?? "yok-urun"));
      check("Yayinda olmayan urun: davet var, urun bos", (await inviteOf(fresh))?.productId === null);
      await invite.createInviteOnSignup(fresh, await codeOf(inviter));
      check("Ayni kisi ikinci kez davet edilemez", (await count()) === 1);

      await prisma.kalpInvite.update({ where: { inviteeId: fresh }, data: { productId: "sonradan-gecersiz" } });
      await removeTesters(prisma, [inviter]);
      await verify(fresh);
      const inv = await inviteOf(fresh);
      check("Dogrulamada yeniden kontrol: davet eden uygun degil, iptal", inv?.status === "CANCELLED" && inv.reviewReasons.join() === "INVITER_INELIGIBLE");
      await addTesters(prisma, [inviter]);

      const fresh2 = await signup(inviter, {});
      await prisma.kalpInvite.update({ where: { inviteeId: fresh2 }, data: { productId: "sonradan-gecersiz" } });
      await verify(fresh2);
      check("Dogrulamada yeniden kontrol: gecersiz urun temizlendi", (await inviteOf(fresh2))?.productId === null);
    }

    console.log(`\nSonuc: ${passed} OK, ${failed} hata.`);
    if (failed > 0) process.exitCode = 1;
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
    await finish();
    return;
  }
  await finish();

  async function finish() {
    if (arg === "ekran-hazirla" && !process.exitCode) return;
    const same = await cleanupAndVerify(prisma, backup);
    if (!same) process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
