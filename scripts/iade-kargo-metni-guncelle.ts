// "iade-kosullari" ve "mesafeli-satis-sozlesmesi" kayitlarindaki iade kargo
// ucreti cumlesini prisma/legal-pages-content.ts'teki metne (firma adi
// STORE_INFO.returnCarrier) cevirir. Diger kayitlara ve metnin geri kalanina
// dokunmaz.
//
// Guvenlik: DB'deki metin donusturuldugunde kaynakla BIREBIR ayni olmali;
// degilse (DB'de baska bir fark varsa) hicbir sey yazilmaz.
//
// Varsayilan kuru calisma; yazmak icin: npx tsx scripts/iade-kargo-metni-guncelle.ts --yaz
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { legalPagesContent } from "../prisma/legal-pages-content";

// Her sayfada degisen tek satir: eski hali (ya da onceki firma adiyla yeni hali) -> kaynaktaki hali.
const LINES: Record<string, RegExp> = {
  "iade-kosullari": /^4\. İade (kargo ücreti alıcıya aittir\.|için anlaşmalı kargo firmamız: .+)$/m,
  "mesafeli-satis-sozlesmesi": /^- İade (kargo ücreti ALICI'ya aittir\.|için SATICI'nın anlaşmalı kargo firması: .+)$/m
};

async function main() {
  const write = process.argv.includes("--yaz");
  for (const [slug, pattern] of Object.entries(LINES)) {
    const expected = legalPagesContent.find((p) => p.slug === slug)?.content;
    const row = await prisma.legalPage.findUnique({ where: { slug }, select: { content: true } });
    if (!expected || !row) throw new Error(`Kayit bulunamadi: ${slug}`);
    if (row.content === expected) {
      console.log(`${slug}: zaten guncel, atlandi.`);
      continue;
    }
    const newLine = expected.match(pattern)?.[0];
    const count = (row.content.match(new RegExp(pattern, "gm")) ?? []).length;
    if (!newLine || count !== 1) throw new Error(`${slug}: beklenen 1 eslesme, bulunan ${count}.`);
    const next = row.content.replace(pattern, newLine);
    if (next !== expected) throw new Error(`${slug}: DB metni kaynakla uyusmuyor, yazilmadi.`);
    if (write) {
      await prisma.legalPage.update({ where: { slug }, data: { content: next } });
      console.log(`${slug}: YAZILDI.`);
    } else {
      console.log(`${slug}: kontrol tamam, yazilmaya hazir (kuru calisma).`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
