// Urun sezonu (Excel KOD6, orn. "2026 YAZ", "2027 Kış") - normalize, otomatik
// rank ve katalogdaki "once sezon, sonra eklenme tarihi" siralamasi (bkz.
// SEZON_BAZLI_SIRALAMA_PLANI.md).
import type { Prisma, PrismaClient } from "@/generated/prisma/client";

type Tx = PrismaClient | Prisma.TransactionClient;

// Ayni yil icindeki donem sirasi. "2027 Kış", 2026 sonbahar/kisinda satilan
// urun demek - bu yuzden ayni yil icinde Kış, Yaz'dan ONCE gelir:
// 2026 Yaz (20262) < 2027 Kış (20271) < 2027 Yaz (20272). Adlandirma kurali
// degisirse sadece buradaki order degerleri degistirilir.
const SEASON_TERMS = [
  { key: "kis", label: "Kış", order: 1 },
  { key: "yaz", label: "Yaz", order: 2 }
] as const;

export type NormalizedSeason = { name: string; rank: number; recognized: boolean };

// "2027 kış", "2027 KIS", "2027-Kış", "KIŞ 2027" -> { name: "2027 Kış", rank: 20271 }.
// Taninmayan deger ham haliyle (bosluklar sadelestirilmis) ve rank 0 ile doner
// - Sezonlar ekranindan elle siralanabilir; onizlemede uyari gosterilir.
// Bos deger icin null.
export function normalizeSeason(raw: string): NormalizedSeason | null {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  const folded = trimmed.toLocaleLowerCase("tr-TR").replace(/ş/g, "s").replace(/ı/g, "i");
  const yearFirst = folded.match(/^(\d{4})[\s\-_/.]*([a-z]+)$/);
  const termFirst = folded.match(/^([a-z]+)[\s\-_/.]*(\d{4})$/);
  const year = yearFirst?.[1] ?? termFirst?.[2];
  const term = SEASON_TERMS.find((t) => t.key === (yearFirst?.[2] ?? termFirst?.[1]));
  if (year && term) return { name: `${year} ${term.label}`, rank: Number(year) * 10 + term.order, recognized: true };
  return { name: trimmed, rank: 0, recognized: false };
}

// Sezon adina gore bul, yoksa otomatik rank ile olustur. Bos deger -> null.
export async function getOrCreateSeasonId(tx: Tx, raw: string): Promise<string | null> {
  const season = normalizeSeason(raw);
  if (!season) return null;
  // update:{} - mevcut sezonun admin'in elle degistirdigi rank'ina dokunulmaz.
  const row = await tx.season.upsert({
    where: { name: season.name },
    create: { name: season.name, rank: season.rank },
    update: {},
    select: { id: true }
  });
  return row.id;
}

// Varsayilan katalog sirasi: sezon rank'i buyuk olan once, sezonsuz urunler en
// sonda. Array.sort kararli oldugu icin girdinin (createdAt DESC, id ASC)
// sirasi ayni sezon icinde korunur. Prisma iliski uzerinden "nulls last"
// siralamayi desteklemedigi icin bellekte yapiliyor.
export function sortBySeason<T extends { season: { rank: number } | null }>(items: T[]): T[] {
  return items.sort((a, b) => {
    if (!a.season || !b.season) return Number(!a.season) - Number(!b.season);
    return b.season.rank - a.season.rank;
  });
}
