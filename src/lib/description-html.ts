// Ürün açıklaması HTML'ini müşteriye göstermeden önce temizler. sanitize-html sadece
// izin verilen temel biçimlendirme etiketlerini bırakır (XSS'e karşı script/style/on*
// öznitelikleri vb. temizlenir). Bu dosya müşteri sayfasından (urunler/[slug]) çağrıldığı
// için cheerio'yu bilerek İÇERMEZ (function boyutu, bkz. DEPLOY_STATUS.md Functions Storage);
// Koton'dan gelen bozuk HTML'i düzelten cheerio adımı koton-images.ts içinde.
import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = ["p", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li", "span"];

// Ham HTML'de izin verilmeyen etiket/öznitelikleri temizler. Render sırasında
// (defense-in-depth) ve DB'ye yazmadan önce (Koton import akışı) kullanılır.
export function sanitizeDescriptionHtml(raw: string | null | undefined): string {
  if (!raw || !raw.trim()) return "";

  return sanitizeHtml(raw, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {},
    disallowedTagsMode: "discard"
  })
    .replace(/<p>\s*<\/p>/g, "")
    .trim();
}

// Meta description / JSON-LD gibi düz metin gereken yerler için HTML etiketlerini
// tamamen kaldırıp boşlukları sadeleştirir. sanitize-html metni HTML-escape eder,
// bu yüzden sonda geri çözülür (& en son: "&amp;lt;" -> "&lt;" doğru kalsın).
export function descriptionToPlainText(raw: string | null | undefined): string {
  if (!raw || !raw.trim()) return "";
  return sanitizeHtml(raw, { allowedTags: [], allowedAttributes: {} })
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}
