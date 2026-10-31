// Kalp Topla yayin fazi (KALP_TOPLA_PLANI.md 9.1/3): Gizlilik Politikasi'na Kalp
// Topla bolumunu ekler, Kampanya Kosullari sayfasini olusturur. Baska kayda ve
// metnin geri kalanina dokunmaz. Cerez Politikasi kodda oldugu icin burada yok.
//
// Guvenlik: Canli gizlilik metni, kaynaktaki metnin Kalp Topla bolumu cikarilmis
// haliyle BIREBIR ayni degilse (tarih satiri haric) hicbir sey yazilmaz. Kosullar
// sayfasi varsa ve farkliysa ezilmez.
//
// Varsayilan kuru calisma. Yazmak icin (yalniz kullanici onayiyla):
//   npx tsx scripts/kalp-topla-yasal-metinler.ts --confirm
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { KALP_TOPLA_GIZLILIK_BOLUMU, legalPagesContent } from "../prisma/legal-pages-content";

const PRIVACY = "gizlilik-politikasi";
const TERMS = "kalp-topla-kosullari";
const DATE_LINE = /Son güncelleme: .+$/;

function source(slug: string) {
  const page = legalPagesContent.find((p) => p.slug === slug);
  if (!page) throw new Error(`Kaynakta yok: ${slug}`);
  return page;
}

const withoutDate = (text: string) => text.replace(DATE_LINE, "");

function today() {
  const date = new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Istanbul" });
  return `Son güncelleme: ${date}`;
}

async function planPrivacy(write: boolean) {
  const expected = source(PRIVACY).content;
  const before = expected.replace(`${KALP_TOPLA_GIZLILIK_BOLUMU}\n\n12. Değişiklikler`, "11. Değişiklikler");
  if (before === expected) throw new Error("Kaynakta Kalp Topla bolumu bulunamadi, yazilmadi.");

  const row = await prisma.legalPage.findUnique({ where: { slug: PRIVACY }, select: { content: true } });
  if (!row) throw new Error(`Kayit bulunamadi: ${PRIVACY}`);
  if (withoutDate(row.content) === withoutDate(expected)) {
    console.log(`${PRIVACY}: zaten guncel, atlandi.`);
    return;
  }
  if (withoutDate(row.content) !== withoutDate(before)) {
    throw new Error(`${PRIVACY}: canli metin kaynakla uyusmuyor, yazilmadi.`);
  }
  const next = expected.replace(DATE_LINE, today());
  console.log(`${PRIVACY}: ${row.content.length} -> ${next.length} karakter, ${today()}.`);
  if (!write) {
    console.log(`${PRIVACY}: kontrol tamam, yazilmaya hazir (kuru calisma).`);
    return;
  }
  await prisma.legalPage.update({ where: { slug: PRIVACY }, data: { content: next } });
  console.log(`${PRIVACY}: YAZILDI.`);
}

async function planTerms(write: boolean) {
  const page = source(TERMS);
  const row = await prisma.legalPage.findUnique({ where: { slug: TERMS }, select: { content: true } });
  if (row && row.content === page.content) {
    console.log(`${TERMS}: zaten guncel, atlandi.`);
    return;
  }
  if (row) throw new Error(`${TERMS}: canlida farkli bir metin var, ezilmedi.`);
  if (!write) {
    console.log(`${TERMS}: kayit yok, olusturulmaya hazir, ${page.content.length} karakter (kuru calisma).`);
    return;
  }
  await prisma.legalPage.create({ data: page });
  console.log(`${TERMS}: OLUSTURULDU.`);
}

async function main() {
  const write = process.argv.includes("--confirm");
  console.log(write ? "GERCEK YAZMA (--confirm)" : "Kuru calisma: DB'ye yazilmaz. Yazmak icin --confirm.");
  // Once ikisi de kuru denetlenir: biri uyusmazsa digeri yarim yazilmasin.
  await planPrivacy(false);
  await planTerms(false);
  if (!write) return;
  await planPrivacy(true);
  await planTerms(true);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
