// Tedarikçi metninin yerine geçecek özgün ürün açıklaması TASLAĞINI kaydeder
// (bkz. SEO_FAZ6_OZGUN_ACIKLAMA_VE_YONLENDIRME_PLANI.md bölüm A). Taslaklar
// Claude Code oturumunda yazılır ve scripts/ai-taslak-aktar.ts ile buraya gelir;
// API çağrısı yoktur. Taslak yalnız Product.descriptionDraft'a yazılır; sitede
// görünen `description` alanına bu dosya hiç dokunmaz, onu yönetici admin'den
// "Kullan" ile onaylar.
import { prisma } from "@/lib/prisma";
import { descriptionToPlainText } from "@/lib/description-html";

const MIN_WORDS = 40;
// Kaynak metinle aynı bu kadar kelimelik bir öbek varsa taslak kopya sayılır.
const OVERLAP_WORDS = 8;

// Kullanıcıya gösterilebilir Türkçe mesaj taşır.
export class AiDescriptionError extends Error {}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function words(text: string): string[] {
  return text
    .toLocaleLowerCase("tr")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

function sharesLongPhrase(draft: string, source: string): boolean {
  const sourceWords = words(source);
  const phrases = new Set<string>();
  for (let i = 0; i + OVERLAP_WORDS <= sourceWords.length; i++) {
    phrases.add(sourceWords.slice(i, i + OVERLAP_WORDS).join(" "));
  }
  const draftWords = words(draft);
  for (let i = 0; i + OVERLAP_WORDS <= draftWords.length; i++) {
    if (phrases.has(draftWords.slice(i, i + OVERLAP_WORDS).join(" "))) return true;
  }
  return false;
}

// Yazılmış bir taslağı (giriş paragrafı + özellik maddeleri) kalite kontrolünden
// geçirip descriptionDraft'a yazar. originalDescription boşsa o anki açıklamayla
// bir kez doldurulur.
export async function saveDraft(productId: string, intro: string, features: string[]): Promise<string> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { description: true, originalDescription: true }
  });
  if (!product) throw new AiDescriptionError("Ürün bulunamadı.");
  const source = descriptionToPlainText(product.originalDescription ?? product.description);

  const plain = [intro, ...features].join(" ");
  if (!intro || words(plain).length < MIN_WORDS) {
    throw new AiDescriptionError(`Taslak çok kısa (${words(plain).length} kelime), kaydedilmedi.`);
  }
  if (sharesLongPhrase(plain, source)) {
    throw new AiDescriptionError("Taslak kaynak metinle fazla örtüşüyor, kaydedilmedi.");
  }

  // Admin açıklama editörünün (TipTap) kaydettiği biçim: paragraf + madde listesi.
  // Giriş boş satırla ayrılmış birden çok paragraf olabilir.
  const draft =
    intro
      .split(/\n\s*\n/)
      .map((paragraph) => `<p>${escapeHtml(paragraph.trim())}</p>`)
      .join("") +
    (features.length > 0 ? `<ul>${features.map((f) => `<li><p>${escapeHtml(f)}</p></li>`).join("")}</ul>` : "");

  await prisma.product.update({
    where: { id: productId },
    data: {
      descriptionDraft: draft,
      ...(product.originalDescription === null ? { originalDescription: product.description } : {})
    }
  });
  return draft;
}
