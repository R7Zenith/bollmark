// Tek seferlik betik: prisma/legal-pages-content.ts icindeki gercek yasal
// metinleri mevcut DB'deki LegalPage kayitlarina yazar (seed.ts'in aksine
// var olan kayitlarin uzerine de yazar - placeholder icerigi gercek metinle
// degistirmek icin). Idempotent - tekrar calistirilirsa ayni icerigi yazar.
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { legalPagesContent } from "../prisma/legal-pages-content";

async function main() {
  for (const page of legalPagesContent) {
    await prisma.legalPage.upsert({
      where: { slug: page.slug },
      update: { title: page.title, content: page.content },
      create: page
    });
    console.log(`Guncellendi: ${page.slug}`);
  }
  console.log("Tamamlandi.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
