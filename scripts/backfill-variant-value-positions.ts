// Tek seferlik duzeltme scripti: VariantAttributeValue.position alani cogu
// kayitta 0 olarak duruyor (serbest metin girisinde resolveOptionValueIds
// eskiden position atamiyordu, bkz. src/lib/variant-attributes.ts). Bu
// script her VariantAttribute icin degerlerini dogal/mantikli bir siraya
// koyup 1'den baslayan sequential position atar:
// - Sayisal bedenler (36, 38, 40...) kucukten buyuge
// - Bilinen harf bedenler (XXS..XXXL) standart beden sirasina gore
// - Geri kalanlar (renkler dahil) alfabetik, listenin sonuna eklenir
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

const KNOWN_SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL", "4XL", "5XL"];
// "3XL" gibi rakam+XL yazimlari da XXXL/4XL/5XL ile ayni sirada sayilsin.
const SIZE_ALIASES: Record<string, string> = { "3XL": "XXXL" };

function sortKey(value: string): [number, number, string] {
  const trimmed = value.trim();

  const asNumber = Number(trimmed.replace(",", "."));
  if (trimmed !== "" && !Number.isNaN(asNumber)) {
    return [0, asNumber, trimmed];
  }

  const normalized = trimmed.toUpperCase();
  const knownIndex = KNOWN_SIZE_ORDER.indexOf(SIZE_ALIASES[normalized] ?? normalized);
  if (knownIndex !== -1) {
    return [1, knownIndex, trimmed];
  }

  return [2, 0, trimmed.toLocaleLowerCase("tr-TR")];
}

async function main() {
  const attributes = await prisma.variantAttribute.findMany({
    include: { values: true }
  });

  let updated = 0;

  for (const attribute of attributes) {
    const sorted = [...attribute.values].sort((a, b) => {
      const ka = sortKey(a.value);
      const kb = sortKey(b.value);
      if (ka[0] !== kb[0]) return ka[0] - kb[0];
      if (ka[1] !== kb[1]) return ka[1] - kb[1];
      return ka[2].localeCompare(kb[2], "tr-TR");
    });

    for (let i = 0; i < sorted.length; i++) {
      const newPosition = i + 1;
      if (sorted[i].position === newPosition) continue;
      await prisma.variantAttributeValue.update({
        where: { id: sorted[i].id },
        data: { position: newPosition }
      });
      updated++;
    }
  }

  console.log(`Tamamlandi. ${attributes.length} ozellik tarandi, ${updated} deger guncellendi.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
