import { prisma } from "@/lib/prisma";
import { variantOptionsInclude } from "@/lib/variant-attributes";

export async function getPublishedProducts(categorySlug?: string) {
  return prisma.product.findMany({
    where: {
      status: "PUBLISHED",
      category: categorySlug ? { slug: categorySlug } : undefined
    },
    include: { images: { orderBy: { position: "asc" } } },
    orderBy: { createdAt: "desc" }
  });
}

export async function getProductBySlug(slug: string) {
  return prisma.product.findUnique({
    where: { slug },
    include: {
      images: { orderBy: { position: "asc" } },
      variants: { include: variantOptionsInclude },
      category: true
    }
  });
}

export async function getCategories() {
  return prisma.category.findMany({ orderBy: { name: "asc" } });
}
