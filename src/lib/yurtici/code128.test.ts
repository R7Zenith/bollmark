import { test } from "node:test";
import assert from "node:assert/strict";
import { CODE128_PATTERNS, code128BValues, code128Modules, code128Svg, QUIET_ZONE } from "./code128";

test("desen tablosu: 107 desen, veri desenleri 11 modul, bitis 13 modul ve hepsi farkli", () => {
  assert.equal(CODE128_PATTERNS.length, 107);
  for (const [i, p] of CODE128_PATTERNS.entries()) {
    const sum = [...p].reduce((s, d) => s + Number(d), 0);
    assert.equal(sum, i === 106 ? 13 : 11, `desen ${i}`);
  }
  assert.equal(new Set(CODE128_PATTERNS).size, 107);
});

test("kontrol hanesi (mod 103)", () => {
  // 104 + 48*1 + 42*2 + 42*3 + 17*4 + 18*5 + 19*6 + 35*7 = 879 -> 879 % 103 = 55
  assert.deepEqual(code128BValues("PJJ123C"), [104, 48, 42, 42, 17, 18, 19, 35, 55, 106]);
  const v = code128BValues("BLM261105-9473-2");
  assert.equal(v.length, 16 + 3);
  assert.equal(v[0], 104);
  assert.equal(v.at(-1), 106);
});

test("genislik: (n+3)*11 + 2 + sessiz bolgeler; desteklenmeyen karakter reddedilir", () => {
  const { width, bars } = code128Modules("BLM261105-9473");
  assert.equal(width, (14 + 3) * 11 + 2 + 2 * QUIET_ZONE);
  assert.equal(bars[0].x, QUIET_ZONE);
  assert.throws(() => code128BValues("ÇAĞ"));
  assert.throws(() => code128BValues(""));
});

test("SVG: kaciş ve olcu", () => {
  const svg = code128Svg("BLM1", { height: 40 });
  assert.match(svg, /^<svg [^>]*viewBox="0 0 \d+ 40"/);
  assert.ok(svg.includes('shape-rendering="crispEdges"'));
});
