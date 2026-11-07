import { test } from "node:test";
import assert from "node:assert/strict";
import {
  exampleBase,
  friendScenarios,
  pickVerificationTemplate,
  verificationKalpEmail,
  verificationPlainEmail,
  verificationSignupEmail
} from "./verification-emails";

const common = { siteUrl: "https://bollmark.com", firstName: "Ayşe", verifyUrl: "https://bollmark.com/hesap/dogrula?token=x", tokenHours: 24 };

test("dogrulama sablonu: kampanya kapaliyken iki amac icin de sade", () => {
  assert.equal(pickVerificationTemplate(false, "KAYIT"), "SADE");
  assert.equal(pickVerificationTemplate(false, "KALP"), "SADE");
});

test("dogrulama sablonu: kampanya acikken kalp verince 14, uyelikte 15", () => {
  assert.equal(pickVerificationTemplate(true, "KALP"), "KALP_KAMPANYA");
  assert.equal(pickVerificationTemplate(true, "KAYIT"), "UYELIK_KAMPANYA");
});

test("arkadas senaryosu: 3 kalp + senin kalbin, esik 10, +2 -> 4/6/8/kilit", () => {
  const rows = friendScenarios(4, 10, 2);
  assert.deepEqual(
    rows.map((r) => [r.friends, r.bonus, r.total, r.unlocked]),
    [
      [0, 0, 4, false],
      [1, 2, 6, false],
      [2, 4, 8, false],
      [3, 6, 10, true]
    ]
  );
});

test("arkadas senaryosu: kilit acilinca durur", () => {
  assert.deepEqual(
    friendScenarios(7, 10, 2).map((r) => r.total),
    [7, 9, 11]
  );
  assert.equal(friendScenarios(10, 10, 2).length, 1);
  assert.equal(friendScenarios(10, 10, 2)[0].unlocked, true);
});

test("arkadas senaryosu: en fazla 4 satir, bonus yoksa tek satir", () => {
  const rows = friendScenarios(1, 20, 2);
  assert.equal(rows.length, 4);
  assert.equal(rows[3].unlocked, false);
  assert.equal(friendScenarios(1, 10, 0).length, 1);
});

test("uyelik ornek senaryosu ayarlardan: kilit 3 arkadasla acilir", () => {
  assert.equal(exampleBase(10, 2), 4);
  assert.equal(exampleBase(2, 2), 1);
  assert.equal(exampleBase(30, 3), 21);
  const rows = friendScenarios(exampleBase(12, 3), 12, 3);
  assert.equal(rows.length, 4);
  assert.equal(rows[3].unlocked, true);
});

test("sayilar ayarlardan gelir, elle yazilmaz", () => {
  const numbers = { threshold: 8, discountPercent: 40, couponHours: 36, inviteBonus: 3 };
  const product = { name: "Kaban <b>", imageUrl: "https://img.bollmark.com/a.jpg", url: "https://bollmark.com/urunler/kaban", points: 2, threshold: 8 };
  const kalp = verificationKalpEmail(common, numbers, product);
  assert.match(kalp.html, /Bar 8 kalbe ulaşınca %40 indirim/);
  assert.match(kalp.html, /\+3 kalp/);
  assert.match(kalp.html, /36 saat içinde kullan/);
  assert.match(kalp.html, /Kaban &lt;b&gt;/);
  assert.doesNotMatch(kalp.html, /%50|10 kalbe|48 saat/);
  assert.match(kalp.html, /❤️❤️🩷🤍/);

  const signup = verificationSignupEmail(common, numbers, [product]);
  assert.match(signup.subject, /Kalp Topla başladı/);
  assert.match(signup.html, /%40 indirim/);
  assert.doesNotMatch(signup.html, /%50|48 saat/);
});

test("14: urun bulunamazsa kart gizlenir, e-posta yine olusur", () => {
  const email = verificationKalpEmail(common, { threshold: 10, discountPercent: 50, couponHours: 48, inviteBonus: 2 }, null);
  assert.doesNotMatch(email.html, /KALP VERDİĞİN ÜRÜN/);
  assert.match(email.html, /E-postamı doğrula, kalbim sayılsın/);
});

test("06 sade: kampanyadan bahsetmez, duz metin surumu var", () => {
  const email = verificationPlainEmail(common);
  assert.doesNotMatch(email.html, /Kalp Topla|kalp/i);
  assert.match(email.text, /hesap\/dogrula\?token=x/);
  assert.doesNotMatch(email.html, /localhost/);
});

test("maile yalniz canli Bollmark gorselleri girer, localhost girmez", async () => {
  const { emailImageUrl } = await import("./layout");
  assert.equal(emailImageUrl("http://localhost:3000/uploads/a.jpg"), null);
  assert.equal(emailImageUrl("https://evil.example/a.jpg"), null);
  assert.equal(emailImageUrl("http://img.bollmark.com/a.jpg"), null);
  assert.equal(emailImageUrl("https://img.bollmark.com/a.jpg"), "https://img.bollmark.com/a.jpg");
  assert.equal(emailImageUrl("/logo.png"), "https://bollmark.com/logo.png");
  assert.equal(emailImageUrl(null), null);
});
