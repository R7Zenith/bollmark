// KOD3'ün (Excel'deki ürün tipi kodu) sabit CATEGORY_MAP'te karşılığı olmadığı
// durumlarda, Anthropic API'ye DB'deki mevcut kategori adları listesiyle birlikte
// "en olası eşleşme hangisi" diye sorup bir ÖNERİ döner. Bu KESİN bir eşleşme
// değildir - importProductGroups hiçbir zaman bu öneriyi doğrudan kullanmaz,
// sadece önizleme ekranında yöneticinin gözden geçirip onaylaması/düzeltmesi için
// gösterilir (bkz. EXCEL_KATEGORI_ESLEME_PLANI.md bölüm 2).
export interface CategorySuggestion {
  categoryName: string;
  confidence: "high" | "medium" | "low";
  reason: string;
}

const MODEL = "claude-haiku-4-5-20251001";

export async function suggestCategory(
  categoryRaw: string,
  existingCategoryNames: string[]
): Promise<CategorySuggestion | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const trimmedRaw = categoryRaw.trim();
  if (!apiKey || !trimmedRaw || existingCategoryNames.length === 0) return null;

  const prompt = `Bir giyim e-ticaret sisteminde ürün tipi kodu "${trimmedRaw}" için, aşağıdaki mevcut
kategori adları listesinden en olası eşleşmeyi seç. Hiçbiri makul şekilde uymuyorsa categoryName
alanını null yap.

Mevcut kategoriler: ${existingCategoryNames.join(", ")}

Sadece aşağıdaki JSON formatında cevap ver, başka hiçbir metin ekleme:
{"categoryName": "<mevcut kategorilerden biri ya da null>", "confidence": "high" | "medium" | "low", "reason": "<kısa gerekçe, tek cümle, Türkçe>"}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 200,
        messages: [{ role: "user", content: prompt }]
      })
    });
    if (!res.ok) {
      console.error("Kategori AI önerisi alınamadı (API hatası):", res.status, await res.text().catch(() => ""));
      return null;
    }
    const data = await res.json();
    const text: string = data?.content?.[0]?.text ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);

    const rawName = typeof parsed?.categoryName === "string" ? parsed.categoryName.trim() : "";
    if (!rawName || rawName.toLowerCase() === "null") return null;
    const matchedName = existingCategoryNames.find((n) => n.toLowerCase() === rawName.toLowerCase());
    if (!matchedName) return null;

    const confidence: CategorySuggestion["confidence"] =
      parsed?.confidence === "high" || parsed?.confidence === "low" ? parsed.confidence : "medium";
    const reason = typeof parsed?.reason === "string" ? parsed.reason.slice(0, 300) : "";

    return { categoryName: matchedName, confidence, reason };
  } catch (error) {
    console.error("Kategori AI önerisi alınamadı (yoksayıldı):", error);
    return null;
  }
}
