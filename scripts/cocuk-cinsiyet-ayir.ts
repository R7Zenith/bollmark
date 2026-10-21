// Cinsiyeti "Çocuk" olan urunleri Kız Çocuk / Erkek Çocuk olarak ayirir (bkz.
// COCUK_MENU_VE_BEDEN_DUZELTME_PLANI.md B). Tahmin lib/child-gender.ts'te:
// once urun adi, sonra Koton urun kodu (KB erkek, KG kiz); tutmazsa BELİRSİZ,
// urun "Çocuk" kalir ve admin'den elle secilir.
// Yerel ve canli ayni veritabanini kullanir: --uygula canlida aninda gorunur.
//   npx tsx scripts/cocuk-cinsiyet-ayir.ts            (kuru calistirma, yalniz liste)
//   npx tsx scripts/cocuk-cinsiyet-ayir.ts --uygula   (kullanici onayindan sonra)
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { logAudit } from "../src/lib/audit-log";
import { guessChildGender } from "../src/lib/child-gender";

async function main() {
  const apply = process.argv.includes("--uygula");
  const products = await prisma.product.findMany({
    where: { gender: "Çocuk" },
    select: { id: true, code: true, name: true, status: true },
    orderBy: { name: "asc" }
  });

  const rows = products.map((p) => ({ ...p, guess: guessChildGender(p.name, p.code) }));
  for (const { code, name, status, guess } of rows) {
    console.log(`${guess.gender ?? "BELİRSİZ"} | ${code ?? "-"} | ${status} | ${name} | ${guess.reason}`);
  }
  const decided = rows.filter((r) => r.guess.gender);
  console.log(`\nToplam ${rows.length}: ayrılabilen ${decided.length}, belirsiz ${rows.length - decided.length}.`);

  if (!apply) {
    console.log("Kuru çalıştırma - hiçbir şey değişmedi. Uygulamak için --uygula.");
    return;
  }

  for (const { id, name, guess } of decided) {
    await prisma.product.update({ where: { id }, data: { gender: guess.gender } });
    await logAudit({
      actorEmail: "script:cocuk-cinsiyet-ayir",
      actorRole: "ADMIN",
      action: "URUN_CINSIYETI_AYRILDI",
      targetType: "Product",
      targetId: id,
      detail: `"${name}": Çocuk → ${guess.gender} (${guess.reason})`
    });
  }
  console.log(
    `${decided.length} ürün güncellendi. Script Next.js dışında çalıştığı için revalidateCatalog() çağrılamadı: ` +
      "menü ve katalog önbelleği en geç 1 saatte yenilenir; hemen görmek için admin'de herhangi bir ürünü kaydedin."
  );
}

main().finally(() => prisma.$disconnect());
