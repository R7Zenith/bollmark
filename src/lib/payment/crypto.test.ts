import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { decryptSecret, encryptSecret, isEncryptionKeyConfigured } from "./crypto";

const KEY = randomBytes(32).toString("base64");
const OTHER_KEY = randomBytes(32).toString("base64");

test("şifrele → çöz gidiş-dönüş aynı metni verir", () => {
  const secret = "sandbox-AbC123xyz/+=çğ";
  assert.equal(decryptSecret(encryptSecret(secret, KEY), KEY), secret);
});

test("aynı metin her seferinde farklı şifreli çıktı üretir (rastgele IV)", () => {
  assert.notEqual(encryptSecret("x", KEY), encryptSecret("x", KEY));
});

test("bozulmuş şifreli veri reddedilir", () => {
  const payload = Buffer.from(encryptSecret("gizli", KEY), "base64");
  payload[payload.length - 1] ^= 0xff;
  assert.throws(() => decryptSecret(payload.toString("base64"), KEY));
});

test("bozulmuş kimlik doğrulama etiketi (tag) reddedilir", () => {
  const payload = Buffer.from(encryptSecret("gizli", KEY), "base64");
  payload[12] ^= 0xff;
  assert.throws(() => decryptSecret(payload.toString("base64"), KEY));
});

test("yanlış anahtar reddedilir", () => {
  assert.throws(() => decryptSecret(encryptSecret("gizli", KEY), OTHER_KEY));
});

test("çok kısa/geçersiz veri reddedilir", () => {
  assert.throws(() => decryptSecret("AAAA", KEY));
});

test("anahtar yoksa veya uzunluğu yanlışsa açık hata verir", () => {
  assert.throws(() => encryptSecret("x", ""), /tanımlı değil/);
  assert.throws(() => encryptSecret("x", undefined), /tanımlı değil/);
  assert.throws(() => encryptSecret("x", randomBytes(16).toString("base64")), /32 bayt/);
});

test("isEncryptionKeyConfigured yalnızca geçerli anahtarda true döner", () => {
  assert.equal(isEncryptionKeyConfigured(KEY), true);
  assert.equal(isEncryptionKeyConfigured(""), false);
  assert.equal(isEncryptionKeyConfigured(randomBytes(8).toString("base64")), false);
});
