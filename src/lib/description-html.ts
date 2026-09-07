// Koton.com'dan çekilen ürün açıklamaları çoğu zaman bozuk HTML içeriyor: çift açılan
// <p><p>, boş <p></p> çiftleri, kapanmamış/fazladan kapanan etiketler. cheerio (parse5
// tabanlı) HTML5 ağaç kurma algoritmasını uyguladığı için bunları otomatik düzeltir -
// örn. <p> içinde başka bir <p> görürse ilkini kapatır. Ardından sanitize-html sadece
// izin verilen temel biçimlendirme etiketlerini bırakır (XSS'e karşı script/style/on*
// öznitelikleri vb. temizlenir).
import * as cheerio from "cheerio";
import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = ["p", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li", "span"];

function isEmptyParagraph(html: string): boolean {
  return html.trim().length === 0;
}

// Ham HTML'i düzeltir: geçersiz iç içe geçmeleri (parse5 ile) düzeltir, boş <p></p>
// çiftlerini kaldırır, izin verilmeyen etiket/öznitelikleri temizler. DB'ye yazmadan
// önce (import akışı) ve DB'den okurken (render, defense-in-depth) kullanılır.
export function sanitizeDescriptionHtml(raw: string | null | undefined): string {
  if (!raw || !raw.trim()) return "";

  const $ = cheerio.load(raw, null, false);

  $("p").each((_, el) => {
    const $el = $(el);
    if ($el.children().length === 0 && isEmptyParagraph($el.html() ?? "")) {
      $el.remove();
    }
  });

  const normalized = $.root().html() ?? "";

  return sanitizeHtml(normalized, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {},
    disallowedTagsMode: "discard"
  }).trim();
}

// Meta description / JSON-LD gibi düz metin gereken yerler için HTML etiketlerini
// tamamen kaldırıp boşlukları sadeleştirir.
export function descriptionToPlainText(raw: string | null | undefined): string {
  if (!raw || !raw.trim()) return "";
  const $ = cheerio.load(raw, null, false);
  return $.root()
    .text()
    .replace(/\s+/g, " ")
    .trim();
}
