import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";
import { istanbulDateKey } from "@/lib/format";
import { getSiteUrl } from "@/lib/site-url";
import { jpegCopyUrl } from "@/lib/image-storage";
import type { Notification, Prisma } from "@/generated/prisma/client";
import { unsubscribeUrl } from "./consent";
import { getKalpSettings } from "./settings";
import { BONUS_WAITING_DAYS } from "./bonus";
import { ensureReferralCode } from "./invite";
import { whatsappShareUrl } from "./invite-rules";
import { barNearLeft, channelStatus, emailRule, isGonePushStatus, pushTargetAllowed, type NotificationType } from "./notification-rules";
import { barNearEmail, couponExpiringEmail, couponWonEmail, inviteJoinedEmail, type EmailCommon, type RenderedEmail } from "./notification-emails";
import { pushConfigured, sendWebPush, type PushSender } from "./push";

// Bildirim outbox'i (KALP_TOPLA_PLANI.md 7.1-7.3, Y1). Olayi doguran islem
// Notification satirini yazar (eventKey unique: ayni olay ikinci kez uretilemez).
// Gonderim commit sonrasi after() ile, kalani saatlik cron ile yapilir. Kanal
// durumu SENDING'e kosullu guncellemeyle alinir: ayni kanal iki kez gonderilmez.

type Tx = Prisma.TransactionClient;
type Field = "emailStatus" | "pushStatus";
type Row = Omit<Prisma.NotificationCreateManyInput, "emailStatus" | "pushStatus" | "type"> & { type: NotificationType };

const HOUR_MS = 60 * 60 * 1000;
const RETRY_WINDOW_MS = 24 * HOUR_MS;
// Bu sureden eski SENDING: gonderim yarim kaldi, yeniden denenir.
const STALE_SENDING_MS = 10 * 60 * 1000;
const EXPIRING_WINDOW_MS = 6 * HOUR_MS;
const OUTBOX_BATCH = 100;

export function formatUntil(date: Date): string {
  return date.toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}

function withChannels(row: Row) {
  return { ...row, ...channelStatus(row.type) };
}

export function queueNotifications(tx: Tx, rows: Row[]) {
  return tx.notification.createMany({ data: rows.map(withChannels), skipDuplicates: true });
}

export function couponWonRow(input: {
  customerId: string;
  roundId: string;
  code: string;
  expiresAt: Date;
  discountPercent: number;
  couponHours: number;
  threshold: number;
  productId: string;
  productName: string;
  isTest: boolean;
}): Row {
  const { customerId, roundId, productName, ...payload } = input;
  return {
    customerId,
    type: "COUPON_WON",
    eventKey: `coupon-won:${roundId}:${customerId}`,
    title: `🎉 Kilit açıldı! %${input.discountPercent} kuponun hazır`,
    body: `${productName} ${input.threshold} kalbe ulaştı. Son kullanım: ${formatUntil(input.expiresAt)}`,
    link: "/hesap/kalplerim",
    payloadJson: JSON.stringify(payload)
  };
}

// Bar kilidi altinda, puan her arttiginda: turdaki aktif kalpler bir kez haber alir.
export async function queueBarNear(tx: Tx, bar: { productId: string; roundId: string; points: number; threshold: number; isTest: boolean }) {
  const left = barNearLeft(bar.points, bar.threshold);
  if (left === null) return;
  const [hearts, product] = await Promise.all([
    tx.kalpHeart.findMany({ where: { roundId: bar.roundId, status: "ACTIVE" }, select: { customerId: true } }),
    tx.product.findUnique({ where: { id: bar.productId }, select: { name: true, slug: true } })
  ]);
  if (hearts.length === 0 || !product) return;
  const payloadJson = JSON.stringify({ productId: bar.productId, points: bar.points, threshold: bar.threshold, left, isTest: bar.isTest });
  await queueNotifications(
    tx,
    hearts.map((heart) => ({
      customerId: heart.customerId,
      type: "BAR_NEAR",
      eventKey: `bar-near:${bar.roundId}:${heart.customerId}`,
      title: `❤️ Son ${left} kalp kaldı!`,
      body: `${product.name} barı ${bar.points}/${bar.threshold}. Arkadaşını çağır, kilidi birlikte açın.`,
      link: `/urunler/${product.slug}`,
      payloadJson
    }))
  );
}

// Kredi yerlestirildikten sonra cagrilir: bonusun nereye gittigi ancak o zaman bilinir (plan 7.4).
export async function notifyInviteJoined(invite: { id: string; inviterId: string; isTest: boolean }, bonus: number) {
  const credit = await prisma.kalpBonusCredit.findFirst({ where: { inviteId: invite.id, splitFromId: null } });
  if (!credit) return;
  const round = credit.roundId ? await prisma.kalpRound.findUnique({ where: { id: credit.roundId } }) : null;
  const [product, bar] = round
    ? await Promise.all([
        prisma.product.findUnique({ where: { id: round.productId }, select: { name: true, slug: true } }),
        prisma.kalpBar.findUnique({ where: { productId: round.productId }, select: { points: true } })
      ])
    : [null, null];

  const placed = round && product;
  const points = placed ? (round.status === "CLOSED" ? round.threshold : (bar?.points ?? 0)) : null;
  await prisma.notification.createMany({
    skipDuplicates: true,
    data: [
      withChannels({
        customerId: invite.inviterId,
        type: "INVITE_JOINED",
        eventKey: `invite-joined:${invite.id}`,
        title: "🙌 Arkadaşın katıldı",
        body: placed
          ? `${product.name} barına +${bonus} kalp eklendi. Bar şimdi ${points}/${round.threshold}.`
          : `+${bonus} kalbin ${BONUS_WAITING_DAYS} gün içinde vereceğin ilk kalbin barına eklenecek.`,
        link: placed ? `/urunler/${product.slug}` : "/hesap/kalplerim",
        payloadJson: JSON.stringify({
          productId: placed ? round.productId : null,
          points,
          threshold: placed ? round.threshold : null,
          bonus,
          isTest: invite.isTest
        })
      })
    ]
  });
  dispatchOutbox();
}

// Saatlik cron: kupon basina bir kez, son 6 saate girince (Y1). Kampanya kapaliyken de calisir (T14).
export async function queueExpiringCoupons(now = new Date(), customerId?: string): Promise<number> {
  const coupons = await prisma.kalpCoupon.findMany({
    where: { customerId, status: "AVAILABLE", expiringEmailAt: null, expiresAt: { gt: now, lte: new Date(now.getTime() + EXPIRING_WINDOW_MS) } }
  });
  let queued = 0;
  for (const coupon of coupons) {
    const claimed = await prisma.$transaction(async (tx) => {
      const claim = await tx.kalpCoupon.updateMany({ where: { id: coupon.id, expiringEmailAt: null }, data: { expiringEmailAt: now } });
      if (claim.count !== 1) return false;
      await queueNotifications(tx, [
        {
          customerId: coupon.customerId,
          type: "COUPON_EXPIRING",
          eventKey: `coupon-expiring:${coupon.id}:${coupon.expiresAt.getTime()}`, // suresi uzatilan kupon yeniden hatirlatilir
          title: "⏰ Kuponunun son 6 saati!",
          body: `%${coupon.discountPercent} kuponun için son kullanım: ${formatUntil(coupon.expiresAt)}`,
          link: "/hesap/kalplerim",
          payloadJson: JSON.stringify({
            couponId: coupon.id,
            code: coupon.code,
            expiresAt: coupon.expiresAt,
            discountPercent: coupon.discountPercent,
            isTest: coupon.isTest
          })
        }
      ]);
      return true;
    });
    if (claimed) queued += 1;
  }
  return queued;
}

// Bekleyen bonusun suresi doldu: yalniz site ici (plan 7.1).
export function bonusExpiredRow(credit: { id: string; customerId: string; points: number; isTest: boolean }): Row {
  return {
    customerId: credit.customerId,
    type: "BONUS_EXPIRED",
    eventKey: `bonus-expired:${credit.id}`,
    title: "Bekleyen bonusun süresi doldu",
    body: `+${credit.points} kalbin ${BONUS_WAITING_DAYS} gün içinde bir bara eklenemediği için düştü.`,
    link: "/hesap/kalplerim",
    payloadJson: JSON.stringify({ isTest: credit.isTest })
  };
}

async function claim(id: string, field: Field, from: string[]): Promise<boolean> {
  const res = await prisma.notification.updateMany({ where: { id, [field]: { in: from } }, data: { [field]: "SENDING" } });
  return res.count === 1;
}

function finish(id: string, field: Field, status: string) {
  return prisma.notification.update({ where: { id }, data: { [field]: status } });
}

// Y1: gunun yeri atomik alinir. Yer bu olayda ise (onceki deneme basarisiz) devam edilir.
// Gun, olayin gunudur: yeniden deneme ertesi gune tasinmaz.
async function takeReminderDay(notification: Notification): Promise<boolean> {
  const key = { customerId: notification.customerId, dayKey: istanbulDateKey(notification.createdAt) };
  await prisma.reminderEmailDay.createMany({ data: [{ ...key, notificationId: notification.id }], skipDuplicates: true });
  const row = await prisma.reminderEmailDay.findUnique({ where: { customerId_dayKey: key } });
  return row?.notificationId === notification.id;
}

async function productInfo(productId: string | null | undefined) {
  if (!productId) return null;
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      name: true,
      slug: true,
      images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
      optionImages: { orderBy: { position: "asc" }, take: 1, select: { url: true } }
    }
  });
  if (!product) return null;
  const url = product.images[0]?.url ?? product.optionImages[0]?.url ?? null;
  return { name: product.name, slug: product.slug, imageUrl: url ? (jpegCopyUrl(url) ?? url) : null };
}

type Payload = Record<string, unknown>;

// null: olay artik gecerli degil (kupon kullanildi), e-posta gitmez.
async function renderEmail(notification: Notification, customer: { id: string; name: string }): Promise<RenderedEmail | null> {
  const payload = JSON.parse(notification.payloadJson) as Payload;
  const siteUrl = getSiteUrl();
  const common: EmailCommon = { siteUrl, unsubscribeUrl: unsubscribeUrl(customer.id), firstName: customer.name.split(" ")[0] };
  const kalplerimUrl = `${siteUrl}/hesap/kalplerim`;

  if (notification.type === "COUPON_EXPIRING") {
    const coupon = await prisma.kalpCoupon.findUnique({ where: { id: payload.couponId as string }, select: { status: true, expiresAt: true } });
    if (coupon?.status !== "AVAILABLE" || coupon.expiresAt <= new Date()) return null;
    return couponExpiringEmail(common, {
      code: payload.code as string,
      discountPercent: payload.discountPercent as number,
      untilLabel: formatUntil(coupon.expiresAt)
    });
  }

  const product = await productInfo(payload.productId as string | null);
  const settings = await getKalpSettings();
  if (notification.type === "COUPON_WON") {
    return couponWonEmail(common, {
      productName: product?.name ?? "Ürünün",
      imageUrl: product?.imageUrl ?? null,
      threshold: payload.threshold as number,
      discountPercent: payload.discountPercent as number,
      couponHours: payload.couponHours as number,
      code: payload.code as string,
      untilLabel: formatUntil(new Date(payload.expiresAt as string))
    });
  }
  if (notification.type === "BAR_NEAR") {
    const code = await ensureReferralCode(customer.id);
    const inviteUrl = `${siteUrl}/davet/${code}${product ? `?urun=${encodeURIComponent(product.slug)}` : ""}`;
    return barNearEmail(common, {
      productName: product?.name ?? "Ürünün",
      imageUrl: product?.imageUrl ?? null,
      points: payload.points as number,
      threshold: payload.threshold as number,
      left: payload.left as number,
      discountPercent: settings.discountPercent,
      inviteBonus: settings.inviteBonus,
      whatsappUrl: whatsappShareUrl(inviteUrl),
      kalplerimUrl
    });
  }
  return inviteJoinedEmail(common, {
    productName: product?.name ?? null,
    imageUrl: product?.imageUrl ?? null,
    bonus: payload.bonus as number,
    points: payload.points as number | null,
    threshold: payload.threshold as number | null,
    waitingDays: BONUS_WAITING_DAYS,
    barUrl: product ? `${siteUrl}/urunler/${product.slug}` : kalplerimUrl,
    catalogUrl: `${siteUrl}/urunler`,
    kalplerimUrl
  });
}

function unsubscribeHeaders(customerId: string): Record<string, string> {
  const pageUrl = new URL(unsubscribeUrl(customerId));
  const postUrl = `${pageUrl.origin}/api/abonelik/iptal${pageUrl.search}`;
  return {
    "List-Unsubscribe": `<${postUrl}>, <mailto:bilgi@bollmark.com?subject=Abonelik%20iptal>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"
  };
}

async function deliverEmail(notification: Notification, from: string[]) {
  const rule = emailRule(notification.type);
  if (rule === "NONE" || !(await claim(notification.id, "emailStatus", from))) return;
  try {
    // Onay o an yeniden okunur (plan 7.2).
    const customer = await prisma.customer.findUnique({
      where: { id: notification.customerId },
      select: { id: true, email: true, name: true, marketingEmailAt: true }
    });
    if (!customer?.marketingEmailAt) return void (await finish(notification.id, "emailStatus", "SKIPPED_NO_CONSENT"));
    if (rule === "DAILY" && !(await takeReminderDay(notification))) {
      return void (await finish(notification.id, "emailStatus", "SKIPPED_DAILY_LIMIT"));
    }
    const email = await renderEmail(notification, customer);
    if (!email) return void (await finish(notification.id, "emailStatus", "NOT_APPLICABLE"));
    const sent = await sendMail({ to: customer.email, ...email, headers: unsubscribeHeaders(customer.id) });
    await finish(notification.id, "emailStatus", sent ? "SENT" : "FAILED");
  } catch (error) {
    console.error("Bildirim e-postasi gonderilemedi:", error);
    await finish(notification.id, "emailStatus", "FAILED");
  }
}

async function deliverPush(notification: Notification, from: string[], sender: PushSender) {
  if (notification.pushStatus === "NOT_APPLICABLE" || !(await claim(notification.id, "pushStatus", from))) return;
  try {
    const [subscriptions, settings] = await Promise.all([
      prisma.pushSubscription.findMany({ where: { customerId: notification.customerId } }),
      getKalpSettings()
    ]);
    const allowed = pushTargetAllowed({
      onVercel: Boolean(process.env.VERCEL),
      testerIds: settings.testerCustomerIds,
      customerId: notification.customerId
    });
    if (subscriptions.length === 0 || !allowed || !pushConfigured()) {
      return void (await finish(notification.id, "pushStatus", "NOT_APPLICABLE"));
    }
    const message = { title: notification.title, body: notification.body, link: notification.link };
    let sent = 0;
    let failed = 0;
    for (const subscription of subscriptions) {
      const result = await sender(subscription, message);
      if (result.ok) sent += 1;
      else if (isGonePushStatus(result.status)) await prisma.pushSubscription.deleteMany({ where: { id: subscription.id } });
      else failed += 1;
    }
    await finish(notification.id, "pushStatus", sent > 0 ? "SENT" : failed > 0 ? "FAILED" : "NOT_APPLICABLE");
  } catch (error) {
    console.error("Bildirim push'u gonderilemedi:", error);
    await finish(notification.id, "pushStatus", "FAILED");
  }
}

// retry: FAILED ve yarim kalmis SENDING satirlari da (saatlik cron). customerId: yalniz senaryo testi.
export async function deliverOutbox(options: { retry?: boolean; customerId?: string; sender?: PushSender } = {}) {
  const now = Date.now();
  const statuses = options.retry ? ["PENDING", "FAILED", "SENDING"] : ["PENDING"];
  const rows = await prisma.notification.findMany({
    where: {
      customerId: options.customerId,
      createdAt: { gte: new Date(now - RETRY_WINDOW_MS) },
      OR: [{ emailStatus: { in: statuses } }, { pushStatus: { in: statuses } }]
    },
    orderBy: { createdAt: "asc" },
    take: OUTBOX_BATCH
  });
  for (const row of rows) {
    const stale = options.retry && now - row.createdAt.getTime() > STALE_SENDING_MS;
    const from = options.retry ? ["PENDING", "FAILED", ...(stale ? ["SENDING"] : [])] : ["PENDING"];
    await deliverPush(row, from, options.sender ?? sendWebPush);
    await deliverEmail(row, from);
  }
  return rows.length;
}

// Yaniti bekletmeden gonderir. Istek disinda (script) after() hata verir: satir PENDING kalir, cron toplar.
export function dispatchOutbox() {
  try {
    after(() => deliverOutbox().catch((error) => console.error("Bildirim outbox hatasi:", error)));
  } catch {
    // istek baglami yok
  }
}
