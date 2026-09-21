import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { effectivePrice, effectiveCompareAt } from "@/lib/variant";
import { optionValue, variantOptionsInclude } from "@/lib/variant-attributes";
import { MAX_CART_LINES, MAX_LINE_QUANTITY, type CartLineIssue, type ResolvedCartLine } from "@/lib/cart-shared";

// Sepet satirlarinin sunucu tarafi ortak katmani (api/sepet ve
// api/sepet/dogrula). Sepette DB'ye/istekle yalniz id + adet gider; isim,
// beden/renk, gorsel ve FIYAT her zaman burada guncel urun kaydindan uretilir.

export const cartLineInputSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1),
  quantity: z.number().int().min(1).max(MAX_LINE_QUANTITY)
});

export const cartLinesSchema = z.array(cartLineInputSchema).max(MAX_CART_LINES);

export type CartLineInput = z.infer<typeof cartLineInputSchema>;

// product-viewer.tsx'teki galeri fallback'i ile ayni gorsel.
const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1445205170230-053b83016050?w=1200";

export async function resolveCartLines(inputs: CartLineInput[]): Promise<ResolvedCartLine[]> {
  if (inputs.length === 0) return [];

  const products = await prisma.product.findMany({
    where: { id: { in: [...new Set(inputs.map((l) => l.productId))] } },
    include: {
      variants: { include: variantOptionsInclude },
      images: { orderBy: { position: "asc" }, select: { url: true } },
      optionImages: { orderBy: { position: "asc" }, select: { valueId: true, url: true } }
    }
  });
  const productById = new Map(products.map((p) => [p.id, p]));

  return inputs.map((line) => {
    const product = productById.get(line.productId);
    const variant = product?.variants.find((v) => v.id === line.variantId);
    if (!product || !variant) {
      return { ...line, name: "", size: "", color: "", image: "", priceCents: 0, compareAtCents: null, stock: 0, issue: "UNAVAILABLE" };
    }

    // Sepete eklerken product-viewer.tsx ile ayni secim: varyantin rengine ait
    // galerinin ilk gorseli, yoksa urunun genel gorseli.
    const colorValueId = variant.options.find((o) => o.value.attribute.isColor)?.valueId ?? null;
    const image =
      (colorValueId ? product.optionImages.find((i) => i.valueId === colorValueId)?.url : undefined) ??
      product.images[0]?.url ??
      FALLBACK_IMAGE;

    const priceCents = effectivePrice(product, variant);
    const compareAt = effectiveCompareAt(product, variant);
    const issue: CartLineIssue | null =
      product.status !== "PUBLISHED" ? "UNAVAILABLE" : variant.stock <= 0 ? "OUT_OF_STOCK" : null;

    return {
      ...line,
      name: product.name,
      size: optionValue(variant, "Beden"),
      color: optionValue(variant, "Renk"),
      image,
      priceCents,
      // Sepette "eski fiyat" yalniz gercek bir indirim varsa tutulur (bkz. product-viewer.tsx addToCart).
      compareAtCents: compareAt && compareAt > priceCents ? compareAt : null,
      stock: variant.stock,
      issue
    };
  });
}
