import test from "node:test";
import assert from "node:assert/strict";
import { istanbulInputValue, parseCouponExtension, summarizeCouponSales, summarizeDemand } from "./admin-rules";

const item = (orderId: string, couponId: string, totalCents: number, discount: number, kalpTestAt: Date | null = null) => ({
  orderId,
  kalpCouponId: couponId,
  totalCents,
  order: { kalpTestAt, kalpDiscountCents: discount }
});

test("kalpTestAt bos olsa bile test kuponlu siparis gercek rapora girmez", () => {
  const items = [item("gercek", "k1", 1000, 1000), item("test", "k2", 500, 500)];
  const test = new Set(["k2"]);
  assert.deepEqual(summarizeCouponSales(items, test, "real"), { orders: 1, revenueCents: 1000, discountCents: 1000 });
  assert.deepEqual(summarizeCouponSales(items, test, "test"), { orders: 1, revenueCents: 500, discountCents: 500 });
});

test("kalpTestAt dolu siparis test sayilir", () => {
  const items = [item("o1", "k1", 1000, 1000, new Date())];
  assert.equal(summarizeCouponSales(items, new Set(), "real").orders, 0);
  assert.equal(summarizeCouponSales(items, new Set(), "test").orders, 1);
});

test("siparis indirimi cok satirli sipariste bir kez sayilir, ciro satirlardan toplanir", () => {
  const items = [item("o1", "k1", 1000, 1800), item("o1", "k2", 800, 1800)];
  assert.deepEqual(summarizeCouponSales(items, new Set(), "real"), { orders: 1, revenueCents: 1800, discountCents: 1800 });
});

test("tek test kuponu butun siparisi test yapar", () => {
  const items = [item("o1", "k1", 1000, 1500), item("o1", "k2", 500, 1500)];
  assert.equal(summarizeCouponSales(items, new Set(["k2"]), "real").orders, 0);
});

test("talep tablosu geri cekilenleri sayar, uyeleri tekil sayar, cokten aza siralar", () => {
  const rows = summarizeDemand([
    { productId: "a", customerId: "u1", status: "WITHDRAWN" },
    { productId: "a", customerId: "u1", status: "ACTIVE" },
    { productId: "a", customerId: "u2", status: "WON" },
    { productId: "b", customerId: "u3", status: "PENDING" }
  ]);
  assert.deepEqual(rows, [
    { productId: "a", given: 3, open: 1, withdrawn: 1, customers: 2 },
    { productId: "b", given: 1, open: 1, withdrawn: 0, customers: 1 }
  ]);
});

const now = new Date("2026-11-02T12:00:00Z");

test("uzatma Istanbul saatiyle okunur", () => {
  const parsed = parseCouponExtension("2026-11-03T15:00", now, now);
  assert.deepEqual(parsed, new Date("2026-11-03T12:00:00Z"));
  assert.equal(istanbulInputValue(parsed!), "2026-11-03T15:00");
});

test("uzatma simdiden ve mevcut bitisten sonra olmali", () => {
  const later = new Date("2026-11-05T12:00:00Z");
  assert.equal(parseCouponExtension("2026-11-01T15:00", now, now), null);
  assert.equal(parseCouponExtension("2026-11-03T15:00", later, now), null);
  assert.ok(parseCouponExtension("2026-11-03T15:00", new Date("2026-10-01T00:00:00Z"), now));
});

test("uzatma gecersiz tarihi reddeder", () => {
  assert.equal(parseCouponExtension("", now, now), null);
  assert.equal(parseCouponExtension("2026-13-40T15:00", now, now), null);
});
