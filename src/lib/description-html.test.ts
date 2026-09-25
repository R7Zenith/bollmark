import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeDescriptionHtml, plainTextToHtml } from "./description-html";

const SAMPLE = `Denim şort, yüksek bel tasarımı ... kolaylaştırıyor.

Ürün Özellikleri
Bel Tipi: Yüksek Bel
Fit: Skinny
Kumaş: %81 Pamuk, %1 Elastan, %18 Lyocell

Dış : %1 ELASTAN, %18 LYOCELL, %81 PAMUK
Model Bilgileri :
Boy: 181 / Bel: 58 / Göğüs: 78 / Kalça: 89`;

test("düz metin: paragraflar, satır sonları ve başlıklar", () => {
  const html = sanitizeDescriptionHtml(SAMPLE);
  assert.equal(html.match(/<p>/g)?.length, 3);
  assert.ok(html.includes("<strong>Ürün Özellikleri</strong><br />Bel Tipi: Yüksek Bel<br />"));
  assert.ok(html.includes("<strong>Model Bilgileri :</strong>"));
  assert.ok(!html.includes("<strong>Bel Tipi"));
  assert.ok(!html.includes("<strong>Dış"));
  assert.ok(!html.includes("<strong>Boy"));
  assert.ok(html.startsWith("<p>Denim şort"));
});

test("düz metin HTML-escape edilir", () => {
  assert.equal(plainTextToHtml("a < b & c"), "<p>a &lt; b &amp; c</p>");
});

test("Koton tarzı HTML aynen korunur", () => {
  const koton = "<p><strong>Ürün Özellikleri</strong></p><p>Fit: Skinny</p>";
  assert.equal(sanitizeDescriptionHtml(koton), koton);
});

test("script temizlenir", () => {
  const html = sanitizeDescriptionHtml("<p>Merhaba</p><script>alert(1)</script>");
  assert.equal(html, "<p>Merhaba</p>");
});

test("başlık etiketi kalına çevrilir", () => {
  assert.equal(sanitizeDescriptionHtml("<h3>Başlık</h3>"), "<strong>Başlık</strong>");
});
