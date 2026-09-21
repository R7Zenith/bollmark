import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canCancelPayment,
  checkRefundAmount,
  nextRefundState,
  parseTlToCents,
  remainingCents,
  type RefundLine
} from "./refund-math";

const line = (overrides: Partial<RefundLine> = {}): RefundLine => ({
  key: "item-1",
  label: "Ürün",
  paymentTransactionId: "tx-1",
  paidCents: 10_000,
  refundedCents: 0,
  pendingCents: 0,
  ...overrides
});

test("kalan tutar: odenen - iade - bekleyen, asla negatif olmaz", () => {
  assert.equal(remainingCents(line()), 10_000);
  assert.equal(remainingCents(line({ refundedCents: 2_500, pendingCents: 1_000 })), 6_500);
  assert.equal(remainingCents(line({ refundedCents: 10_000, pendingCents: 500 })), 0);
});

test("tutar kontrolu: bos girdi kalanin tamamini iade eder", () => {
  assert.deepEqual(checkRefundAmount(line({ refundedCents: 4_000 }), null), { ok: true, amountCents: 6_000 });
});

test("tutar kontrolu: kismi tutar kabul, fazla tutar red", () => {
  assert.deepEqual(checkRefundAmount(line(), 3_333), { ok: true, amountCents: 3_333 });
  assert.deepEqual(checkRefundAmount(line(), 10_001), { ok: false, reason: "exceeds" });
  assert.deepEqual(checkRefundAmount(line({ pendingCents: 9_000 }), 1_001), { ok: false, reason: "exceeds" });
});

test("tutar kontrolu: sifir, negatif, kesirli tutar gecersiz", () => {
  for (const bad of [0, -1, 1.5, Number.NaN]) {
    assert.deepEqual(checkRefundAmount(line(), bad), { ok: false, reason: "invalid" });
  }
});

test("tutar kontrolu: islem numarasi yoksa veya kalan yoksa red", () => {
  assert.deepEqual(checkRefundAmount(line({ paymentTransactionId: null }), 100), { ok: false, reason: "no-transaction" });
  assert.deepEqual(checkRefundAmount(line({ refundedCents: 10_000 }), 100), { ok: false, reason: "nothing-left" });
  assert.deepEqual(checkRefundAmount(line({ pendingCents: 10_000 }), null), { ok: false, reason: "nothing-left" });
});

test("ardisik kismi iadeler toplamda odenen tutari asamaz", () => {
  let current = line();
  for (const amount of [4_000, 4_000, 2_000]) {
    const check = checkRefundAmount(current, amount);
    assert.equal(check.ok, true);
    current = { ...current, refundedCents: current.refundedCents + amount };
  }
  assert.deepEqual(checkRefundAmount(current, 1), { ok: false, reason: "nothing-left" });
});

test("TL girdisi kurusa cevrilir", () => {
  assert.equal(parseTlToCents("123,45"), 12_345);
  assert.equal(parseTlToCents("123.45"), 12_345);
  assert.equal(parseTlToCents("1.234,50"), 123_450);
  assert.equal(parseTlToCents("100"), 10_000);
  assert.equal(parseTlToCents("0,5"), 50);
  assert.equal(parseTlToCents(" 12 "), 1_200);
});

test("TL girdisi: gecersiz bicimler null doner (sessiz yuvarlama yok)", () => {
  for (const bad of ["", "abc", "1,234", "12,345", "-5", "1e3", "12,3,4"]) {
    assert.equal(parseTlToCents(bad), null, bad);
  }
});

test("siparis odeme durumu: iade yok / kismi / tam", () => {
  assert.deepEqual(nextRefundState([line(), line({ key: "b" })]), { paymentStatus: "PAID", fullyRefunded: false });
  assert.deepEqual(nextRefundState([line({ refundedCents: 100 }), line({ key: "b" })]), {
    paymentStatus: "PARTIALLY_REFUNDED",
    fullyRefunded: false
  });
  assert.deepEqual(nextRefundState([line({ refundedCents: 10_000 }), line({ key: "b", paidCents: 500, refundedCents: 500 })]), {
    paymentStatus: "REFUNDED",
    fullyRefunded: true
  });
});

test("siparis odeme durumu: bir kalem tam iade digeri hic iade degilse kismi", () => {
  assert.equal(nextRefundState([line({ refundedCents: 10_000 }), line({ key: "b" })]).paymentStatus, "PARTIALLY_REFUNDED");
});

test("siparis odeme durumu: odenen tutari 0 olan kalem tam iade sartini engellemez", () => {
  const state = nextRefundState([line({ refundedCents: 10_000 }), line({ key: "shipping", paidCents: 0 })]);
  assert.equal(state.paymentStatus, "REFUNDED");
});

test("iptal: yalnizca odenmis ve hic iade/bekleyen iade yokken", () => {
  assert.equal(canCancelPayment({ paymentStatus: "PAID", refundedTotalCents: 0, pendingTotalCents: 0 }), true);
  assert.equal(canCancelPayment({ paymentStatus: "PAID", refundedTotalCents: 100, pendingTotalCents: 0 }), false);
  assert.equal(canCancelPayment({ paymentStatus: "PAID", refundedTotalCents: 0, pendingTotalCents: 100 }), false);
  assert.equal(canCancelPayment({ paymentStatus: "PARTIALLY_REFUNDED", refundedTotalCents: 0, pendingTotalCents: 0 }), false);
  assert.equal(canCancelPayment({ paymentStatus: "REFUNDED", refundedTotalCents: 0, pendingTotalCents: 0 }), false);
});
