import { test } from "node:test";
import assert from "node:assert/strict";
import {
  moveInOrder,
  parseIstanbulInput,
  slideInWindow,
  slideStatus,
  sortSlides,
  toIstanbulInput,
  visibleSlides,
  type HomeSlideData
} from "./home-slides";

const at = (iso: string) => new Date(iso).getTime();

function slide(over: Partial<HomeSlideData>): HomeSlideData {
  return {
    id: "s",
    name: "s",
    kind: "IMAGE_ONLY",
    enabled: true,
    sortOrder: 0,
    createdAt: "2026-11-25T10:00:00.000Z",
    startsAt: null,
    endsAt: null,
    desktopImageUrl: "/a.jpg",
    mobileImageUrl: null,
    desktopFocus: "50% 50%",
    mobileFocus: "50% 50%",
    altText: "a",
    href: null,
    eyebrow: null,
    title: null,
    subtitle: null,
    buttonLabel: null,
    textAlign: "LEFT",
    textTone: "LIGHT",
    overlay: "NONE",
    showCountdown: false,
    ...over
  };
}

const kampanya = {
  enabled: true,
  startsAt: "2026-11-25T09:00:00.000Z",
  endsAt: new Date("2026-11-29T23:59:59+03:00").toISOString()
};

test("pencere: baslangic ve bitis dakikasi dahil, disi haric", () => {
  assert.equal(slideInWindow(kampanya, at("2026-11-25T08:59:59Z")), false);
  assert.equal(slideInWindow(kampanya, at("2026-11-25T09:00:00Z")), true);
  assert.equal(slideInWindow(kampanya, at("2026-11-29T23:59:30+03:00")), true);
  assert.equal(slideInWindow(kampanya, at("2026-11-30T00:00:00+03:00")), false);
});

test("pencere: tarihsiz slayt hep acik, kapali slayt hic gorunmez", () => {
  assert.equal(slideInWindow({ enabled: true, startsAt: null, endsAt: null }, 0), true);
  assert.equal(slideInWindow({ ...kampanya, enabled: false }, at("2026-11-26T12:00:00Z")), false);
});

test("durum rozeti", () => {
  assert.equal(slideStatus({ ...kampanya, enabled: false }, at("2026-11-26T12:00:00Z")), "KAPALI");
  assert.equal(slideStatus(kampanya, at("2026-11-24T12:00:00Z")), "PLANLANDI");
  assert.equal(slideStatus(kampanya, at("2026-11-26T12:00:00Z")), "YAYINDA");
  assert.equal(slideStatus(kampanya, at("2026-11-30T12:00:00Z")), "SURESI_DOLDU");
});

test("siralama: sortOrder, esitlikte once olusturulan", () => {
  const list = sortSlides([
    slide({ id: "c", sortOrder: 2 }),
    slide({ id: "b", sortOrder: 1, createdAt: "2026-11-25T11:00:00.000Z" }),
    slide({ id: "a", sortOrder: 1, createdAt: "2026-11-25T10:00:00.000Z" })
  ]);
  assert.deepEqual(list.map((s) => s.id), ["a", "b", "c"]);
});

test("gorunur slaytlar: kapali/sure disi duser, Kalp yalniz LIVE ve ara disinda", () => {
  const slides = [
    slide({ id: "kalp", kind: "KALP_TOPLA", sortOrder: 4 }),
    slide({ id: "A", sortOrder: 1, ...kampanya }),
    slide({ id: "B", sortOrder: 1, ...kampanya, enabled: false }),
    slide({ id: "kargo", sortOrder: 2 })
  ];
  const during = at("2026-11-27T12:00:00Z");
  const after = at("2026-11-30T12:00:00Z");
  const ids = (now: number, kalp: { live: boolean; paused: boolean }) =>
    visibleSlides(slides, now, kalp).map((s) => s.id);
  assert.deepEqual(ids(during, { live: true, paused: true }), ["A", "kargo"]);
  assert.deepEqual(ids(after, { live: true, paused: false }), ["kargo", "kalp"]);
  assert.deepEqual(ids(after, { live: false, paused: false }), ["kargo"]);
});

test("yukari/asagi tasima", () => {
  assert.deepEqual(moveInOrder(["a", "b", "c"], "b", "up"), ["b", "a", "c"]);
  assert.deepEqual(moveInOrder(["a", "b", "c"], "b", "down"), ["a", "c", "b"]);
  assert.deepEqual(moveInOrder(["a", "b", "c"], "a", "up"), ["a", "b", "c"]);
  assert.deepEqual(moveInOrder(["a", "b", "c"], "c", "down"), ["a", "b", "c"]);
  assert.deepEqual(moveInOrder(["a", "b"], "x", "up"), ["a", "b"]);
});

test("Istanbul saati girdi donusumu", () => {
  const d = parseIstanbulInput("2026-11-29T23:59");
  assert.equal(d?.toISOString(), "2026-11-29T20:59:00.000Z");
  assert.equal(toIstanbulInput(d), "2026-11-29T23:59");
  assert.equal(parseIstanbulInput("bozuk"), null);
  assert.equal(toIstanbulInput(null), "");
});
