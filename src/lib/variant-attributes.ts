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
    const existing = await tx.variantAttributeValue.findUnique({
      where: { attributeId_value: { attributeId: attribute.id, value: trimmed } }
    });
    const attrValue =
      existing ??
      (await (async () => {
        const last = await tx.variantAttributeValue.findFirst({
          where: { attributeId: attribute.id },
          orderBy: { position: "desc" }
        });
        return tx.variantAttributeValue.create({
          data: { attributeId: attribute.id, value: trimmed, position: (last?.position ?? -1) + 1 }
        });
      })());
    ids.push(attrValue.id);
  }
  return ids;
}

export type VariantOptionInclude = {
  options: { value: { value: string; position: number; attribute: { name: string } } }[];
};

export function optionValue(variant: VariantOptionInclude, attributeName: string): string {
  return variant.options.find((o) => o.value.attribute.name === attributeName)?.value.value ?? "";
}

// sizes/colors listelerini kucukten buyuge (VariantAttributeValue.position)
// siralamak icin - degerin kendisi string oldugundan dogal siralama yerine
// admin panelinde tanimlanan sirayi kullanmamiz gerekiyor.
export function optionPosition(variant: VariantOptionInclude, attributeName: string): number {
  return variant.options.find((o) => o.value.attribute.name === attributeName)?.value.position ?? 0;
}

export type VariantColorOptionInclude = {
  options: { valueId: string; value: { attribute: { isColor: boolean } } }[];
};

// Bir varyantin renk ekseni (isColor:true) icin secili degerinin id'sini dondurur -
// renk bazli gorsel galerisini (ProductOptionImage) bu id ile eslestirmek icin.
export function colorValueId(variant: VariantColorOptionInclude): string | null {
  return variant.options.find((o) => o.value.attribute.isColor)?.valueId ?? null;
}

export function optionLabel(variant: VariantOptionInclude): string {
  return variant.options.map((o) => `${o.value.attribute.name}: ${o.value.value}`).join(" · ");
}

export const variantOptionsInclude = {
  options: { include: { value: { include: { attribute: true } } } }
} as const;
