import { test } from "node:test";
import assert from "node:assert/strict";
import { hmacSha256Hex } from "@/lib/payment/iyzico/signature";
import { trimTrailingZeros } from "@/lib/payment/iyzico/money";
import { evaluateRetrieve, isFailureFinal, TOKEN_DEAD_AFTER_MS, type RetrieveResponse } from "./evaluate";

const SECRET = "sandbox-secret-test";
const attempt = { id: "att-1", token: "tok-1" };
const order = { orderNumber: "BLM260920-1234", totalCents: 105050 };

function signedResponse(overrides: Partial<RetrieveResponse> = {}): RetrieveResponse {
  const res: RetrieveResponse = {
    status: "success",
    paymentStatus: "SUCCESS",
    paymentId: "999",
    price: 1050.5,
    paidPrice: 1050.5,
    currency: "TRY",
    basketId: order.orderNumber,
    conversationId: attempt.id,
    token: attempt.token,
    installment: 1,
    fraudStatus: 1,
    cardAssociation: "VISA",
    lastFourDigits: "0000",
    itemTransactions: [{ itemId: "i1", paymentTransactionId: "t1", paidPrice: 1050.5 }],
    ...overrides
  };
  const data = [
    res.paymentStatus,
    res.paymentId,
    res.currency,
    res.basketId,
    res.conversationId,
    trimTrailingZeros(res.paidPrice as string | number),
    trimTrailingZeros(res.price as string | number),
    res.token
  ].join(":");
  return { ...res, signature: hmacSha256Hex(data, SECRET) };
}

// signedResponse imzayı DOĞRU hesaplar: alanı override edince imza yeniden üretilir, böylece
// yalnızca ilgili doğrulama kuralı (tutar, token, basketId...) test edilir.
function evaluate(res: RetrieveResponse, o = order) {
  return evaluateRetrieve({ res, attempt, order: o, secretKey: SECRET });
}

test("her şey doğruysa PAID", () => {
  const result = evaluate(signedResponse());
  assert.equal(result.outcome, "PAID");
  if (result.outcome === "PAID") {
    assert.equal(result.details.paidCents, 105050);
    assert.equal(result.details.paymentId, "999");
    assert.equal(result.details.installment, 1);
    assert.equal(result.details.itemTransactions.length, 1);
  }
});

test("taksitte paidPrice > price ise PAID ve paidCents gerçek ödenen", () => {
  const result = evaluate(signedResponse({ paidPrice: 1100.75, installment: 3 }));
  assert.equal(result.outcome, "PAID");
  if (result.outcome === "PAID") {
    assert.equal(result.details.paidCents, 110075);
    assert.equal(result.details.installment, 3);
  }
});

test("bozulmuş imza REDDEDİLİR (PAID değil)", () => {
  const res = signedResponse();
  const result = evaluate({ ...res, signature: "0".repeat(64) });
  assert.equal(result.outcome, "INVALID");
  if (result.outcome === "INVALID") assert.match(result.reason, /imza/);
});

test("imza yoksa REDDEDİLİR", () => {
  const { signature: _signature, ...rest } = signedResponse();
  void _signature;
  assert.equal(evaluate(rest).outcome, "INVALID");
});

test("tutar uyuşmazlığı (DB total ≠ iyzico price) REDDEDİLİR, imza doğru olsa bile", () => {
  const result = evaluate(signedResponse({ price: 10, paidPrice: 10 }));
  assert.equal(result.outcome, "INVALID");
  if (result.outcome === "INVALID") assert.match(result.reason, /tutar uyuşmuyor/);
});

test("paidPrice < price REDDEDİLİR", () => {
  const result = evaluate(signedResponse({ paidPrice: 1000 }));
  assert.equal(result.outcome, "INVALID");
});

test("başka siparişin ödemesi (basketId), başka token/conversationId, TRY dışı para birimi REDDEDİLİR", () => {
  assert.equal(evaluate(signedResponse({ basketId: "BLM260920-9999" })).outcome, "INVALID");
  assert.equal(evaluate(signedResponse({ token: "baska" })).outcome, "INVALID");
  assert.equal(evaluate(signedResponse({ conversationId: "baska" })).outcome, "INVALID");
  assert.equal(evaluate(signedResponse({ currency: "USD" })).outcome, "INVALID");
});

test("fraudStatus 0 -> REVIEW, -1 -> FAILED, 1 -> PAID, gelmezse PAID", () => {
  assert.equal(evaluate(signedResponse({ fraudStatus: 0 })).outcome, "REVIEW");
  assert.equal(evaluate(signedResponse({ fraudStatus: -1 })).outcome, "FAILED");
  assert.equal(evaluate(signedResponse({ fraudStatus: 1 })).outcome, "PAID");
  assert.equal(evaluate(signedResponse({ fraudStatus: undefined })).outcome, "PAID");
});

test("paymentStatus FAILURE -> FAILED (hata kodu taşınır)", () => {
  const result = evaluate({ status: "success", paymentStatus: "FAILURE", errorCode: "10051", errorMessage: "Not enough funds" });
  assert.deepEqual(result, { outcome: "FAILED", errorCode: "10051", errorMessage: "Not enough funds" });
});

test("paymentStatus başka bir ara durumsa PENDING (durum değişmez)", () => {
  assert.equal(evaluate({ status: "success", paymentStatus: "INIT_THREEDS" }).outcome, "PENDING");
  assert.equal(evaluate({ status: "success" }).outcome, "PENDING");
});

test("API düzeyinde hata (status failure) -> ERROR, PAID/FAILED değil", () => {
  const result = evaluate({ status: "failure", errorCode: "1001", errorMessage: "x" });
  assert.equal(result.outcome, "ERROR");
});

test("paymentId yoksa REDDEDİLİR", () => {
  assert.equal(evaluate(signedResponse({ paymentId: undefined })).outcome, "INVALID");
});

test("FAILURE yalnızca callback/webhook'ta veya token ömrü dolunca kesin sayılır (3DS sürerken FAILED yazılmaz)", () => {
  const young = 60 * 1000;
  assert.equal(isFailureFinal("callback", young), true);
  assert.equal(isFailureFinal("webhook", young), true);
  assert.equal(isFailureFinal("poll", young), false);
  assert.equal(isFailureFinal("cron", young), false);
  assert.equal(isFailureFinal("admin", young), false);
  assert.equal(isFailureFinal("cron", TOKEN_DEAD_AFTER_MS + 1), true);
  assert.equal(isFailureFinal("poll", TOKEN_DEAD_AFTER_MS + 1), true);
});
