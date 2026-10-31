import { test } from "node:test";
import assert from "node:assert/strict";
import { allocateCredits, chooseTargetHeart, waitingExpiry } from "./bonus";

const heart = (productId: string, left: number, day: number) => ({
  heartId: `h-${productId}`,
  productId,
  left,
  createdAt: new Date(2026, 9, day)
});

test("T4: önce linkin ürünü, yoksa dolmaya en yakın bar, eşitlikte en eski kalp", () => {
  const hearts = [heart("a", 5, 3), heart("b", 2, 2), heart("c", 2, 1)];
  assert.equal(chooseTargetHeart(hearts, "a")?.productId, "a");
  assert.equal(chooseTargetHeart(hearts, "yok")?.productId, "c");
  assert.equal(chooseTargetHeart(hearts, null)?.productId, "c");
  assert.equal(chooseTargetHeart([], "a"), null);
});

test("sığan kredi tamamen uygulanır", () => {
  const r = allocateCredits([{ id: "1", points: 2 }], 5);
  assert.deepEqual(r, { applied: [{ id: "1", points: 2 }], split: null, returned: [] });
});

test("Y11: bar 9/10, +2: 1 puan bara, 1 puan yeni bekleyen kredi", () => {
  const r = allocateCredits([{ id: "1", points: 2 }], 1);
  assert.deepEqual(r.applied, []);
  assert.deepEqual(r.split, { credit: { id: "1", points: 2 }, keep: 1, rest: 1 });
});

test("plan 10.2: 3 kredi (6 puan), eşik 5, ilk kalp sonrası yer 4: 3. kredi tamamen bekler", () => {
  const credits = [1, 2, 3].map((n) => ({ id: String(n), points: 2 }));
  const r = allocateCredits(credits, 4);
  assert.deepEqual(r.applied.map((c) => c.id), ["1", "2"]);
  assert.equal(r.split, null);
  assert.deepEqual(r.returned.map((c) => c.id), ["3"]);
});

test("toplam puan korunur", () => {
  for (const room of [1, 2, 3, 4, 5, 6, 7]) {
    const credits = [2, 3, 1].map((points, i) => ({ id: String(i), points }));
    const r = allocateCredits(credits, room);
    const onBar = r.applied.reduce((t, c) => t + c.points, 0) + (r.split?.keep ?? 0);
    const left = r.returned.reduce((t, c) => t + c.points, 0) + (r.split?.rest ?? 0);
    assert.equal(onBar + left, 6);
    assert.ok(onBar <= room);
  }
});

test("bekleme süresi 30 gün", () => {
  const from = new Date("2026-10-30T10:00:00Z");
  assert.equal(waitingExpiry(from).toISOString(), "2026-11-29T10:00:00.000Z");
});
