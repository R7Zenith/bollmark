// Ad ve soyad birlikte: en az iki kelime. Kargo firmalari (HepsiJET) soyadi
// ayri alan olarak istiyor; tek kelimelik isimle gonderi olusturulamiyor.
export const FULL_NAME_PATTERN = "\\s*\\S+(\\s+\\S+)+\\s*";
export const FULL_NAME_MESSAGE = "Lütfen adınızı ve soyadınızı birlikte yazın.";

export function hasFullName(input: string): boolean {
  return input.trim().split(/\s+/).filter(Boolean).length >= 2;
}
