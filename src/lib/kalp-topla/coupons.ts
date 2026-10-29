import { randomBytes } from "node:crypto";

// Kalp Topla kupon kodu (plan 4.2, 5.10): "KALP-" + 6 tahmin edilemeyen
// karakter. Karistirilabilen harf/rakamlar (0/O, 1/I/L) alfabede yok.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function generateCouponCode(): string {
  const bytes = randomBytes(6);
  let code = "";
  for (const byte of bytes) code += ALPHABET[byte % ALPHABET.length];
  return `KALP-${code}`;
}
