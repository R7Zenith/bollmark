import { test } from "node:test";
import assert from "node:assert/strict";
import { isDisposableEmailDomain } from "disposable-email-domains-js";
import { domainSuffixes } from "./email-domain-check";

test("alan adı ekleri alt alan adlarından üst alan adına doğru üretilir", () => {
  assert.deepEqual(domainSuffixes("Ali@A.B.Ornek.com "), ["a.b.ornek.com", "b.ornek.com", "ornek.com"]);
  assert.deepEqual(domainSuffixes("ali@ornek.com"), ["ornek.com"]);
  assert.deepEqual(domainSuffixes("bozuk"), []);
});

test("paket bilinen geçici alan adını yakalar, yaygın sağlayıcıyı yakalamaz", () => {
  assert.equal(isDisposableEmailDomain("mailinator.com"), true);
  assert.equal(isDisposableEmailDomain("gmail.com"), false);
  assert.equal(isDisposableEmailDomain("hotmail.com"), false);
});
