// Cinsiyeti yalniz "Çocuk" olan urun icin Kiz/Erkek Cocuk tahmini (bkz.
// COCUK_MENU_VE_BEDEN_DUZELTME_PLANI.md B ve E). Sira: once urun adi, sonra
// Koton urun kodu. Tahmin edilemezse gender null doner, urun "Çocuk" kalir.
// Hem scripts/cocuk-cinsiyet-ayir.ts hem Excel aktarimi kullanir.
export type ChildGenderGuess = { gender: "Kız Çocuk" | "Erkek Çocuk" | null; reason: string };

// Kelime olarak "kız" / "erkek" (Türkçe harfler \b ile calismiyor).
const GIRL_WORD = /(?<!\p{L})kız(?!\p{L})/u;
const BOY_WORD = /(?<!\p{L})erkek(?!\p{L})/u;

// Koton cocuk kodlari: rakam + sezon harfi + "K" + B (erkek) / G (kiz) + rakam,
// orn. 7WKB00018TW. KB veride dogrulandi, KG kullanici tarafindan dogrulandi.
const KOTON_CHILD_CODE = /^\d[A-Z]K([BG])\d/i;

export function guessChildGender(name: string, code: string | null): ChildGenderGuess {
  const lowerName = name.toLocaleLowerCase("tr");
  const girl = GIRL_WORD.test(lowerName);
  const boy = BOY_WORD.test(lowerName);
  if (girl && !boy) return { gender: "Kız Çocuk", reason: 'adda "Kız" geçiyor' };
  if (boy && !girl) return { gender: "Erkek Çocuk", reason: 'adda "Erkek" geçiyor' };

  const match = code?.trim().match(KOTON_CHILD_CODE);
  if (match) {
    const letter = match[1].toUpperCase();
    return letter === "G"
      ? { gender: "Kız Çocuk", reason: `ürün kodu K${letter} ile başlıyor` }
      : { gender: "Erkek Çocuk", reason: `ürün kodu K${letter} ile başlıyor` };
  }

  return { gender: null, reason: girl && boy ? 'adda hem "Kız" hem "Erkek" geçiyor' : "adda ve kodda ipucu yok" };
}
