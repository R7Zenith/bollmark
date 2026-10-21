// Cocuk Excel'lerinden gelen beden degerlerini "5-6 Yaş" bicimine getirir (bkz.
// COCUK_MENU_VE_BEDEN_DUZELTME_PLANI.md E). YALNIZ cocuk cinsiyetli satirlarda
// cagrilir - yetiskin bedenleri (38, 3032, M) buraya hic gelmez.
//   "5-6", "5-6Y", "5-6 yaş"  -> "5-6 Yaş"
//   "56" -> "5-6 Yaş", "910" -> "9-10 Yaş"
//   "112" -> "11-12 Yaş", "134" -> "13-14 Yaş" (ikinci sayinin onlar basamagi
//   Excel'de dusmus: 11 + 2, 13 + 4)
// Ardisik iki yasa bolunemeyen deger oldugu gibi kalir, ok:false ile onizlemede
// uyari gosterilir. Zaten "Yaş" iceren degere dokunulmaz.
export function normalizeChildSize(size: string): { value: string; ok: boolean } {
  const trimmed = size.trim();
  if (trimmed.toLocaleLowerCase("tr").includes("yaş")) return { value: trimmed, ok: true };

  const ranged = trimmed.match(/^(\d{1,2})\s*-\s*(\d{1,2})\s*(?:y|yas)?$/i);
  if (ranged) return { value: `${Number(ranged[1])}-${Number(ranged[2])} Yaş`, ok: true };

  const joined = trimmed.match(/^(\d{2,4})\s*(?:y|yas)?$/i);
  if (joined) {
    const digits = joined[1];
    for (let i = 1; i < digits.length; i++) {
      const first = digits.slice(0, i);
      const rest = digits.slice(i);
      if (first.startsWith("0") || rest.startsWith("0")) continue;
      const next = String(Number(first) + 1);
      // "910": 9 + 10; "112": 11 + "2" (12'nin son basamagi).
      if (next === rest || (next.length > rest.length && next.endsWith(rest))) {
        return { value: `${Number(first)}-${next} Yaş`, ok: true };
      }
    }
  }

  return { value: trimmed, ok: false };
}
