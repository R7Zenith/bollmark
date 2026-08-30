// Varyant ozellik havuzuyla (VariantAttribute/VariantAttributeValue) ilgili
// ortak yardimcilar. Faz A gecisi: VariantEditor UI'i henuz serbest metin
// Beden/Renk kullaniyor (kutucukla secim Faz D'de gelecek), bu yuzden yazma
// tarafinda serbest metni mevcut/atributler icinde bulup-yoksa-olusturarak
// (upsert) option degerlerine ceviriyoruz.
import type { Prisma, PrismaClient } from "@/generated/prisma/client";

type Tx = PrismaClient | Prisma.TransactionClient;

export async function resolveOptionValueIds(
  tx: Tx,
  entries: { attributeName: string; value: string }[]
): Promise<string[]> {
  const ids: string[] = [];
  for (const { attributeName, value } of entries) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const attribute = await tx.variantAttribute.upsert({
      where: { name: attributeName },
      create: { name: attributeName },
      update: {}
    });
    const attrValue = await tx.variantAttributeValue.upsert({
      where: { attributeId_value: { attributeId: attribute.id, value: trimmed } },
      create: { attributeId: attribute.id, value: trimmed },
      update: {}
    });
    ids.push(attrValue.id);
  }
  return ids;
}

export type VariantOptionInclude = {
  options: { value: { value: string; attribute: { name: string } } }[];
};

export function optionValue(variant: VariantOptionInclude, attributeName: string): string {
  return variant.options.find((o) => o.value.attribute.name === attributeName)?.value.value ?? "";
}

export function optionLabel(variant: VariantOptionInclude): string {
  return variant.options.map((o) => `${o.value.attribute.name}: ${o.value.value}`).join(" · ");
}

export const variantOptionsInclude = {
  options: { include: { value: { include: { attribute: true } } } }
} as const;
