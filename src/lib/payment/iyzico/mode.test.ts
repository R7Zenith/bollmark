import { test } from "node:test";
import assert from "node:assert/strict";
import { localPaymentTestFrom, resolveModeFrom } from "./mode";
import { describeAdminError, describePaymentError } from "./errors";

test("LIVE yalnızca production ortamında LIVE olur", () => {
  assert.equal(resolveModeFrom("LIVE", "production"), "LIVE");
});

test("preview, development ve yerel (tanımsız) ortamda LIVE zorla SANDBOX'a düşer", () => {
  assert.equal(resolveModeFrom("LIVE", "preview"), "SANDBOX");
  assert.equal(resolveModeFrom("LIVE", "development"), "SANDBOX");
  assert.equal(resolveModeFrom("LIVE", undefined), "SANDBOX");
});

test("SANDBOX ve bilinmeyen/boş değerler her ortamda SANDBOX", () => {
  assert.equal(resolveModeFrom("SANDBOX", "production"), "SANDBOX");
  assert.equal(resolveModeFrom(null, "production"), "SANDBOX");
  assert.equal(resolveModeFrom(undefined, "production"), "SANDBOX");
  assert.equal(resolveModeFrom("live", "production"), "SANDBOX");
  assert.equal(resolveModeFrom("", "production"), "SANDBOX");
});

const localEnv = {
  PAYMENT_LOCAL_TEST: "1",
  NODE_ENV: "development",
  IYZICO_SANDBOX_API_KEY: "k",
  IYZICO_SANDBOX_SECRET_KEY: "s",
  IYZICO_SANDBOX_BASE_URL: "https://sandbox-api.iyzipay.com/"
};

test("yerel ödeme testi: yalnız yerel ortamda ve tam ayarla etkin, anahtar .env'den", () => {
  assert.deepEqual(localPaymentTestFrom(localEnv), { apiKey: "k", secretKey: "s", baseUrl: "https://sandbox-api.iyzipay.com" });
  assert.equal(localPaymentTestFrom({ ...localEnv, PAYMENT_LOCAL_TEST: undefined }), null);
  assert.equal(localPaymentTestFrom({ ...localEnv, PAYMENT_LOCAL_TEST: "true" }), null);
});

test("yerel ödeme testi: Vercel'de ve production derlemede değişken eklense bile etkisiz", () => {
  assert.equal(localPaymentTestFrom({ ...localEnv, VERCEL: "1" }), null);
  assert.equal(localPaymentTestFrom({ ...localEnv, VERCEL: "" }), null);
  assert.equal(localPaymentTestFrom({ ...localEnv, NODE_ENV: "production" }), null);
});

test("yerel ödeme testi: anahtar eksikse ya da adres sandbox değilse kapalı", () => {
  assert.equal(localPaymentTestFrom({ ...localEnv, IYZICO_SANDBOX_SECRET_KEY: "" }), null);
  assert.equal(localPaymentTestFrom({ ...localEnv, IYZICO_SANDBOX_BASE_URL: "https://api.iyzipay.com" }), null);
  assert.equal(localPaymentTestFrom({ ...localEnv, IYZICO_SANDBOX_BASE_URL: undefined }), null);
});

test("bilinen iyzico hata kodları Türkçe mesaja çevrilir", () => {
  assert.match(describePaymentError("10051"), /limit|bakiye/i);
  assert.match(describePaymentError(10084), /CVC/);
  assert.match(describePaymentError("10054"), /son kullanma/);
});

test("bilinmeyen kod ve kayıp/çalıntı kart genel mesaj verir, ham metin sızmaz", () => {
  const generic = describePaymentError(undefined);
  assert.equal(describePaymentError("99999"), generic);
  assert.equal(describePaymentError("10041"), generic);
  assert.equal(describePaymentError("10043"), generic);
});

test("admin bağlantı testi 1000/1001 için anahtarların geçersiz olduğunu söyler", () => {
  assert.match(describeAdminError("1000"), /Anahtarlar geçersiz/);
  assert.match(describeAdminError("1001"), /Anahtarlar geçersiz/);
  assert.match(describeAdminError("5555", "bir şey oldu"), /5555.*bir şey oldu/);
});
