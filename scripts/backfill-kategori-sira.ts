// Tek seferlik script: Category.sortOrder yeni alan oldugu icin tum kayitlar
// 0 ile basliyor, bu da ayni ust kategori altindaki kardeslerin sirasini
// belirsizlestiriyor. Her parentId grubunu su anki alfabetik sirayla
// (name.localeCompare(..., "tr")) gezip sortOrder'i 0, 10, 20, 30... gibi
// araliklarla atar (araliklar ileride araya ekleme kolayligi saglar).
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const categories = await prisma.category.findMany({ select: { id: true, name: true, parentId: true } });

  const byParent = new Map<string | null, typeof categories>();
  for (const c of categories) {
    const key = c.parentId ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(c);
  }

  let updated = 0;
  for (const group of byParent.values()) {
    group.sort((a, b) => a.name.localeCompare(b.name, "tr"));
    for (let i = 0; i < group.length; i++) {
      await prisma.category.update({ where: { id: group[i].id }, data: { sortOrder: i * 10 } });
      updated++;
    }
  }

  console.log(`Tamamlandi. ${categories.length} kategori tarandi, ${updated} kayit guncellendi.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
