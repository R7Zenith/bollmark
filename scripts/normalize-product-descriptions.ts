// Koton.com'dan cekilip hic sanitize edilmeden kaydedilmis urun aciklamalarini
// (cift <p><p>, bos <p></p>, hatali ic ice gecmis etiketler) geriye donuk temizler.
// Guncellemeden once TUM urunlerin description alanini JSON olarak yedekler.
// Tek seferlik kullanim icin yazildi - idempotent (tekrar calistirilirsa artik
// degisiklik yapmaz, cunku sanitizeDescriptionHtml zaten temiz HTML'i degistirmez).
import "dotenv/config";
import { writeFileSync } from "fs";
import { prisma } from "../src/lib/prisma";
import { sanitizeDescriptionHtml } from "../src/lib/description-html";

async function main() {
  const products = await prisma.product.findMany({ select: { id: true, name: true, description: true } });

  const backupPath = process.argv[2] || `backup-descriptions-${Date.now()}.json`;
  writeFileSync(
    backupPath,
    JSON.stringify(
      { takenAt: new Date().toISOString(), descriptions: products.map((p) => ({ id: p.id, description: p.description })) },
      null,
      2
    ),
    "utf-8"
  );
  console.log(`Yedek yazildi: ${backupPath} (${products.length} urun)`);

  let changed = 0;
  for (const product of products) {
    const cleaned = sanitizeDescriptionHtml(product.description);
    if (cleaned !== product.description) {
      await prisma.product.update({ where: { id: product.id }, data: { description: cleaned } });
      changed++;
      console.log(`Duzeltildi: ${product.name} (${product.id})`);
    }
  }

  console.log(`Tamamlandi. ${changed}/${products.length} urunun aciklamasi temizlendi.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
