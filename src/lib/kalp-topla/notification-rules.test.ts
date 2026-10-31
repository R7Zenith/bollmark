import { test } from "node:test";
import assert from "node:assert/strict";
import { barNearLeft, channelStatus, emailRule, isAllowedPushEndpoint, isGonePushStatus, pushTargetAllowed } from "./notification-rules";
import { barNearEmail, couponExpiringEmail, couponWonEmail, inviteJoinedEmail } from "./notification-emails";

test("Y1: kupon e-postalari sinirsiz, hatirlatmalar gunluk, digerleri yalniz site ici", () => {
  assert.equal(emailRule("COUPON_WON"), "ALWAYS");
  assert.equal(emailRule("COUPON_EXPIRING"), "ALWAYS");
  assert.equal(emailRule("BAR_NEAR"), "DAILY");
  assert.equal(emailRule("INVITE_JOINED"), "DAILY");
  assert.equal(emailRule("BONUS_EXPIRED"), "NONE");
  assert.deepEqual(channelStatus("COUPON_RESTORED"), { emailStatus: "NOT_APPLICABLE", pushStatus: "NOT_APPLICABLE" });
  assert.deepEqual(channelStatus("BAR_NEAR"), { emailStatus: "PENDING", pushStatus: "PENDING" });
});

test("son 2 kalp yalniz 1 ya da 2 kalp kala", () => {
  assert.equal(barNearLeft(7, 10), null);
  assert.equal(barNearLeft(8, 10), 2);
  assert.equal(barNearLeft(9, 10), 1);
  assert.equal(barNearLeft(10, 10), null);
  assert.equal(barNearLeft(0, 2), null);
  assert.equal(barNearLeft(1, 2), 1);
});

test("Faz 0: Vercel disinda push yalniz test hesabina", () => {
  assert.equal(pushTargetAllowed({ onVercel: false, testerIds: ["a"], customerId: "a" }), true);
  assert.equal(pushTargetAllowed({ onVercel: false, testerIds: ["a"], customerId: "b" }), false);
  assert.equal(pushTargetAllowed({ onVercel: true, testerIds: [], customerId: "b" }), true);
});

test("push adresi yalniz tarayici servisleri", () => {
  assert.equal(isAllowedPushEndpoint("https://fcm.googleapis.com/fcm/send/abc"), true);
  assert.equal(isAllowedPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/x"), true);
  assert.equal(isAllowedPushEndpoint("https://wns2-db5p.notify.windows.com/w/?token=x"), true);
  assert.equal(isAllowedPushEndpoint("http://fcm.googleapis.com/x"), false);
  assert.equal(isAllowedPushEndpoint("https://169.254.169.254/latest"), false);
  assert.equal(isAllowedPushEndpoint("https://fcm.googleapis.com.evil.test/x"), false);
  assert.equal(isAllowedPushEndpoint("gecersiz"), false);
});

test("404/410 abonelik silinir, digerleri silinmez", () => {
  assert.equal(isGonePushStatus(404), true);
  assert.equal(isGonePushStatus(410), true);
  assert.equal(isGonePushStatus(500), false);
  assert.equal(isGonePushStatus(undefined), false);
});

const common = { siteUrl: "https://site.test", unsubscribeUrl: "https://site.test/abonelik/iptal?t=x", firstName: "Ece" };

test("dort sablonda cikis linki, buton ve duz metin var", () => {
  const emails = [
    couponWonEmail(common, { productName: "Elbise", imageUrl: "https://img/x.jpg", threshold: 10, discountPercent: 50, couponHours: 48, code: "KALP-1", untilLabel: "5 Kasım 14:30" }),
    barNearEmail(common, { productName: "Elbise", imageUrl: null, points: 8, threshold: 10, left: 2, discountPercent: 50, inviteBonus: 2, whatsappUrl: "https://wa.me/?text=x", kalplerimUrl: "https://site.test/k" }),
    inviteJoinedEmail(common, { productName: "Elbise", imageUrl: null, bonus: 2, points: 7, threshold: 10, waitingDays: 30, barUrl: "https://b", catalogUrl: "https://c", kalplerimUrl: "https://k" }),
    couponExpiringEmail(common, { code: "KALP-1", discountPercent: 50, untilLabel: "bugün 20:30" })
  ];
  for (const email of emails) {
    assert.ok(email.html.includes("Bu bildirimleri almak istemiyorum"));
    assert.ok(email.html.includes(common.unsubscribeUrl));
    assert.ok(email.text.includes(common.unsubscribeUrl));
    assert.ok(email.html.includes("border-radius:999px"));
    assert.ok(/\p{Extended_Pictographic}/u.test(email.subject));
  }
  assert.equal(emails[1].subject, "❤️ Son 2 kalp kaldı! Arkadaşını çağır");
});

test("bonus beklemedeyse davet e-postasi ilk kalbi anlatir", () => {
  const email = inviteJoinedEmail(common, { productName: null, imageUrl: null, bonus: 2, points: null, threshold: null, waitingDays: 30, barUrl: "https://b", catalogUrl: "https://c", kalplerimUrl: "https://k" });
  assert.ok(email.html.includes("Kalp vermeye başla"));
  assert.ok(email.html.includes("30 gün"));
});

test("urun adi HTML'de kacirilir", () => {
  const email = barNearEmail(common, { productName: "<b>x</b>", imageUrl: null, points: 8, threshold: 10, left: 2, discountPercent: 50, inviteBonus: 2, whatsappUrl: "https://w", kalplerimUrl: "https://k" });
  assert.ok(!email.html.includes("<b>x</b>"));
});
