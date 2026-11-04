// Turkiye cep telefonu: kayitta zorunlu, DB'ye E.164 ("+905321234567") yazilir.
// Bosluk/tire/parantez temizlenir; basta +90, 90 ya da 0 olabilir. Geriye
// 5 ile baslayan 10 hane kalmazsa null.
export const TR_MOBILE_ERROR = "Geçerli bir cep telefonu numarası gir (05xx xxx xx xx).";

export function normalizeTrMobile(input: string): string | null {
  const cleaned = input.replace(/[\s\-()]/g, "");
  if (!/^\+?\d+$/.test(cleaned)) return null;
  const digits = cleaned.replace(/^\+?90(?=\d{10}$)/, "").replace(/^0(?=\d{10}$)/, "");
  return /^5\d{9}$/.test(digits) ? `+90${digits}` : null;
}

// Gosterim: "0532 123 45 67". Normalize edilemeyen deger oldugu gibi doner.
export function formatTrMobile(input: string): string {
  const e164 = normalizeTrMobile(input);
  if (!e164) return input;
  const d = e164.slice(3);
  return `0${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8)}`;
}
