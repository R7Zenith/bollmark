import { cache } from "react";
import { prisma } from "@/lib/prisma";

export type MenuCategory = { id: string; name: string; slug: string; imageUrl: string | null };

export type MegaMenuData = {
  kadin: MenuCategory[];
  erkek: MenuCategory[];
  aksesuar: MenuCategory[];
};

async function getGenderCategories(genderLabel: string): Promise<MenuCategory[]> {
  const categories = await prisma.category.findMany({
    where: {
      isActive: true,
      products: { some: { status: "PUBLISHED", gender: genderLabel } }
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true, imageUrl: true }
  });
  return categories;
}

async function getAksesuarCategories(): Promise<MenuCategory[]> {
  const aksesuar = await prisma.category.findFirst({
    where: { parentId: null, slug: "aksesuar" },
    select: {
      children: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, slug: true, imageUrl: true }
      }
    }
  });
  return aksesuar?.children ?? [];
}

export const getMegaMenuData = cache(async (): Promise<MegaMenuData> => {
  const [kadin, erkek, aksesuar] = await Promise.all([
    getGenderCategories("Kadın"),
    getGenderCategories("Erkek"),
    getAksesuarCategories()
  ]);
  return { kadin, erkek, aksesuar };
});
