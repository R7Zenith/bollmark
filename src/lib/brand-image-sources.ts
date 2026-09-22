// Hangi markanın hangi sitede otomatik görsel/açıklama aranacağını söyleyen eşleme
// tablosu (bkz. COK_MARKALI_GORSEL_BULMA_PLANI.md). Yeni bir marka eklemek için: önce
// <site>/<bir-ürün-url'i>?format=json'u tarayıcıda dene - Koton'dakiyle aynı şemayı
// (product.base_code, product.attributes.urun_aciklama, variants[].productimage_set)
// döndürüyorsa buraya tek satır eklemek yeterli. Farklı bir altyapıdaysa (şema
// uyuşmuyorsa) bu markayı eklemeyin - kayıtlı olmayan markalarda otomatik arama
// sessizce atlanır, ürün görselsiz DRAFT kalır, admin panelden "linkle ekle" her
// zaman çalışır.
export const BRAND_IMAGE_SOURCES: Record<string, { baseUrl: string; displayName: string }> = {
  KOTON: { baseUrl: "https://www.koton.com", displayName: "Koton" },
  SLAZENGER: { baseUrl: "https://www.slazenger.com.tr", displayName: "Slazenger" }
};

export function resolveImageSourceForBrand(
  brandName: string | null | undefined
): { baseUrl: string; displayName: string } | null {
  if (!brandName) return null;
  return BRAND_IMAGE_SOURCES[brandName.trim().toUpperCase()] ?? null;
}
