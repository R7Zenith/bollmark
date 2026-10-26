// Tek seferlik betik (26 Ekim 2026): yalniz "mesafeli-satis-sozlesmesi" ve
// "gizlilik-politikasi" kayitlarinin satici blogina MERSIS No ve
// "Telefon / WhatsApp" satirlarini ekler, "Son guncelleme"yi 26 Ekim 2026 yapar
// (bkz. docs/planlar/ILETISIM_TELEFON_VE_INSTAGRAM_DM_PLANI.md). Diger kayitlara
// ve metnin geri kalanina dokunmaz.
//
// Guvenlik: DB'deki metin bu degisikliklerle donusturuldugunde
// prisma/legal-pages-content.ts'teki metinle BIREBIR ayni olmali; degilse
// (DB'de baska bir fark varsa) hicbir sey yazilmaz.
//
// Varsayilan kuru calisma; yazmak icin: npx tsx scripts/yasal-satici-iletisim-guncelle.ts --yaz
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { legalPagesContent } from "../prisma/legal-pages-content";

const SLUGS = ["mesafeli-satis-sozlesmesi", "gizlilik-politikasi"];
const VERGI = "Vergi Dairesi / No: Karacabey Vergi Dairesi – 6080753452\n";
const ADRES = "Adres: Runguçpaşa Mah. 75. Sk. No:6/A Karacabey/Bursa\n";

function replaceOnce(text: string, from: string | RegExp, to: string): string {
  const count = typeof from === "string" ? text.split(from).length - 1 : (text.match(new RegExp(from, "g")) ?? []).length;
  if (count !== 1) throw new Error(`Beklenen 1 eslesme, bulunan ${count}: ${from}`);
  return text.replace(from, to);
}

function transform(content: string): string {
  let next = replaceOnce(content, VERGI, `${VERGI}MERSİS No: 1667655626000001\n`);
  next = replaceOnce(next, ADRES, `${ADRES}Telefon / WhatsApp: 0 (224) 323 01 21\n`);
  return replaceOnce(next, /Son güncelleme: .+$/, "Son güncelleme: 26 Ekim 2026");
}

async function main() {
  const write = process.argv.includes("--yaz");
  for (const slug of SLUGS) {
    const expected = legalPagesContent.find((p) => p.slug === slug)?.content;
    const row = await prisma.legalPage.findUnique({ where: { slug }, select: { content: true } });
    if (!expected || !row) throw new Error(`Kayit bulunamadi: ${slug}`);
    if (row.content === expected) {
      console.log(`${slug}: zaten guncel, atlandi.`);
      continue;
    }
    const next = transform(row.content);
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
