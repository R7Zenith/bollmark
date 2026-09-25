// Site aramasinin Prisma'ya bagimli olmayan metin yardimcilari - hem sunucuda
// (lib/search.ts indeks/eslestirme) hem istemcide (search-overlay.tsx vurgulama)
// kullaniliyor. Turkce buyuk/kucuk harf ve aksan farklari burada tek yerde
// sadelesir: "GÖMLEK", "Gömlek", "gomlek" ayni metne donusur.

export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_MAX_LENGTH = 80;

const TR_MAP: Record<string, string> = { ı: "i", ş: "s", ğ: "g", ü: "u", ö: "o", ç: "c" };

// Tek karakteri normalize eder. Karakter karakter yapiliyor ki vurgulamada
// normalize metindeki konum orijinal metindeki konuma geri eslenebilsin
// ("İ".toLowerCase() iki karakter "i̇" dondurdugu icin once elle cevriliyor).
function normalizeChar(c: string): string {
  if (c === "İ" || c === "I") return "i";
  const lower = c.toLowerCase();
  return (TR_MAP[lower] ?? lower).normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function normalizeTr(s: string): string {
  return Array.from(s, normalizeChar).join("").replace(/\s+/g, " ").trim();
}

export function tokenize(query: string): string[] {
  return normalizeTr(query).split(" ").filter(Boolean);
}

// Orijinal metinde sorgu kelimelerinin eslestigi araliklari [baslangic, bitis)
// olarak dondurur - arama panelinde eslesen kismi kalin gostermek icin.
export function highlightRanges(text: string, query: string): [number, number][] {
  const words = tokenize(query);
  if (words.length === 0) return [];
  // normalized[i] -> orijinal metindeki karakter indeksi
  let normalized = "";
  const origIndex: number[] = [];
  let pos = 0;
  for (const c of Array.from(text)) {
    for (const n of normalizeChar(c)) {
      normalized += n;
      origIndex.push(pos);
    }
    pos += c.length;
  }
  const marked = new Array<boolean>(text.length).fill(false);
  for (const word of words) {
    let from = 0;
    for (;;) {
      const at = normalized.indexOf(word, from);
      if (at === -1) break;
      const start = origIndex[at];
      const endNorm = at + word.length;
      const end = endNorm < origIndex.length ? origIndex[endNorm] : text.length;
      for (let i = start; i < end; i++) marked[i] = true;
      from = at + 1;
    }
  }
  const ranges: [number, number][] = [];
  for (let i = 0; i < marked.length; i++) {
    if (!marked[i]) continue;
    const start = i;
    while (i < marked.length && marked[i]) i++;
    ranges.push([start, i]);
  }
  return ranges;
}
