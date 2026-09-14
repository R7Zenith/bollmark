const COLOR_NAME_HEX_MAP: Record<string, string> = {
  siyah: "#000000",
  beyaz: "#FFFFFF",
  bej: "#E8DCC5",
  lacivert: "#1B2A4A",
  kirmizi: "#D62828",
  yesil: "#2E7D32",
  gri: "#8A8A8A",
  kahverengi: "#6F4E37",
  pembe: "#E8A0BF",
  mor: "#6A3FA0",
  sari: "#F4C430",
  turuncu: "#F2760C",
  krem: "#F1E6D0",
  haki: "#7A7350",
  bordo: "#6D1B2B",
  turkuaz: "#1FB8C4",
  "gul kurusu": "#B76E79",
  hardal: "#D4A017",
  antrasit: "#37393B",
  tas: "#B5A88F",
  somon: "#F2917A",
  "bebe mavisi": "#A7D3F2",
  "petrol yesili": "#1E5B52",
  vizon: "#A69080",
  altin: "#D4AF37",
  gumus: "#C0C0C0",
  eflatun: "#B784A7",
  fusya: "#D1408A"
};

function normalizeColorName(name: string): string {
  return name
    .trim()
    .toLocaleLowerCase("tr")
    .replace(/i̇/g, "i")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/\s+/g, " ")
    .trim();
}

export function suggestHexFromName(name: string): string | null {
  const normalized = normalizeColorName(name);
  if (!normalized) return null;
  return COLOR_NAME_HEX_MAP[normalized] ?? null;
}
