import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assignEfsane,
  efsaneActiveAt,
  efsaneDiscountOf,
  efsaneHalfCents,
  kalpPausedAt,
  EFSANE_DEFAULT_END,
  EFSANE_DEFAULT_START,
  type EfsaneLine
} from "./efsane-cuma";

const line = (variantId: string, unitCents: number, quantity = 1): EfsaneLine => ({ variantId, unitCents, quantity });

test("tek urun: indirim yok", () => {
  assert.deepEqual(assignEfsane([line("a", 100000)]), []);
});

test("iki farkli fiyat: ucuz olana %50", () => {
  const result = assignEfsane([line("ucuz", 80000), line("pahali", 120000)]);
  assert.deepEqual(result, [{ variantId: "ucuz", count: 1, unitCents: 40000, originalUnitCents: 80000 }]);
});

test("ayni urunden 2 adet = 2 urun", () => {
  const result = assignEfsane([line("a", 99000, 2)]);
  assert.deepEqual(result, [{ variantId: "a", count: 1, unitCents: 49500, originalUnitCents: 99000 }]);
});

test("3 urun: yalniz 2. sira", () => {
  const result = assignEfsane([line("c", 30000), line("a", 100000), line("b", 50000)]);
  assert.deepEqual(result, [{ variantId: "b", count: 1, unitCents: 25000, originalUnitCents: 50000 }]);
});

test("4 urun: 2. ve 4. sira", () => {
  const result = assignEfsane([line("a", 100000), line("b", 80000), line("c", 60000), line("d", 40000)]);
  assert.deepEqual(
    result.map((r) => r.variantId),
    ["b", "d"]
  );
  assert.equal(efsaneDiscountOf(result), 40000 + 20000);
});

test("4 adet ayni urun ve karisik adetler", () => {
  assert.deepEqual(assignEfsane([line("a", 10000, 4)]), [{ variantId: "a", count: 2, unitCents: 5000, originalUnitCents: 10000 }]);
  // Siralama: a,a,b,b,c -> 2. (a) ve 4. (b) indirimli
  const mixed = assignEfsane([line("c", 1000), line("b", 5000, 2), line("a", 9000, 2)]);
  assert.deepEqual(mixed, [
    { variantId: "a", count: 1, unitCents: 4500, originalUnitCents: 9000 },
    { variantId: "b", count: 1, unitCents: 2500, originalUnitCents: 5000 }
  ]);
});

test("indirimli fiyattan hesap ve kurus yuvarlama", () => {
  // OLEKS: 2.490 TL, guncel satis fiyati 1.992 TL -> 996 TL
  assert.equal(efsaneHalfCents(199200), 99600);
  assert.equal(efsaneHalfCents(224500), 112250);
  assert.equal(efsaneHalfCents(224501), 112251);
});

test("pencere: Istanbul saatiyle 1 dk once/sonra", () => {
  const window = { enabled: true, kalpPause: true, startsAt: EFSANE_DEFAULT_START.toISOString(), endsAt: EFSANE_DEFAULT_END.toISOString() };
  const at = (iso: string) => new Date(iso);
  assert.equal(efsaneActiveAt(window, at("2026-11-25T23:59:00+03:00")), false);
  assert.equal(efsaneActiveAt(window, at("2026-11-26T00:00:00+03:00")), true);
  assert.equal(efsaneActiveAt(window, at("2026-11-26T00:01:00+03:00")), true);
  assert.equal(efsaneActiveAt(window, at("2026-11-29T23:58:00+03:00")), true);
  assert.equal(efsaneActiveAt(window, at("2026-11-29T23:59:59+03:00")), true);
  assert.equal(efsaneActiveAt(window, at("2026-11-30T00:00:00+03:00")), false);
  assert.equal(efsaneActiveAt(window, at("2026-11-30T00:01:00+03:00")), false);
  assert.equal(kalpPausedAt(window, at("2026-11-30T00:00:00+03:00")), false);
  assert.equal(efsaneActiveAt({ ...window, enabled: false }, at("2026-11-27T12:00:00+03:00")), false);
  assert.equal(kalpPausedAt({ ...window, enabled: false }, at("2026-11-27T12:00:00+03:00")), true);
  assert.equal(kalpPausedAt({ ...window, kalpPause: false }, at("2026-11-27T12:00:00+03:00")), false);
});
