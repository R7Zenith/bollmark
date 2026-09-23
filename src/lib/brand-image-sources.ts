// Hangi markanın hangi sitede, hangi yöntemle ("strategy") otomatik görsel/açıklama
// aranacağını söyleyen eşleme tablosu (bkz. COK_MARKALI_GORSEL_BULMA_PLANI.md).
//
// İki strateji var:
// - "koton": Koton.com ile birebir aynı JSON şemasını (?format=json ->
//   product.base_code, product.attributes.urun_aciklama, variants[].productimage_set)
//   döndüren siteler icin (bkz. src/lib/koton-images.ts). Yeni bir marka eklemeden
//   once <site>/<bir-ürün-url'i>?format=json'u tarayicida deneyip ayni semayi
//   dondurdugunu dogrulayin.
// - "slazenger-arama": bu semayi DESTEKLEMEYEN siteler icin - bunun yerine sitenin
//   kendi arama sayfasi (/arama?q=...) HTML sonuc listesi taranip renk bazli urun
//   sayfalari bulunuyor, her sayfadaki <script type="application/ld+json"> Product
//   verisinden (sku/description/image) okunuyor (bkz. src/lib/slazenger-images.ts).
//   Slazenger.com.tr bu sekilde calisiyor - urun sayfalari ?format=json DESTEKLEMIYOR.
//
// Yeni bir marka eklerken once ?format=json'u deneyin: ayni Koton semasini
// donduruyorsa "koton" stratejisiyle tek satir yeterli. Donmuyorsa (Slazenger gibi)
// sitenin kendi arama sayfasinin calisip calismadigina bakip "slazenger-arama"
// stratejisini (gerekirse arama URL'i/selector'lerini genellestirerek) kullanin.
// Hicbiri uymuyorsa bu markayi eklemeyin - kayitli olmayan markalarda otomatik arama
// sessizce atlanir, urun gorselsiz DRAFT kalir, admin panelden "linkle ekle" her
// zaman calisir.
export type ImageSourceStrategy = "koton" | "slazenger-arama";

export interface ImageSource {
  baseUrl: string;
  displayName: string;
  strategy: ImageSourceStrategy;
}

export const BRAND_IMAGE_SOURCES: Record<string, ImageSource> = {
  SLAZENGER: { baseUrl: "https://www.slazenger.com.tr", displayName: "Slazenger", strategy: "slazenger-arama" }
};

export function resolveImageSourceForBrand(brandName: string | null | undefined): ImageSource | null {
  if (!brandName) return null;
  return BRAND_IMAGE_SOURCES[brandName.trim().toUpperCase()] ?? null;
}
