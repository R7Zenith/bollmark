import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildAuthHeaders,
  hmacSha256Hex,
  safeEqualHex,
  verifyInitializeSignature,
  verifyRetrieveSignature,
  verifyWebhookSignatureV3
} from "./signature";

// Bu vektörler kodun dışında, doğrudan node:crypto ile dokümandaki formüller
// uygulanarak üretildi (bkz. IYZICO_SANAL_POS_PLANI.md 1.2, 1.4, 1.5).
const SECRET = "sandbox-secret-test";

test("HMAC-SHA256 hex bilinen vektörle eşleşir (openssl ile doğrulandı)", () => {
  assert.equal(hmacSha256Hex("abc", "k"), "342e519ce0ad6c03a36b98eeb3f1d130db4813b9df4d1160eda488d712dc78ee");
});

test("IYZWSv2 Authorization başlığı doğru kurulur", () => {
  const body = JSON.stringify({ locale: "tr", conversationId: "c1" });
  const headers = buildAuthHeaders({
    apiKey: "sandbox-api",
    secretKey: SECRET,
    uriPath: "/payment/bin/check",
    body,
    randomKey: "1700000000000abc"
  });
  const expectedSignature = "ab065e41ce6b3c4e20846b8b8056081388702af80907dce2d7cd3e01419e7e0d";
  const authString = `apiKey:sandbox-api&randomKey:1700000000000abc&signature:${expectedSignature}`;
  assert.equal(headers.Authorization, `IYZWSv2 ${Buffer.from(authString).toString("base64")}`);
  assert.equal(headers["x-iyzi-rnd"], "1700000000000abc");
  assert.equal(headers["Content-Type"], "application/json");
});

test("farklı gövde farklı imza üretir", () => {
  const base = { apiKey: "k", secretKey: SECRET, uriPath: "/x", randomKey: "r" };
  assert.notEqual(buildAuthHeaders({ ...base, body: "{}" }).Authorization, buildAuthHeaders({ ...base, body: '{"a":1}' }).Authorization);
});

test("başlatma yanıt imzası doğrulanır", () => {
  const sig = "38dde195811954ad4e915a1cd82017d16ea0354ed16d179427da8abe093d3717";
  assert.equal(verifyInitializeSignature({ conversationId: "conv-1", token: "tok-abc", signature: sig }, SECRET), true);
});

test("başlatma yanıt imzası değiştirilmiş alanı, yanlış secret'ı ve eksik imzayı reddeder", () => {
  const sig = "38dde195811954ad4e915a1cd82017d16ea0354ed16d179427da8abe093d3717";
  assert.equal(verifyInitializeSignature({ conversationId: "conv-1", token: "tok-XYZ", signature: sig }, SECRET), false);
  assert.equal(verifyInitializeSignature({ conversationId: "conv-1", token: "tok-abc", signature: sig }, "baska-secret"), false);
  assert.equal(verifyInitializeSignature({ conversationId: "conv-1", token: "tok-abc" }, SECRET), false);
  assert.equal(verifyInitializeSignature({ conversationId: "conv-1", token: "tok-abc", signature: "" }, SECRET), false);
});

test("sorgulama yanıt imzası fiyatların sondaki sıfırları atılarak doğrulanır", () => {
  const sig = "278728241ae158aafbc4c0ba73aa05f3a323230ba90682b52bb45f2469180dcb";
  const base = {
    paymentStatus: "SUCCESS",
    paymentId: "12345",
    currency: "TRY",
    basketId: "BM-1",
    conversationId: "conv-1",
    token: "tok-abc",
    signature: sig
  };
  // iyzico fiyatları sayı, "105.50" metni veya "100.00" olarak döndürse de aynı imza çıkmalı
  assert.equal(verifyRetrieveSignature({ ...base, paidPrice: 105.5, price: 100 }, SECRET), true);
  assert.equal(verifyRetrieveSignature({ ...base, paidPrice: "105.50", price: "100.00" }, SECRET), true);
  assert.equal(verifyRetrieveSignature({ ...base, paidPrice: "105.5", price: "100" }, SECRET), true);
});

test("sorgulama yanıt imzası tutar değişikliğini reddeder", () => {
  const sig = "278728241ae158aafbc4c0ba73aa05f3a323230ba90682b52bb45f2469180dcb";
  const tampered = {
    paymentStatus: "SUCCESS",
    paymentId: "12345",
    currency: "TRY",
    basketId: "BM-1",
    conversationId: "conv-1",
    paidPrice: 1,
    price: 1,
    token: "tok-abc",
    signature: sig
  };
  assert.equal(verifyRetrieveSignature(tampered, SECRET), false);
  assert.equal(verifyRetrieveSignature({ ...tampered, paidPrice: 105.5, price: 100, signature: "00" }, SECRET), false);
});

test("webhook V3 imzası doğrulanır; bozulmuş imza ve alan reddedilir", () => {
  const payload = {
    iyziEventType: "CHECKOUT_FORM_AUTH",
    iyziPaymentId: 999,
    token: "tok-abc",
    paymentConversationId: "conv-1",
    status: "SUCCESS"
  };
  const sig = "c9ce953548f657e71c7fe95159a603acbc3c5aeebdc278868ea38e71cabfc89d";
  assert.equal(verifyWebhookSignatureV3(payload, SECRET, sig), true);
  assert.equal(verifyWebhookSignatureV3(payload, SECRET, `${sig.slice(0, -1)}0`), false);
  assert.equal(verifyWebhookSignatureV3({ ...payload, status: "FAILURE" }, SECRET, sig), false);
  assert.equal(verifyWebhookSignatureV3(payload, "baska-secret", sig), false);
});

test("safeEqualHex farklı uzunlukta hata firlatmadan false döner", () => {
  assert.equal(safeEqualHex("abc", "abcd"), false);
  assert.equal(safeEqualHex("abc", "abc"), true);
  assert.equal(safeEqualHex("", ""), true);
});
