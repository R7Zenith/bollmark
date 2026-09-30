import { parseCatalogPath } from "@/lib/catalog-url";

// Katalog sayfalari (/urunler, /erkek, /erkek/gomlek, /kategori/ayakkabi) her
// gorunumde tepede tam genislikte bir banner render eder ve header bu
// banner'in ustune binmek icin saydam baslar. "Banner var mi" karari burada
// tek yerde tutuluyor: catalog-page.tsx banner'i, site-header.tsx de saydamligi
// bu yardimciya gore belirliyor - ikisi birbirinden bagimsiz kaymasin diye.

// Secili kategorinin kendi `imageUrl`'i yoksa (ya da kategori secili degilse)
// kullanilan, site genelinde tek varsayilan gorsel (Unsplash - engin akyurt).
export const DEFAULT_CATALOG_BANNER_IMAGE = "/catalog-banner.jpg";

export function hasCatalogBanner(pathname: string | null): boolean {
  return parseCatalogPath(pathname) !== null;
}
