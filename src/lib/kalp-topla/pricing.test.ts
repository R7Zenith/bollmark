import { test } from "node:test";
import assert from "node:assert/strict";
import { assignKalpCoupons, couponGain, couponPriceFor, parseKalpSelection, splitOrderItems, type KalpPriceLine } from "./pricing";

const line = (variantId: string, priceCents: number, extra: Partial<KalpPriceLine> = {}): KalpPriceLine => ({
  variantId,
  priceCents,
  compareAtCents: null,
  currentBestCents: priceCents,
  excluded: false,
  ...extra
});
const coupon = (id: string, hours = 48) => ({ id, expiresAt: new Date(Date.UTC(2026, 10, 1, hours)), discountPercent: 50 });
const none = { manual: [], removed: [] };

test("10.4 fiyat kurali ve kazanc", () => {
  const cases: [Partial<KalpPriceLine> & { priceCents: number }, number, number][] = [
    [{ priceCents: 1000 }, 500, 500],
    [{ priceCents: 700, compareAtCents: 1000 }, 500, 200],
    [{ priceCents: 400, compareAtCents: 1000 }, 500, 0],
    [{ priceCents: 1000, currentBestCents: 400 }, 500, 0],
    [{ priceCents: 1000, currentBestCents: 800 }, 500, 300],
    [{ priceCents: 900, compareAtCents: 1200 }, 600, 300]
  ];
  for (const [input, price, gain] of cases) {
    const row = line("v", input.priceCents, input);
    assert.equal(couponPriceFor(row, 50), price);
    assert.equal(couponGain(row, 50), gain);
  }
});

test("10.5 en cok kazandiran satirlar secilir", () => {
  const lines = [
    line("a", 1000),
    line("b", 700, { compareAtCents: 1200 }),
    line("c", 800)
  ];
  const result = assignKalpCoupons(lines, [coupon("k1"), coupon("k2")], none);
  assert.deepEqual(result.map((r) => r.variantId), ["a", "c"]);
  assert.deepEqual(result.map((r) => r.unitCents), [500, 400]);
});

test("erken biten kupon once harcanir", () => {
  const result = assignKalpCoupons([line("a", 1000)], [coupon("gec", 40), coupon("erken", 2)], none);
  assert.equal(result[0].couponId, "erken");
});

test("kazanc yoksa ve Kalp Topla disi urunde atanmaz", () => {
  const lines = [line("a", 1000, { currentBestCents: 400 }), line("b", 1000, { excluded: true })];
  assert.deepEqual(assignKalpCoupons(lines, [coupon("k1")], none), []);
});

test("Kaldir otomatige girmez, Kupon uygula one gecer", () => {
  const lines = [line("a", 1000), line("b", 800)];
  const removed = assignKalpCoupons(lines, [coupon("k1")], { manual: [], removed: ["a"] });
  assert.deepEqual(removed.map((r) => r.variantId), ["b"]);
  const manual = assignKalpCoupons(lines, [coupon("k1")], { manual: ["b"], removed: [] });
  assert.deepEqual(manual.map((r) => r.variantId), ["b"]);
});

test("kod kutusu: kaldirilmis satir dahil kuponsuz kalan en iyi satira gider", () => {
  const lines = [line("a", 1000), line("b", 800)];
  const result = assignKalpCoupons(lines, [coupon("k1"), coupon("kod", 40)], { manual: [], removed: ["a"] }, "kod");
  assert.deepEqual(
    result.map((r) => [r.couponId, r.variantId]),
    [["k1", "b"], ["kod", "a"]]
  );
});

test("kupon sayisi secimden azsa fazlasi atanmaz", () => {
  const lines = [line("a", 1000), line("b", 800)];
  assert.equal(assignKalpCoupons(lines, [coupon("k1")], { manual: ["a", "b"], removed: [] }).length, 1);
});

test("10.6 ayni urunden 3 adet: 1 kuponlu, 2 normal satir", () => {
  const assignment = { couponId: "k1", variantId: "v", unitCents: 500, originalUnitCents: 1000 };
  const items = splitOrderItems([{ productId: "p", variantId: "v", quantity: 3, priceCents: 1000 }], [assignment]);
  assert.deepEqual(
    items.map((i) => [i.quantity, i.unitPriceCents, i.totalCents]),
    [[1, 500, 500], [2, 1000, 2000]]
  );
  const [kuponlu, normal] = items;
  assert.ok("kalpCouponId" in kuponlu);
  assert.equal(kuponlu.kalpCouponId, "k1");
  assert.equal(kuponlu.kalpOriginalUnitCents, 1000);
  assert.equal("kalpCouponId" in normal, false);
});

test("tek adet kuponluysa normal satir olusmaz, kuponsuz satir bolunmez", () => {
  const assignment = { couponId: "k1", variantId: "v", unitCents: 500, originalUnitCents: 1000 };
  const lines = [{ productId: "p", variantId: "v", quantity: 1, priceCents: 1000 }];
  assert.equal(splitOrderItems(lines, [assignment]).length, 1);
  assert.equal(splitOrderItems(lines, []).length, 1);
});

test("bozuk secim bos sayilir", () => {
  assert.deepEqual(parseKalpSelection("bozuk"), none);
  assert.deepEqual(parseKalpSelection('{"manual":["a",1],"removed":"x"}'), { manual: ["a"], removed: [] });
});
