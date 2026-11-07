// Musteri e-postalarinin test gonderimi (docs/mail-tasarimlari/MAIL_TASARIMLARI_PLANI.md
// "Test mailleri"). 16 e-posta tipinin her birinden bir tane, sirayla, konu
// basinda [TEST 01/16] ile ALICI adresine gider.
//
// DB'ye hicbir sey yazmaz: dogrulama token'i, bildirim, kupon uretilmez; yalniz
// okuma yapilir ve sablonlar dogrudan render edilir. Linkler canli siteye gider,
// dogrulama linki ornek token'lidir.
//
// Calistirma: npx tsx scripts/mail-test-gonder.ts
// Kuru calisma (gondermez, HTML'leri klasore yazar): ... --kuru <klasor>
import "dotenv/config";
import { config } from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../src/lib/prisma";
import { sendMail } from "../src/lib/mail";
import { LIVE_SITE_URL, emailImageUrl, type RenderedEmail } from "../src/lib/email/layout";
import { orderReceivedEmail, orderStatusEmail, refundEmail, returnStatusEmail, type ReturnEmailData } from "../src/lib/email/order-emails";
import { verificationKalpEmail, verificationPlainEmail, verificationSignupEmail } from "../src/lib/email/verification-emails";
import { loadOrderEmailData, loadReturnEmailData } from "../src/lib/order-notifications";
import { buildAbandonedCartReminderEmail, type CartLineSnapshot } from "../src/lib/abandoned-carts";
import { loadRestockInfo, restockEmail } from "../src/lib/stock-alerts";
import { getKalpSettings } from "../src/lib/kalp-topla/settings";
import { campaignNumbers, loadKalpProductCard, loadSignupProducts, SIGNUP_EMAIL_PRODUCT_SLUGS, TOKEN_HOURS } from "../src/lib/kalp-topla/email-verification";
import { barNearEmail, couponExpiringEmail, couponWonEmail, inviteJoinedEmail, type EmailCommon } from "../src/lib/kalp-topla/notification-emails";
import { formatUntil } from "../src/lib/kalp-topla/notifications";
import { BONUS_WAITING_DAYS } from "../src/lib/kalp-topla/bonus";
import { whatsappShareUrl } from "../src/lib/kalp-topla/invite-rules";
import type { ReturnStatus } from "../src/lib/status";

const ALICI = "ozilevent@gmail.com";
const SITE = LIVE_SITE_URL;
const BEKLEME_MS = 1200; // Resend saniyede 2 istek sinirinin altinda kal
const ORNEK_TOKEN = "ORNEK-TEST-TOKEN";

// R2_PUBLIC_BASE_URL (gorsellerin JPEG kopyasi icin) yerelde .env.local'da; cagri aninda okunur.
config({ path: ".env.local" });

// MAIL_DEV_REDIRECT tanimliysa sendMail konuya "[TEST → asil alici]" ekler ve
// o adrese yonlendirir; burada alici zaten ALICI, konu [TEST nn/16] ile baslasin.
delete process.env.MAIL_DEV_REDIRECT;

const kuruIndex = process.argv.indexOf("--kuru");
const KURU_KLASOR = kuruIndex >= 0 ? process.argv[kuruIndex + 1] : null;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const variantSelect = {
  id: true,
  priceCents: true,
  stock: true,
  options: { select: { value: { select: { value: true, attribute: { select: { isColor: true } } } } } }
} as const;

async function productBySlug(slug: string) {
  return prisma.product.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      priceCents: true,
      images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
      optionImages: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
      variants: { where: { stock: { gt: 0 } }, take: 1, select: variantSelect }
    }
  });
}

async function main() {
  if (!KURU_KLASOR && !process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY tanimli degil, gonderim yapilamaz.");

  // --- Veri (yalniz okuma) ---
  const settings = await getKalpSettings();
  const numbers = campaignNumbers(settings);
  const me = await prisma.customer.findFirst({ where: { email: { equals: ALICI, mode: "insensitive" } }, select: { name: true } });
  const firstName = me?.name.trim().split(/\s+/)[0] || "Test";

  // Odenmis gercek siparis yoksa kalemi olan en son siparis (silinmis test siparisi
  // de olabilir) yalniz gorunum icin kopyalanir; durumu e-postaya yansimaz.
  const order =
    (await prisma.order.findFirst({
      where: { deletedAt: null, status: { in: ["PAID", "PREPARING", "SHIPPED", "DELIVERED"] }, items: { some: {} } },
      orderBy: { createdAt: "desc" }
    })) ?? (await prisma.order.findFirst({ where: { items: { some: {} } }, orderBy: { createdAt: "desc" } }));
  if (!order) throw new Error("Ornek siparis bulunamadi.");
  const orderData = await loadOrderEmailData(order);
  // Kargo bilgisi yoksa 02'nin kargo blogu gizli gorunur; testte blogu gormek icin ornek deger.
  const shippedData = orderData.shipment?.trackingCode
    ? orderData
    : { ...orderData, shipment: { carrier: orderData.shipment?.carrier || "Örnek Kargo", trackingCode: "TEST123456789" } };
  console.log(`Ornek siparis: ${order.orderNumber} (${orderData.items.length} kalem)${shippedData === orderData ? "" : " - kargo bilgisi ornek"}`);

  const returnRow = await prisma.returnRequest.findFirst({
    orderBy: { updatedAt: "desc" },
    include: { order: true }
  });
  const returnStatus: ReturnStatus = "ONAYLANDI";
  let returnData: ReturnEmailData;
  if (returnRow) {
    returnData = { ...(await loadReturnEmailData(returnRow.order, returnRow.status as ReturnStatus)) };
    if (returnData.items.length === 0) returnData = { ...returnData, items: (await loadOrderEmailData(returnRow.order)).items.slice(0, 1) };
    console.log(`Ornek iade talebi: ${returnRow.order.orderNumber} (${returnRow.type}), durum ONAYLANDI olarak gosteriliyor`);
  } else {
    returnData = { siteUrl: SITE, customerName: order.customerName, orderNumber: order.orderNumber, type: "DEGISIM", items: orderData.items.slice(0, 1) };
    console.log("Iade talebi yok: ornek siparisin ilk kalemiyle degisim talebi");
  }

  const [kaban, deriCeket, kazak] = await Promise.all(SIGNUP_EMAIL_PRODUCT_SLUGS.map(productBySlug));
  if (!kaban || !deriCeket || !kazak) throw new Error("Kalp Topla urunlerinden biri bulunamadi.");

  const verifyCommon = { siteUrl: SITE, firstName, verifyUrl: `${SITE}/hesap/dogrula?token=${ORNEK_TOKEN}`, tokenHours: TOKEN_HOURS };
  const kalpCard = await loadKalpProductCard(kaban.id, settings, SITE);
  const signupProducts = await loadSignupProducts(settings, SITE);

  const cartLines: CartLineSnapshot[] = [deriCeket, kazak].map((p) => {
    const variant = p.variants[0];
    const color = variant?.options.find((o) => o.value.attribute.isColor)?.value.value ?? "";
    const size = variant?.options.find((o) => !o.value.attribute.isColor)?.value.value ?? "";
    return { name: p.name, color, size, quantity: 1, priceCents: variant?.priceCents ?? p.priceCents, image: p.images[0]?.url ?? p.optionImages[0]?.url };
  });
  const cartTotal = cartLines.reduce((sum, l) => sum + l.priceCents * l.quantity, 0);

  const restockInfo = await loadRestockInfo({ email: ALICI, productName: kaban.name, productSlug: kaban.slug, variantId: kaban.variants[0]?.id });

  const kalpCommon: EmailCommon = { siteUrl: SITE, unsubscribeUrl: `${SITE}/abonelik/iptal?t=ornek`, firstName };
  const kabanImage = emailImageUrl(kaban.images[0]?.url ?? kaban.optionImages[0]?.url ?? null);
  const until = formatUntil(new Date(Date.now() + settings.couponHours * 60 * 60 * 1000));
  const kabanUrl = `${SITE}/urunler/${encodeURIComponent(kaban.slug)}`;
  const kalplerimUrl = `${SITE}/hesap/kalplerim`;
  const threshold = numbers.threshold;
  const nearPoints = Math.max(threshold - 2, 0);

  // --- Plandaki sira ---
  const mails: [string, () => RenderedEmail][] = [
    ["Sipariş alındı", () => orderReceivedEmail(orderData)],
    ["Ödendi (PAID)", () => orderStatusEmail(orderData, "PAID")],
    ["Kargoya verildi", () => orderStatusEmail(shippedData, "SHIPPED")],
    ["Teslim edildi", () => orderStatusEmail(orderData, "DELIVERED")],
    ["İade yapıldı (tam)", () => refundEmail(orderData, order.totalCents, true)],
    ["Kısmi iade", () => refundEmail(orderData, orderData.items[0]?.totalCents ?? order.totalCents, false)],
    ["İade talebi durumu", () => returnStatusEmail(returnData, returnStatus)],
    ["Doğrulama sade (kampanya kapalı)", () => verificationPlainEmail(verifyCommon)],
    ["Doğrulama kalp verince (14)", () => verificationKalpEmail(verifyCommon, numbers, kalpCard)],
    ["Doğrulama üyelik (15)", () => verificationSignupEmail(verifyCommon, numbers, signupProducts)],
    ["Sepet hatırlatma", () => buildAbandonedCartReminderEmail(cartLines, cartTotal, SITE)],
    ["Tekrar stokta", () => restockEmail(restockInfo, SITE)],
    [
      "Kalp: kupon kazandın",
      () =>
        couponWonEmail(kalpCommon, {
          productName: kaban.name,
          imageUrl: kabanImage,
          threshold,
          discountPercent: settings.discountPercent,
          couponHours: settings.couponHours,
          code: "TEST-ORNEK",
          untilLabel: until
        })
    ],
    [
      "Kalp: son kalpler kaldı",
      () =>
        barNearEmail(kalpCommon, {
          productName: kaban.name,
          imageUrl: kabanImage,
          points: nearPoints,
          threshold,
          left: threshold - nearPoints,
          discountPercent: settings.discountPercent,
          inviteBonus: settings.inviteBonus,
          whatsappUrl: whatsappShareUrl(`${SITE}/davet/ORNEK?urun=${encodeURIComponent(kaban.slug)}`),
          kalplerimUrl
        })
    ],
    [
      "Kalp: arkadaşın katıldı",
      () =>
        inviteJoinedEmail(kalpCommon, {
          productName: kaban.name,
          imageUrl: kabanImage,
          bonus: settings.inviteBonus,
          points: Math.min((kalpCard?.points ?? 0) + settings.inviteBonus, threshold),
          threshold,
          waitingDays: BONUS_WAITING_DAYS,
          barUrl: kabanUrl,
          catalogUrl: `${SITE}/urunler`,
          kalplerimUrl
        })
    ],
    ["Kalp: kupon bitiyor", () => couponExpiringEmail(kalpCommon, { code: "TEST-ORNEK", discountPercent: settings.discountPercent, untilLabel: until })]
  ];

  const failures: string[] = [];
  const brokenImages = new Map<string, number | string>();
  const total = String(mails.length).padStart(2, "0");

  for (const [i, [label, render]] of mails.entries()) {
    const no = String(i + 1).padStart(2, "0");
    const tag = `[TEST ${no}/${total}]`;
    let email: RenderedEmail;
    try {
      email = render();
    } catch (error) {
      failures.push(`${tag} ${label}: hazirlanamadi (${error instanceof Error ? error.message : String(error)})`);
      continue;
    }
    if (/localhost|127\.0\.0\.1/.test(email.html + email.text)) {
      failures.push(`${tag} ${label}: icerikte yerel adres var, gonderilmedi`);
      continue;
    }
    for (const src of email.html.matchAll(/<img src="([^"]+)"/g)) {
      const url = src[1].replace(/&amp;/g, "&");
      if (brokenImages.has(url)) continue;
      const status = await fetch(url, { method: "HEAD" }).then((r) => r.status, (e: Error) => e.message);
      if (status !== 200) brokenImages.set(url, status);
    }

    if (KURU_KLASOR) {
      mkdirSync(KURU_KLASOR, { recursive: true });
      writeFileSync(join(KURU_KLASOR, `${no}.html`), email.html);
      console.log(`yazildi    ${tag} ${label}: ${email.subject}`);
      continue;
    }

    const errors: string[] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => errors.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
    const ok = await sendMail({ to: ALICI, subject: `${tag} ${email.subject}`, html: email.html, text: email.text }).finally(() => {
      console.error = originalError;
    });
    console.log(`${ok ? "gonderildi" : "HATA      "} ${tag} ${label}: ${email.subject}`);
    if (!ok) failures.push(`${tag} ${label}: ${errors.join(" | ") || "bilinmeyen hata"}`);
    await sleep(BEKLEME_MS);
  }

  console.log("");
  if (brokenImages.size > 0) {
    console.log("Acilmayan gorseller:");
    for (const [url, status] of brokenImages) console.log(`  ${status} ${url}`);
  }
  if (KURU_KLASOR) console.log(`Kuru calisma: HTML'ler ${KURU_KLASOR} klasorunde, gonderim yapilmadi.`);
  if (failures.length === 0 && !KURU_KLASOR) console.log(`Tamam: ${mails.length}/${mails.length} e-posta ${ALICI} adresine gonderildi.`);
  else if (failures.length > 0) {
    console.log(`${failures.length} e-posta gonderilemedi:`);
    for (const f of failures) console.log(`  ${f}`);
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
