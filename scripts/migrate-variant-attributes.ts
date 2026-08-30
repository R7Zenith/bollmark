// Faz A veri tasima scripti: db push ile silinen ProductVariant.size/color
// degerlerini (backup-before-variant-v2.ts ile alinan JSON yedekten okuyarak)
// yeni VariantAttribute / VariantAttributeValue / ProductVariantOption
// semasina aktarir. Tek seferlik kullanim icin yazildi, eslestirme SKU
// uzerinden yapilir (SKU semada degismedi ve unique).
import { readFileSync } from "fs";
import { prisma } from "../src/lib/prisma";

type BackupVariant = { sku: string; size: string; color: string };

async function main() {
  const backupPath = process.argv[2];
  if (!backupPath) {
    console.error("Kullanim: tsx scripts/migrate-variant-attributes.ts <backup.json>");
    process.exit(1);
  }
  const backup = JSON.parse(readFileSync(backupPath, "utf-8")) as {
    productVariants: BackupVariant[];
  };

  const bedenAttr = await prisma.variantAttribute.upsert({
    where: { name: "Beden" },
    create: { name: "Beden", position: 0 },
    update: {}
  });
  const renkAttr = await prisma.variantAttribute.upsert({
    where: { name: "Renk" },
    create: { name: "Renk", position: 1 },
    update: {}
  });

  const valueCache = new Map<string, string>(); // `${attributeId}::${value}` -> valueId

  async function getOrCreateValue(attributeId: string, value: string): Promise<string> {
    const key = `${attributeId}::${value}`;
    const cached = valueCache.get(key);
    if (cached) return cached;
    const row = await prisma.variantAttributeValue.upsert({
      where: { attributeId_value: { attributeId, value } },
      create: { attributeId, value },
      update: {}
    });
    valueCache.set(key, row.id);
    return row.id;
  }

  let linked = 0;
  let skippedMissing = 0;
  let skippedNoData = 0;

  for (const v of backup.productVariants) {
    const size = v.size?.trim();
    const color = v.color?.trim();
    if (!size && !color) {
      skippedNoData++;
      continue;
    }
    const variant = await prisma.productVariant.findUnique({ where: { sku: v.sku } });
    if (!variant) {
      skippedMissing++;
      continue;
    }

    const optionValueIds: string[] = [];
    if (size) optionValueIds.push(await getOrCreateValue(bedenAttr.id, size));
    if (color) optionValueIds.push(await getOrCreateValue(renkAttr.id, color));

    for (const valueId of optionValueIds) {
      await prisma.productVariantOption.upsert({
        where: { variantId_valueId: { variantId: variant.id, valueId } },
        create: { variantId: variant.id, valueId },
        update: {}
      });
    }
    linked++;
  }

  console.log(
    `Tamamlandi. Baglanan varyant: ${linked}, DB'de bulunamayan (SKU eslesmedi): ${skippedMissing}, size/color bos: ${skippedNoData}`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
