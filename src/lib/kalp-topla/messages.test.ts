import { test } from "node:test";
import assert from "node:assert/strict";
import { barMessage, campaignPitch, campaignSlogan, campaignStripText } from "./messages";

const base = { threshold: 10, discountPercent: 50, inviteBonus: 2, couponHours: 48, wonCoupon: false, recentlyClosed: false };

test("bar mesajlari plan metinleriyle", () => {
  assert.equal(barMessage({ ...base, points: 0 }), "İlk kalbi sen ver, %50'nin kilidini birlikte açalım");
  assert.equal(barMessage({ ...base, points: 6 }), "6/10 kalp · 4 kalp kaldı");
  assert.equal(barMessage({ ...base, points: 7 }), "7/10 kalp · 3 kalp kaldı");
  assert.equal(barMessage({ ...base, points: 8 }), "Son 2 kalp! İstersen arkadaşını çağır, +2 eklesin");
  assert.equal(barMessage({ ...base, points: 9 }), "Son 1 kalp! İstersen arkadaşını çağır, +2 eklesin");
});

test("vitrin metinleri ayarlara uyar", () => {
  assert.equal(campaignSlogan(10, 50), "10 kalp, yarı fiyat");
  assert.equal(campaignSlogan(8, 40), "8 kalp, %40 indirim");
  assert.equal(campaignPitch(10, 50), "Beğendiğin ürüne kalp ver, 10 kalp dolunca kalp verenler yarı fiyatına alsın.");
  assert.equal(campaignPitch(8, 40), "Beğendiğin ürüne kalp ver, 8 kalp dolunca kalp verenler %40 indirimle alsın.");
});

test("serit metni kisa ve uzun", () => {
  assert.deepEqual(campaignStripText(10, 50), {
    short: "Kalp ver, 10 kalp dolunca yarı fiyatına al",
    long: "Beğendiğin ürüne kalp ver, 10 kalp dolunca yarı fiyatına al."
  });
  assert.equal(campaignStripText(8, 40).short, "Kalp ver, 8 kalp dolunca %40 indirimle al");
});

test("tur dolunca katilimci ve katilimci olmayan", () => {
  assert.equal(barMessage({ ...base, points: 0, wonCoupon: true, recentlyClosed: true }), "Kilit açıldı! Kuponun hesabında, 48 saat");
  assert.equal(barMessage({ ...base, points: 0, recentlyClosed: true }), "Bu tur doldu, yeni tur başladı");
  // Yeni turda kalp gelince normal mesaja doner.
  assert.equal(barMessage({ ...base, points: 1, wonCoupon: true }), "1/10 kalp · 9 kalp kaldı");
});

test("test esigi 2 ile turun kendi esigi kullanilir", () => {
  assert.equal(barMessage({ ...base, threshold: 2, points: 1 }), "Son 1 kalp! İstersen arkadaşını çağır, +2 eklesin");
});
