// Tek seferlik script: "Parfüm" (slug parfum) ust seviye kategoriydi; anasayfa
// "Ne arıyorsun?" kutulari aksesuar agacini disarida birakirken parfum giyim
// sayiliyordu, mega menude de Aksesuar altinda gorunmuyordu. Bu script parfum
// kategorisinin parentId'sini "aksesuar" ust kategorisine baglar ve sortOrder'ini
// Aksesuar alt kategorilerinin sonuna koyar. Slug, vatRate, imageUrl ve urunlerin
// categoryId'si degismez. Idempotent: zaten Aksesuar altindaysa hicbir sey yapmaz.
//
// Varsayilan kuru calistirmadir; yazmak icin: npx tsx scripts/parfum-aksesuar-altina-tasi.ts --apply
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

const APPLY = process.argv.includes("--apply");

async function main() {
  const parfum = await prisma.category.findUnique({
    where: { slug: "parfum" },
    select: { id: true, name: true, slug: true, parentId: true, sortOrder: true, vatRate: true, imageUrl: true },
  });
  const aksesuar = await prisma.category.findUnique({
    where: { slug: "aksesuar" },
    select: {
      id: true,
      name: true,
      parentId: true,
      children: { select: { id: true, name: true, slug: true, sortOrder: true }, orderBy: { sortOrder: "asc" } },
    },
  });
  if (!parfum || !aksesuar) throw new Error(`Kategori bulunamadi: parfum=${!!parfum} aksesuar=${!!aksesuar}`);

  const products = await prisma.product.groupBy({
    by: ["gender", "status"],
    where: { categoryId: parfum.id },
    _count: { _all: true },
  });

  console.log("Parfum:", parfum);
  console.log("Parfum urunleri (gender, status, adet):");
  for (const p of products) console.log(`  ${p.gender ?? "null"}  ${p.status}  ${p._count._all}`);
  console.log(`Aksesuar: id=${aksesuar.id} parentId=${aksesuar.parentId}`);
  console.log("Aksesuar alt kategorileri:");
  for (const c of aksesuar.children) console.log(`  ${String(c.sortOrder).padStart(4)}  ${c.name} (${c.slug})`);

  if (parfum.parentId === aksesuar.id) {
    console.log("Parfum zaten Aksesuar altinda, degisiklik yok.");
    return;
  }

  const siblings = aksesuar.children.filter((c) => c.id !== parfum.id);
  const sortOrder = siblings.length ? Math.max(...siblings.map((c) => c.sortOrder)) + 10 : 0;
  console.log(`Plan: parentId ${parfum.parentId} -> ${aksesuar.id}, sortOrder ${parfum.sortOrder} -> ${sortOrder}`);

  if (!APPLY) {
    console.log("Kuru calistirma, yazilmadi. Uygulamak icin --apply ekleyin.");
    return;
  }
  await prisma.category.update({ where: { id: parfum.id }, data: { parentId: aksesuar.id, sortOrder } });
  console.log("Uygulandi.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
