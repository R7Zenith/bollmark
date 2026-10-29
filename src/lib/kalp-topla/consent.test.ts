import { test } from "node:test";
import assert from "node:assert/strict";
import { consentGroupsToPurge, createUnsubscribeToken, verifyUnsubscribeToken } from "./consent";

const SECRET = "test-gizli";

test("abonelik token'ı doğrulanınca müşteri id'sini verir", () => {
  const token = createUnsubscribeToken("cus_123", SECRET);
  assert.equal(verifyUnsubscribeToken(token, SECRET), "cus_123");
});

test("değiştirilmiş ya da başka anahtarla imzalı token reddedilir", () => {
  const token = createUnsubscribeToken("cus_123", SECRET);
  assert.equal(verifyUnsubscribeToken(token.replace("cus_123", "cus_999"), SECRET), null);
  assert.equal(verifyUnsubscribeToken(token, "baska-anahtar"), null);
  assert.equal(verifyUnsubscribeToken("bozuk", SECRET), null);
  assert.equal(verifyUnsubscribeToken(token, ""), null);
});

test("IP silme: yalnız 3 yıldan eski geri çekme seçilir", () => {
  const now = new Date("2029-11-05T00:00:00Z");
  const rows = [
    { id: "a", granted: false, createdAt: new Date("2026-11-03T00:00:00Z") }, // 3 yıl + 2 gün önce geri çekildi
    { id: "b", granted: false, createdAt: new Date("2026-11-06T00:00:00Z") }, // 3 yıldan az
    { id: "c", granted: true, createdAt: new Date("2020-01-01T00:00:00Z") } // onay hâlâ geçerli
  ];
  assert.deepEqual(
    consentGroupsToPurge(rows, now).map((r) => r.id),
    ["a"]
  );
});
