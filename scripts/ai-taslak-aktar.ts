// Özgün açıklama taslağı yazma akışı (bkz.
// SEO_FAZ6_OZGUN_ACIKLAMA_VE_YONLENDIRME_PLANI.md): taslak bekleyen ürünlerin
// bilgileri dışarı alınır, taslaklar Claude Code oturumunda yazılır, sonra içeri
// alınır (API yok). İçeri alma lib'deki saveDraft'ı kullanır: kalite kontrolünden
// geçer, yalnız descriptionDraft yazılır, `description`'a dokunulmaz.
// Yazım kuralları: ~100-130 kelime; giriş iki paragraf (ürün + kumaş hissi, sonra
// kombin önerisi), ardından maddeler. Yalnız kaynaktaki bilgiler: kumaş oranı,
// ürün ölçüleri, manken ölçüleri ve numune bedeni varsa maddelere yazılır,
// yoksa uydurulmaz. Abartılı övgü, müşteri yorumu özeti, fiyat/stok/kargo ve başka
// mağaza adı yazılmaz; kaynaktan 6 kelimeden uzun öbek aynen alınmaz.
//   npx tsx scripts/ai-taslak-aktar.ts --disari <dosya.json>
//   npx tsx scripts/ai-taslak-aktar.ts --iceri <dosya.json>    [{ id, ad, giris, ozellikler[] }]
import "dotenv/config";
import { readFileSync, writeFileSync } from "fs";
import { prisma } from "../src/lib/prisma";
import { saveDraft } from "../src/lib/ai-description";
import { descriptionToPlainText } from "../src/lib/description-html";
import { variantOptionsInclude } from "../src/lib/variant-attributes";

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function exportPending(file: string) {
  const products = await prisma.product.findMany({
    where: { status: { not: "ARCHIVED" }, descriptionDraft: null, descriptionApprovedAt: null },
    include: {
      brand: { select: { name: true } },
      category: { select: { name: true } },
      tags: { select: { name: true } },
      variants: { include: variantOptionsInclude }
    },
    orderBy: [{ status: "desc" }, { createdAt: "desc" }, { id: "asc" }]
  });
  const rows = products.map((p) => {
    const colors = new Set<string>();
    for (const variant of p.variants) {
      for (const option of variant.options) {
        if (option.value.attribute.isColor) colors.add(option.value.value);
      }
    }
    return {
      id: p.id,
      ad: p.name,
      marka: p.brand?.name ?? null,
      kategori: p.category?.name ?? null,
      cinsiyet: p.gender,
      renkler: [...colors],
      materyal: p.material,
      mense: p.origin,
      bakim: p.careInstructions,
      etiketler: p.tags.map((t) => t.name),
      kaynak: descriptionToPlainText(p.originalDescription ?? p.description)
    };
  });
  writeFileSync(file, JSON.stringify(rows, null, 1), "utf-8");
  console.log(`${rows.length} ürün ${file} dosyasına yazıldı.`);
}

async function importDrafts(file: string) {
  const items: { id: string; ad?: string; giris: string; ozellikler: string[] }[] = JSON.parse(readFileSync(file, "utf-8"));
  let failed = 0;
  for (const item of items) {
    try {
      await saveDraft(item.id, item.giris, item.ozellikler);
    } catch (error) {
      failed++;
      console.log(`✗ ${item.ad ?? item.id}: ${error instanceof Error ? error.message : error}`);
    }
  }
  console.log(`Kaydedilen: ${items.length - failed} | hatalı: ${failed}`);
}

async function main() {
  const out = argValue("--disari");
  const input = argValue("--iceri");
  if (out) await exportPending(out);
  else if (input) await importDrafts(input);
  else console.log("Kullanım: --disari <dosya.json> ya da --iceri <dosya.json>");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
