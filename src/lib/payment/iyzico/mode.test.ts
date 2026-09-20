import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveModeFrom } from "./mode";
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
