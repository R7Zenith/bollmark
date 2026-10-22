import { test } from "node:test";
import assert from "node:assert/strict";
import { parseHotspots, parseProductOrder } from "./bundles";

test("bozuk JSON ve dizi olmayan deger bos doner", () => {
  assert.deepEqual(parseHotspots("{", ["a"]), []);
  assert.deepEqual(parseHotspots('{"productId":"a"}', ["a"]), []);
});

test("bundle'da olmayan urun, ikinci nokta ve sayi olmayan koordinat atilir", () => {
  const raw = JSON.stringify([
    { productId: "a", x: 10, y: 20 },
    { productId: "a", x: 50, y: 50 },
    { productId: "x", x: 1, y: 1 },
    { productId: "b", x: "5", y: 5 },
    { productId: "c", x: 30, y: 40 }
  ]);
  assert.deepEqual(parseHotspots(raw, ["a", "b", "c"]), [
    { productId: "a", x: 10, y: 20 },
    { productId: "c", x: 30, y: 40 }
  ]);
});

test("koordinatlar 0-100'e sikistirilir ve tek ondaliga yuvarlanir", () => {
  const raw = JSON.stringify([{ productId: "a", x: -5, y: 33.333 }, { productId: "b", x: 140, y: 99.96 }]);
  assert.deepEqual(parseHotspots(raw, ["a", "b"]), [
    { productId: "a", x: 0, y: 33.3 },
    { productId: "b", x: 100, y: 100 }
  ]);
});

test("urun sirasi: kayitli sira once, bundle disi ve tekrar atilir, yeni urunler sona", () => {
  assert.deepEqual(parseProductOrder(JSON.stringify(["c", "x", "a", "c"]), ["a", "b", "c"]), ["c", "a", "b"]);
  assert.deepEqual(parseProductOrder("bozuk", ["a", "b"]), ["a", "b"]);
  assert.deepEqual(parseProductOrder("[]", ["b", "a"]), ["b", "a"]);
});
