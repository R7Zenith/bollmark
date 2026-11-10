// Kargo etiketi icin Code128-B barkod (SVG). Paket yerine saf TS: kargo
// anahtari yalniz yazdirilabilir ASCII (harf, rakam, tire). Sube bu barkodu
// okutunca Yurtici'deki alici bilgisi ekrana gelir.

// Her desen bar/bosluk genislikleri (modul); 0-102 veri, 103-105 baslangic, 106 bitis.
const PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112"
];

const START_B = 104;
const STOP = 106;
export const QUIET_ZONE = 10;

// Kod degerleri: baslangic, veri, kontrol, bitis.
export function code128BValues(text: string): number[] {
  if (!text) throw new Error("Barkod metni boş olamaz.");
  const data = [...text].map((ch) => {
    const code = ch.charCodeAt(0);
    if (code < 32 || code > 126) throw new Error(`Code128-B desteklemeyen karakter: ${ch}`);
    return code - 32;
  });
  const checksum = data.reduce((sum, v, i) => sum + v * (i + 1), START_B) % 103;
  return [START_B, ...data, checksum, STOP];
}

// Sessiz bolge dahil modul genislikleri (bar ile baslar, bosluk ile devam eder).
export function code128Modules(text: string): { bars: { x: number; w: number }[]; width: number } {
  const bars: { x: number; w: number }[] = [];
  let x = QUIET_ZONE;
  for (const value of code128BValues(text)) {
    const pattern = PATTERNS[value];
    for (let i = 0; i < pattern.length; i++) {
      const w = Number(pattern[i]);
      if (i % 2 === 0) bars.push({ x, w });
      x += w;
    }
  }
  return { bars, width: x + QUIET_ZONE };
}

export function code128Svg(text: string, opts: { height?: number; className?: string } = {}): string {
  const { bars, width } = code128Modules(text);
  const h = opts.height ?? 60;
  const rects = bars.map((b) => `<rect x="${b.x}" y="0" width="${b.w}" height="${h}"/>`).join("");
  const cls = opts.className ? ` class="${opts.className}"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg"${cls} viewBox="0 0 ${width} ${h}" preserveAspectRatio="none" shape-rendering="crispEdges" role="img" aria-label="Barkod ${text.replace(/[<>&"]/g, "")}"><rect width="${width}" height="${h}" fill="#fff"/><g fill="#000">${rects}</g></svg>`;
}

export const CODE128_PATTERNS = PATTERNS;
