import { test } from "node:test";
import assert from "node:assert/strict";
import { barMessage } from "./messages";

const base = { threshold: 10, discountPercent: 50, inviteBonus: 2, couponHours: 48, wonCoupon: false, recentlyClosed: false };

test("bar mesajlari plan metinleriyle", () => {
  assert.equal(barMessage({ ...base, points: 0 }), "İlk kalbi sen ver, %50'nin kilidini birlikte açalım");
  assert.equal(barMessage({ ...base, points: 6 }), "6/10 kalp · 4 kalp kaldı");
  assert.equal(barMessage({ ...base, points: 7 }), "7/10 kalp · 3 kalp kaldı");
  assert.equal(barMessage({ ...base, points: 8 }), "Son 2 kalp! Arkadaşını çağır, barına +2 eklesin");
  assert.equal(barMessage({ ...base, points: 9 }), "Son 1 kalp! Arkadaşını çağır, barına +2 eklesin");
});

test("tur dolunca katilimci ve katilimci olmayan", () => {
  assert.equal(barMessage({ ...base, points: 0, wonCoupon: true, recentlyClosed: true }), "Kilit açıldı! Kuponun hesabında, 48 saat");
  assert.equal(barMessage({ ...base, points: 0, recentlyClosed: true }), "Bu tur doldu, yeni tur başladı");
  // Yeni turda kalp gelince normal mesaja doner.
  assert.equal(barMessage({ ...base, points: 1, wonCoupon: true }), "1/10 kalp · 9 kalp kaldı");
});

test("test esigi 2 ile turun kendi esigi kullanilir", () => {
  assert.equal(barMessage({ ...base, threshold: 2, points: 1 }), "Son 1 kalp! Arkadaşını çağır, barına +2 eklesin");
});
