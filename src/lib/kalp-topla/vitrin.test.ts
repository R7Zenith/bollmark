import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTrend, type VitrinProduct } from "./vitrin";

const source = (id: string) => ({ productId: id, slug: id, name: id, image: null });
const sources = (...ids: string[]) => new Map(ids.map((id) => [id, source(id)]));

test("trend: haftalık kalbe göre sıralı, yayında olmayan atlanır, en çok 8", () => {
  const counts = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"].map((id, i) => ({ productId: id, count: i + 1 }));
  const bar: VitrinProduct = { ...source("j"), points: 4, threshold: 10, closedRounds: 1 };
  const trend = buildTrend(counts, sources("a", "b", "c", "d", "e", "f", "g", "h", "j"), new Map([["j", bar]]));
  assert.deepEqual(
    trend.map((t) => t.productId),
    ["j", "h", "g", "f", "e", "d", "c", "b"]
  );
  assert.equal(trend[0].weekHearts, 10);
  assert.equal(trend[0].points, 4);
  assert.equal(trend[0].threshold, 10);
  assert.equal(trend[1].points, 0, "barı olmayan üründe ilerleme 0");
});

test("trend: 3'ten az ürün varsa boş döner", () => {
  const counts = [
    { productId: "a", count: 5 },
    { productId: "b", count: 3 },
    { productId: "c", count: 2 }
  ];
  assert.deepEqual(buildTrend(counts, sources("a", "b"), new Map()), []);
  assert.equal(buildTrend(counts, sources("a", "b", "c"), new Map()).length, 3);
});
