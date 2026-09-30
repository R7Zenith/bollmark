// Katalog sayfalarinin temiz adresleri (bkz. SEO_FAZ3_KATEGORI_URL_PLANI.md):
//   /kadin, /erkek            -> cinsiyet koleksiyonu
//   /erkek/gomlek             -> cinsiyet + kategori
//   /kategori/ayakkabi        -> cinsiyetsiz kategori
//   /urunler                  -> tum urunler ve arama (?ara=)
// Katalog baglantilari elle yazilmaz, hep catalogHref ile uretilir.

// Product.gender degerleri -> URL parcasi.
export const GENDER_SLUGS: Record<string, string> = {
  Kadın: "kadin",
  Erkek: "erkek",
  Unisex: "unisex",
  Çocuk: "cocuk"
};

export function genderFromSlug(slug: string): string | undefined {
  return Object.keys(GENDER_SLUGS).find((label) => GENDER_SLUGS[label] === slug);
}

// Turkce karakterli eski kategori slug'lari (ASCII'ye cevrildi) - eski
// ?kategori= adresleri yeni slug'a yonlendirilirken kullanilir.
export const LEGACY_CATEGORY_SLUGS: Record<string, string> = {
  "eşofman-altı": "esofman-alti",
  parfüm: "parfum",
  "dış-giyim": "dis-giyim"
};

// Bu Next.js surumunde dinamik rota parametreleri %XX kacisli geliyor (bkz.
// urunler/[slug]/page.tsx decodeSlug).
export function decodePathSegment(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

const TR_ASCII: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" };

// Yeni kategori slug'i: Turkce karakterler ASCII'ye ("Eşofman Altı" ->
// "esofman-alti"), "&" gibi isaretler atilir. Slug yalniz kategori
// olusturulurken uretilir - sonradan degisirse katalog adresleri kirilir.
export function categorySlug(name: string): string {
  return name
    .toLocaleLowerCase("tr")
    .replace(/[çğıöşü]/g, (ch) => TR_ASCII[ch])
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .trim()
    .replace(/[\s-]+/g, "-");
}

export function catalogHref({ gender, category }: { gender?: string | null; category?: string | null }): string {
  const genderSlug = gender ? GENDER_SLUGS[gender] : undefined;
  const categoryPart = category ? encodeURIComponent(category) : null;
  if (genderSlug) return categoryPart ? `/${genderSlug}/${categoryPart}` : `/${genderSlug}`;
  return categoryPart ? `/kategori/${categoryPart}` : "/urunler";
}

// Adres cubugundaki yoldan cinsiyet/kategori - header'daki aktif menu ogesi ve
// saydam banner karari icin. Katalog sayfasi degilse null.
export function parseCatalogPath(pathname: string | null): { gender: string | null; category: string | null } | null {
  if (!pathname) return null;
  if (pathname === "/urunler") return { gender: null, category: null };
  const parts = pathname.split("/").filter(Boolean).map(decodePathSegment);
  if (parts[0] === "kategori" && parts.length === 2) return { gender: null, category: parts[1] };
  const gender = parts[0] ? genderFromSlug(parts[0]) : undefined;
  if (gender && parts.length <= 2) return { gender, category: parts[1] ?? null };
  return null;
}
