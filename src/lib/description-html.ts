// Ürün açıklaması HTML'ini müşteriye göstermeden önce temizler. sanitize-html sadece
// izin verilen temel biçimlendirme etiketlerini bırakır (XSS'e karşı script/style/on*
// öznitelikleri vb. temizlenir). Bu dosya müşteri sayfasından (urunler/[slug]) çağrıldığı
// için cheerio'yu bilerek İÇERMEZ (function boyutu, bkz. DEPLOY_STATUS.md Functions Storage);
// Koton'dan gelen bozuk HTML'i düzelten cheerio adımı koton-images.ts içinde.
import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = ["p", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li", "span"];

export function looksLikeHtml(raw: string): boolean {
  return /<\/?(p|br|strong|b|em|i|u|ul|ol|li|span|div|h[1-6])\b/i.test(raw);
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Admin'e elle yapıştırılmış düz metin açıklamayı HTML'e çevirir: boş satırla ayrılan
// bloklar <p>, blok içi satır sonları <br> olur. Başlık sezgisi: bloğun kısa ilk satırı
// ("Ürün Özellikleri") veya ":" ile biten tek başına satır ("Model Bilgileri :") ardından
// başka satır geliyorsa <strong> yapılır; "Anahtar: Değer" satırları kalın yapılmaz.
export function plainTextToHtml(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((block) => block.split("\n").map((line) => line.trim()).filter(Boolean))
    .filter((lines) => lines.length > 0)
    .map((lines) => {
      const html = lines.map((line, i) => {
        const hasNext = i < lines.length - 1;
        const isKeyValue = /:\s*\S/.test(line);
        const isHeading =
          hasNext &&
          ((i === 0 && line.length <= 40 && !line.endsWith(".") && !isKeyValue) || line.endsWith(":"));
        return isHeading ? `<strong>${escapeHtml(line)}</strong>` : escapeHtml(line);
      });
      return `<p>${html.join("<br>")}</p>`;
    })
    .join("");
}

// Ham HTML'de izin verilmeyen etiket/öznitelikleri temizler. Render sırasında
// (defense-in-depth) ve DB'ye yazmadan önce (Koton import akışı, admin kaydı) kullanılır.
// Etiketsiz düz metin (elle girilmiş eski kayıtlar) önce plainTextToHtml ile HTML'e çevrilir.
export function sanitizeDescriptionHtml(raw: string | null | undefined): string {
  if (!raw || !raw.trim()) return "";

  const html = looksLikeHtml(raw) ? raw : plainTextToHtml(raw);

  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {},
    disallowedTagsMode: "discard",
    transformTags: {
      h1: "strong",
      h2: "strong",
      h3: "strong",
      h4: "strong",
      h5: "strong",
      h6: "strong",
      div: "p"
    }
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
