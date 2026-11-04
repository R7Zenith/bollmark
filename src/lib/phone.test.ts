import { test } from "node:test";
import assert from "node:assert/strict";
import { formatTrMobile, normalizeTrMobile } from "./phone";

test("kabul edilen yazimlar E.164'e cevrilir", () => {
  for (const input of [
    "0532 123 45 67",
    "532 123 45 67",
    "+90 532 123 45 67",
    "905321234567",
    "05321234567",
    "(0532) 123-45-67",
    "+90-532-123-4567"
  ]) {
    assert.equal(normalizeTrMobile(input), "+905321234567", input);
  }
});

test("5 ile baslamayan ya da 10 haneye inmeyen numara reddedilir", () => {
  for (const input of ["", "0212 123 45 67", "532 123 45 6", "0532 123 45 678", "+1 532 123 45 67", "0532-abc-45-67", "9005321234567"]) {
    assert.equal(normalizeTrMobile(input), null, input);
  }
});

test("gosterim bicimi", () => {
  assert.equal(formatTrMobile("+905321234567"), "0532 123 45 67");
  assert.equal(formatTrMobile("5321234567"), "0532 123 45 67");
  assert.equal(formatTrMobile("12345"), "12345");
});
