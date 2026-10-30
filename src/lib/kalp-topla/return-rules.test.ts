import test from "node:test";
import assert from "node:assert/strict";
import { couponRestoreExpiry, exchangeQuote, isLineFullyRefunded, wasShipped } from "./return-rules";

const HOUR = 60 * 60 * 1000;
const now = new Date("2026-11-02T12:00:00Z");
const hoursFromNow = (h: number) => new Date(now.getTime() + h * HOUR);

test("suresi bitmemis kupon kalan suresiyle doner", () => {
  const expiry = couponRestoreExpiry({
    expiresAt: hoursFromNow(2),
    usedAt: hoursFromNow(-16),
    now,
    extraHours: 24,
    afterShipping: true
  });
  assert.deepEqual(expiry, hoursFromNow(18));
});

test("suresi bitmis kupon kargolanmis iadede ayardaki ek sureyi alir", () => {
  const base = { expiresAt: hoursFromNow(-1), usedAt: hoursFromNow(-30), now, afterShipping: true };
  assert.deepEqual(couponRestoreExpiry({ ...base, extraHours: 24 }), hoursFromNow(24));
  assert.deepEqual(couponRestoreExpiry({ ...base, extraHours: 12 }), hoursFromNow(12));
});

test("suresi bitmis kupon kargodan once iptalde geri yuklenmez", () => {
  const expiry = couponRestoreExpiry({
    expiresAt: hoursFromNow(-1),
    usedAt: hoursFromNow(-30),
    now,
    extraHours: 24,
    afterShipping: false
  });
  assert.equal(expiry, null);
});

test("satir tam iade: odenen tutar kadar iade gerekir", () => {
  assert.equal(isLineFullyRefunded({ paidCents: 50_000, unitPriceCents: 50_000, refundedCents: 49_999 }), false);
  assert.equal(isLineFullyRefunded({ paidCents: 50_000, unitPriceCents: 50_000, refundedCents: 50_000 }), true);
  assert.equal(isLineFullyRefunded({ paidCents: null, unitPriceCents: 50_000, refundedCents: 50_000 }), true);
  assert.equal(isLineFullyRefunded({ paidCents: 0, unitPriceCents: 0, refundedCents: 0 }), false);
});

test("kargo kontrolu: durum ya da kargo tarihi yeter", () => {
  assert.equal(wasShipped({ status: "PAID", shipment: null }), false);
  assert.equal(wasShipped({ status: "SHIPPED", shipment: null }), true);
  assert.equal(wasShipped({ status: "REFUNDED", shipment: { shippedAt: now } }), true);
});

// Plan 10.7 ornekleri: kuponlu odenen 500 TL.
const line = (priceCents: number, currentBestCents: number, excluded = false) => ({
  variantId: "v",
  priceCents,
  compareAtCents: null,
  currentBestCents,
  excluded
});
const quote = (sameProduct: boolean, l: ReturnType<typeof line>) =>
  exchangeQuote({ paidUnitCents: 50_000, sameProduct, discountPercent: 50, line: l });

test("degisim: ayni urun fark 0", () => {
  assert.deepEqual(quote(true, line(160_000, 160_000)), { unitCents: 50_000, diffCents: 0, couponAction: "KEEP" });
});

test("degisim: farkli urun 1600 -> 800, +300", () => {
  assert.deepEqual(quote(false, line(160_000, 160_000)), { unitCents: 80_000, diffCents: 30_000, couponAction: "KEEP" });
});

test("degisim: indirimli fiyat daha dusukse o gecer, -150", () => {
  assert.deepEqual(quote(false, line(160_000, 35_000)), { unitCents: 35_000, diffCents: -15_000, couponAction: "KEEP" });
});

test("degisim: kampanya disi urun normal fiyat, kupon geri, +700", () => {
  assert.deepEqual(quote(false, line(120_000, 120_000, true)), { unitCents: 120_000, diffCents: 70_000, couponAction: "RESTORE" });
});
