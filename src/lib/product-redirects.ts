import type { Prisma } from "@/generated/prisma/client";
import { catalogHref } from "@/lib/catalog-url";

// Urun adresi degistiginde/kaybolduğunda eski adresi yeni hedefe baglayan
// ProductRedirect kayitlari (bkz. SEO_FAZ6_OZGUN_ACIKLAMA_VE_YONLENDIRME_PLANI.md
// bolum B). Kayitlar urun sayfasinda, yalniz urun bulunamadiginda okunur
// (urunler/[slug]/product-page.tsx). fromSlug hep decode edilmis slug'tir.

function productPath(slug: string): string {
  return encodeURI(`/urunler/${slug}`);
}

// Yayinda olmayan urunun gidecegi yer: kendi kategori sayfasi, yoksa /urunler.
export function productCategoryPath(product: { gender: string | null; category: { slug: string } | null }): string {
  return catalogHref({ gender: product.gender, category: product.category?.slug });
}

// Eski adres `toPath`e gider; eski adrese isaret eden onceki kayitlar da dogrudan
// `toPath`e cevrilir, boylece zincir olusmaz.
async function pointSlugTo(tx: Prisma.TransactionClient, fromSlug: string, toPath: string) {
  await tx.productRedirect.updateMany({ where: { toPath: productPath(fromSlug) }, data: { toPath } });
  await tx.productRedirect.upsert({
    where: { fromSlug },
    create: { fromSlug, toPath },
    update: { toPath }
  });
}

export async function redirectSlugChange(tx: Prisma.TransactionClient, oldSlug: string, newSlug: string) {
  if (oldSlug === newSlug) return;
  // Yeni slug artik gercek bir urun; onu baska yere goturen eski kayit silinir.
  await tx.productRedirect.deleteMany({ where: { fromSlug: newSlug } });
  await pointSlugTo(tx, oldSlug, productPath(newSlug));
}

export async function redirectDeletedProduct(
  tx: Prisma.TransactionClient,
  product: { slug: string; gender: string | null; category: { slug: string } | null }
) {
  await pointSlugTo(tx, product.slug, productCategoryPath(product));
}
