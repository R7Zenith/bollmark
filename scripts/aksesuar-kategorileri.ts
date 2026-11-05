// Tek seferlik script: Vega_Koton_04.11.2026.xls aksesuar aktarimi oncesi kategori
// altyapisi. "Aksesuar" (slug aksesuar) ust kategorisini ve onun DOGRUDAN altinda
// Kemer, Şapka & Bere, Şal & Atkı, Takı & Bijuteri, Çorap kategorilerini garanti eder;
// Boxer ust seviyede kalir (yoksa ust seviyede olusturulur, varsa dokunulmaz).
// Ad eslesmesi Turkce buyuk/kucuk harf duyarsizdir; "Takı & Bijüteri" yazimi da
// "Takı & Bijuteri" ile ayni sayilir. Idempotent: her sey yerindeyse hicbir sey yazmaz.
//
// Varsayilan kuru calistirmadir; yazmak icin: npx tsx scripts/aksesuar-kategorileri.ts --confirm
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { categorySlug } from "../src/lib/catalog-url";
import { generateUniqueCategorySlug } from "../src/lib/excel-import";

const CONFIRM = process.argv.includes("--confirm");

// name: olusturulacaksa kullanilacak yazim; aliases: ayni kategori sayilan yazimlar.
const AKSESUAR_CHILDREN = [
  { name: "Kemer", aliases: ["Kemer"] },
  { name: "Şapka & Bere", aliases: ["Şapka & Bere"] },
  { name: "Şal & Atkı", aliases: ["Şal & Atkı"] },
  { name: "Takı & Bijuteri", aliases: ["Takı & Bijuteri", "Takı & Bijüteri"] },
  { name: "Çorap", aliases: ["Çorap"] },
];
const TOP_LEVEL = { name: "Boxer", aliases: ["Boxer"] };

type Cat = { id: string; name: string; slug: string; parentId: string | null; sortOrder: number };

const norm = (s: string) => s.trim().toLocaleLowerCase("tr-TR");

async function main() {
  const all: Cat[] = await prisma.category.findMany({
    select: { id: true, name: true, slug: true, parentId: true, sortOrder: true },
    orderBy: { sortOrder: "asc" },
  });
  const byId = new Map(all.map((c) => [c.id, c]));
  const parentName = (c: Cat) => (c.parentId ? (byId.get(c.parentId)?.name ?? c.parentId) : "(ust seviye)");

  const created: string[] = [];
  const moved: string[] = [];
  const untouched: string[] = [];

  // --- Mevcut durum ---
  let aksesuar = all.find((c) => c.slug === "aksesuar") ?? null;
  console.log("== Mevcut durum ==");
  if (aksesuar) {
    console.log(`Aksesuar: id=${aksesuar.id} parentId=${aksesuar.parentId ?? "null"}`);
    console.log("Aksesuar alt kategorileri:");
    for (const c of all.filter((x) => x.parentId === aksesuar!.id)) {
      console.log(`  ${String(c.sortOrder).padStart(4)}  ${c.name} (${c.slug})`);
    }
  } else {
    console.log("Aksesuar (slug aksesuar) yok.");
  }
  console.log("Hedef adlarla eslesen kategoriler:");
  for (const target of [...AKSESUAR_CHILDREN, TOP_LEVEL]) {
    const wanted = target.aliases.map(norm);
    const matches = all.filter((c) => wanted.includes(norm(c.name)));
    if (!matches.length) console.log(`  ${target.name}: YOK`);
    for (const m of matches) console.log(`  ${target.name}: "${m.name}" (${m.slug}) parent=${parentName(m)}`);
  }

  // --- Plan / uygulama ---
  console.log(`\n== Plan (${CONFIRM ? "YAZILIYOR" : "kuru calistirma"}) ==`);

  if (!aksesuar) {
    console.log('Aksesuar olusturulacak (slug "aksesuar", parentId null).');
    if (CONFIRM) {
      aksesuar = await prisma.category.create({
        data: { name: "Aksesuar", slug: "aksesuar", parentId: null, isActive: true },
        select: { id: true, name: true, slug: true, parentId: true, sortOrder: true },
      });
    }
    created.push("Aksesuar");
  } else {
    untouched.push("Aksesuar");
  }

  // Kuru calistirmada Aksesuar henuz yoksa id'si de yok; plan yine yazdirilir.
  const aksesuarId = aksesuar?.id ?? "(yeni Aksesuar)";
  let nextSortOrder = Math.max(-10, ...all.filter((c) => c.parentId === aksesuarId).map((c) => c.sortOrder)) + 10;

  for (const target of AKSESUAR_CHILDREN) {
    const wanted = target.aliases.map(norm);
    const matches = all.filter((c) => wanted.includes(norm(c.name)));
    // Ayni ad birden fazla varsa Aksesuar altindaki tercih edilir; yeni kopya acilmaz.
    const existing = matches.find((c) => c.parentId === aksesuarId) ?? matches[0];
    if (matches.length > 1) {
      console.log(`  UYARI: "${target.name}" icin ${matches.length} kayit var, "${existing.name}" (${existing.slug}) kullaniliyor.`);
    }
    if (existing && existing.parentId === aksesuarId) {
      console.log(`  ${existing.name}: zaten Aksesuar altinda, dokunulmadi.`);
      untouched.push(existing.name);
    } else if (existing) {
      console.log(`  ${existing.name}: ${parentName(existing)} -> Aksesuar tasinacak (sortOrder ${nextSortOrder}).`);
      if (CONFIRM) {
        await prisma.category.update({ where: { id: existing.id }, data: { parentId: aksesuarId, sortOrder: nextSortOrder } });
      }
      nextSortOrder += 10;
      moved.push(existing.name);
    } else {
      const slug = CONFIRM ? await generateUniqueCategorySlug(prisma, target.name) : categorySlug(target.name);
      console.log(`  ${target.name}: Aksesuar altinda olusturulacak (slug ${slug}, sortOrder ${nextSortOrder}).`);
      if (CONFIRM) {
        await prisma.category.create({
          data: { name: target.name, slug, parentId: aksesuarId, isActive: true, sortOrder: nextSortOrder },
        });
      }
      nextSortOrder += 10;
      created.push(target.name);
    }
  }

  const boxer = all.find((c) => norm(c.name) === norm(TOP_LEVEL.name));
  if (boxer) {
    console.log(`  ${boxer.name}: mevcut (parent=${parentName(boxer)}), dokunulmadi.`);
    untouched.push(boxer.name);
  } else {
    const slug = CONFIRM ? await generateUniqueCategorySlug(prisma, TOP_LEVEL.name) : categorySlug(TOP_LEVEL.name);
    console.log(`  ${TOP_LEVEL.name}: ust seviyede olusturulacak (slug ${slug}).`);
    if (CONFIRM) await prisma.category.create({ data: { name: TOP_LEVEL.name, slug, parentId: null, isActive: true } });
    created.push(TOP_LEVEL.name);
  }

  console.log("\n== Ozet ==");
  console.log(`Olusturulan${CONFIRM ? "" : " (planlanan)"}: ${created.join(", ") || "-"}`);
  console.log(`Tasinan${CONFIRM ? "" : " (planlanan)"}: ${moved.join(", ") || "-"}`);
  console.log(`Dokunulmayan: ${untouched.join(", ") || "-"}`);
  if (!CONFIRM) console.log("Kuru calistirma, yazilmadi. Uygulamak icin --confirm ekleyin.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
