import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { checkWebhookSignature, webhookSchema } from "./webhook";

const SECRET = "sandbox-test-secret";

const body = {
  iyziEventType: "CHECKOUT_FORM_AUTH",
  iyziEventTime: 1_700_000_000_000,
  iyziReferenceCode: "ref-1",
  iyziPaymentId: 123456,
  paymentConversationId: "conv-1",
  token: "tok-1",
  status: "SUCCESS",
  merchantId: 1
};

// Dokumandaki V3 formulunden bagimsiz, elle hesaplanan beklenen imza.
const sign = (payload: typeof body, secret = SECRET) =>
  createHmac("sha256", secret)
    .update(`${secret}${payload.iyziEventType}${payload.iyziPaymentId}${payload.token}${payload.paymentConversationId}${payload.status}`)
    .digest("hex");

test("govde: sayi ve metin alanlari kabul edilir, id'ler metne cevrilir", () => {
  const parsed = webhookSchema.parse(body);
  assert.equal(parsed.iyziPaymentId, "123456");
  assert.equal(parsed.token, "tok-1");
});

test("govde: olay turu yoksa veya JSON degilse reddedilir", () => {
  assert.equal(webhookSchema.safeParse({ token: "x" }).success, false);
  assert.equal(webhookSchema.safeParse("metin").success, false);
  assert.equal(webhookSchema.safeParse(null).success, false);
});

test("govde: token/paymentId olmayan diger olaylar da gecerli govdedir", () => {
  const parsed = webhookSchema.safeParse({ iyziEventType: "BANK_TRANSFER_AUTH" });
  assert.equal(parsed.success, true);
  if (parsed.success) assert.equal(parsed.data.token, "");
});

test("imza: dogru imza valid", () => {
  const payload = webhookSchema.parse(body);
  assert.equal(checkWebhookSignature(payload, SECRET, sign(body)), "valid");
  // Bosluklu baslik degeri de kabul edilir
  assert.equal(checkWebhookSignature(payload, SECRET, `  ${sign(body)} `), "valid");
});

test("imza: yanlis secret veya degistirilmis govde invalid", () => {
  const payload = webhookSchema.parse(body);
  assert.equal(checkWebhookSignature(payload, SECRET, sign(body, "baska-secret")), "invalid");
  assert.equal(checkWebhookSignature(webhookSchema.parse({ ...body, status: "FAILURE" }), SECRET, sign(body)), "invalid");
  assert.equal(checkWebhookSignature(payload, SECRET, "abc"), "invalid");
});

test("imza: baslik yoksa veya bossa missing (islem yine sunucu sorgusuyla dogrulanir)", () => {
  const payload = webhookSchema.parse(body);
  assert.equal(checkWebhookSignature(payload, SECRET, null), "missing");
  assert.equal(checkWebhookSignature(payload, SECRET, ""), "missing");
  assert.equal(checkWebhookSignature(payload, SECRET, "   "), "missing");
});
