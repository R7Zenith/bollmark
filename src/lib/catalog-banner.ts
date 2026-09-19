// Katalog (/urunler) sayfasi her gorunumde (kategori, cinsiyet koleksiyonu,
// Tum Urunler) tepede tam genislikte bir banner render eder ve header bu
// banner'in ustune binmek icin saydam baslar. "Banner var mi" karari burada
// tek yerde tutuluyor: urunler/page.tsx banner'i, site-header.tsx de saydamligi
// bu yardimciya gore belirliyor - ikisi birbirinden bagimsiz kaymasin diye.
export const CATALOG_BANNER_PATH = "/urunler";

// Secili kategorinin kendi `imageUrl`'i yoksa (ya da kategori secili degilse)
// kullanilan, site genelinde tek varsayilan gorsel (Unsplash - engin akyurt).
export const DEFAULT_CATALOG_BANNER_IMAGE = "/catalog-banner.jpg";

export function hasCatalogBanner(pathname: string | null): boolean {
  return pathname === CATALOG_BANNER_PATH;
}
