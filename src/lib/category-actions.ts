"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isDescendantOf } from "@/lib/category-tree";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9ığüşöç\s-]/gi, "")
    .replace(/\s+/g, "-");
}

function readCategoryFields(formData: FormData) {
  return {
    imageUrl: String(formData.get("imageUrl") || "").trim() || null,
    description: String(formData.get("description") || "").trim() || null,
    metaTitle: String(formData.get("metaTitle") || "").trim() || null,
    metaDescription: String(formData.get("metaDescription") || "").trim() || null,
    isActive: formData.get("isActive") === "on"
  };
}

export async function createCategory(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  if (!name) redirect("/admin/kategoriler?hata=isim-gerekli");
  const parentId = String(formData.get("parentId") || "") || null;
  const sizeGuide = String(formData.get("sizeGuide") || "").trim() || null;
  await prisma.category.create({
    data: { name, slug: slugify(name), parentId, sizeGuide, ...readCategoryFields(formData) }
  });
  redirect("/admin/kategoriler?basarili=eklendi");
}

export async function updateCategory(id: string, redirectBase: string, formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  if (!name) redirect(`${redirectBase}?hata=isim-gerekli`);
  const parentId = String(formData.get("parentId") || "") || null;
  const sizeGuide = String(formData.get("sizeGuide") || "").trim() || null;

  if (parentId === id) redirect(`${redirectBase}?hata=kendine-bagli`);
  if (parentId) {
    const all = await prisma.category.findMany({ select: { id: true, parentId: true } });
    if (isDescendantOf(all, id, parentId)) redirect(`${redirectBase}?hata=dongu`);
  }

  await prisma.category.update({
    where: { id },
    data: { name, slug: slugify(name), parentId, sizeGuide, ...readCategoryFields(formData) }
  });
  redirect(`${redirectBase}?basarili=guncellendi`);
}

export async function deleteCategory(id: string) {
  const category = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { products: true, children: true } } }
  });
  if (!category) redirect("/admin/kategoriler?hata=bulunamadi");
  if (category._count.products > 0) redirect("/admin/kategoriler?hata=urun-bagli");
  if (category._count.children > 0) redirect("/admin/kategoriler?hata=alt-kategori-bagli");
  await prisma.category.delete({ where: { id } });
  redirect("/admin/kategoriler?basarili=silindi");
}

export async function reassignProductsAndDeleteCategory(id: string, formData: FormData) {
  const targetCategoryId = String(formData.get("targetCategoryId") || "") || null;
  if (targetCategoryId === id) redirect("/admin/kategoriler?hata=kendine-bagli");

  const category = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { children: true } } }
  });
  if (!category) redirect("/admin/kategoriler?hata=bulunamadi");
  if (category._count.children > 0) redirect("/admin/kategoriler?hata=alt-kategori-bagli");

  await prisma.$transaction([
    prisma.product.updateMany({ where: { categoryId: id }, data: { categoryId: targetCategoryId } }),
    prisma.category.delete({ where: { id } })
  ]);
  redirect("/admin/kategoriler?basarili=tasindi-ve-silindi");
}
