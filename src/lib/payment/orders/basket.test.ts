import { test } from "node:test";
import assert from "node:assert/strict";
import { allocateDiscount, buildBasketItems, BasketError, SHIPPING_ITEM_ID, type BasketLine } from "./basket";

const line = (id: string, lineTotalCents: number): BasketLine => ({ id, name: `Ürün ${id}`, category: "Giyim", lineTotalCents });
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

// Deterministik sözde-rastgele üretici (testler tekrarlanabilir olsun)
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("allocateDiscount toplamı tam kuruşa dağıtır ve her pay satırı aşmaz", () => {
  const shares = allocateDiscount([1000, 2000, 3000], 100);
  assert.equal(sum(shares), 100);
  shares.forEach((share, i) => assert.ok(share <= [1000, 2000, 3000][i]));
});

test("allocateDiscount kuruş kalıntısını en büyük kalana verir", () => {
  // 3 eşit satır, 100 kuruş indirim: 34+33+33 (fazla kuruş ilk satıra)
  assert.deepEqual(allocateDiscount([100, 100, 100], 100), [34, 33, 33]);
  assert.deepEqual(allocateDiscount([100, 100, 100], 1), [1, 0, 0]);
});

test("allocateDiscount sıfır indirim, geçersiz indirim", () => {
  assert.deepEqual(allocateDiscount([500, 500], 0), [0, 0]);
  assert.throws(() => allocateDiscount([500, 500], 1001), BasketError);
  assert.throws(() => allocateDiscount([500, 500], -1), BasketError);
});

test("tek kalem, indirimsiz, ücretsiz kargo", () => {
  const items = buildBasketItems({ lines: [line("a", 129900)], shippingCents: 0, totalCents: 129900 });
  assert.equal(items.length, 1);
  assert.equal(items[0].priceCents, 129900);
});

test("kargo ayrı kalem olarak eklenir ve toplam tutar", () => {
  const items = buildBasketItems({ lines: [line("a", 50000)], shippingCents: 4999, totalCents: 54999 });
  assert.equal(items.length, 2);
  assert.equal(items[1].id, SHIPPING_ITEM_ID);
  assert.equal(items[1].priceCents, 4999);
  assert.equal(sum(items.map((i) => i.priceCents)), 54999);
});

test("indirim kalemlere dağıtılır, toplam siparişe eşit", () => {
  const items = buildBasketItems({
    lines: [line("a", 100000), line("b", 50000), line("c", 33333)],
    shippingCents: 4999,
    totalCents: 100000 + 50000 + 33333 - 12345 + 4999
  });
  assert.equal(sum(items.map((i) => i.priceCents)), 100000 + 50000 + 33333 - 12345 + 4999);
});

test("%100 indirim ve kargo ücretsiz: toplam 0 dağıtılamaz (serbest sipariş ayrı yol)", () => {
  assert.throws(() => buildBasketItems({ lines: [line("a", 1000)], shippingCents: 0, totalCents: 0 }), BasketError);
});

test("%100 indirim ama kargo var: kalemler 1 kuruşa sabitlenemiyorsa hata (iyzico'ya gitme)", () => {
  assert.throws(
    () => buildBasketItems({ lines: [line("a", 1000), line("b", 1000)], shippingCents: 4999, totalCents: 4999 }),
    BasketError
  );
});

test("neredeyse tam indirim: 0'a düşen kalem 1 kuruşa sabitlenir, fark en büyük kalemden alınır", () => {
  // kalemler 1000 ve 10, toplam ödenecek kalem tutarı 5 kuruş -> küçük kalem 0'a düşerdi
  const items = buildBasketItems({ lines: [line("a", 1000), line("b", 10)], shippingCents: 0, totalCents: 5 });
  assert.ok(items.every((i) => i.priceCents >= 1));
  assert.equal(sum(items.map((i) => i.priceCents)), 5);
});

test("kalem tutarı (indirim) negatif çıkacak durum reddedilir", () => {
  // toplam sipariş, satır toplamından büyük (kargo hariç) -> geçersiz
  assert.throws(() => buildBasketItems({ lines: [line("a", 1000)], shippingCents: 0, totalCents: 1500 }), BasketError);
});

test("1000 rastgele senaryoda Σ sepet == sipariş toplamı ve her kalem >= 1 kuruş", () => {
  const random = mulberry32(20260920);
  for (let i = 0; i < 1000; i++) {
    const lineCount = 1 + Math.floor(random() * 6);
    const lines = Array.from({ length: lineCount }, (_, k) => line(`i${k}`, 1 + Math.floor(random() * 500000)));
    const itemsTotal = sum(lines.map((l) => l.lineTotalCents));
    const shippingCents = random() < 0.5 ? 0 : Math.floor(random() * 10000);
    // toplam indirim: 0..itemsTotal - lineCount (her kaleme en az 1 kuruş kalsın)
    const maxDiscount = Math.max(0, itemsTotal - lineCount);
    const discountCents = random() < 0.2 ? 0 : Math.floor(random() * (maxDiscount + 1));
    const totalCents = itemsTotal - discountCents + shippingCents;

    const items = buildBasketItems({ lines, shippingCents, totalCents });
    assert.equal(sum(items.map((it) => it.priceCents)), totalCents, `senaryo ${i}`);
    assert.ok(items.every((it) => Number.isInteger(it.priceCents) && it.priceCents >= 1), `senaryo ${i} kalem>=1`);
    assert.equal(items.length, lineCount + (shippingCents > 0 ? 1 : 0));
  }
});

test("büyük tutarlarda (BigInt) taşma olmaz", () => {
  const lines = [line("a", 900_000_000), line("b", 800_000_000)];
  const items = buildBasketItems({ lines, shippingCents: 0, totalCents: 1_699_999_999 });
  assert.equal(sum(items.map((i) => i.priceCents)), 1_699_999_999);
});
